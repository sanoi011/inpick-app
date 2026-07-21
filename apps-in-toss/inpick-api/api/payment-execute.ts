import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AppsInTossPayError,
  getAppsInTossPaymentContext,
  requestAppsInTossPay,
} from "../lib/apps-in-toss-pay.js";
import { applyCors, json } from "../lib/http.js";
import {
  provisionAppsInTossPayment,
  type ProvisionProduct,
} from "../lib/payment-provision.js";

type IntentRow = {
  id: string;
  user_id: string;
  order_id: string;
  amount_krw: number;
  status: string;
  provider_mode?: string | null;
  metadata?: Record<string, unknown> | null;
  project_id?: string | null;
  product:
    | {
        code: string;
        product_type: string;
        name_ko: string;
        credit_amount: number | null;
        bonus_credit_amount: number | null;
      }
    | Array<{
        code: string;
        product_type: string;
        name_ko: string;
        credit_amount: number | null;
        bonus_credit_amount: number | null;
      }>
    | null;
};

type ExecuteResult = {
  orderNo: string;
  amount: number;
  approvalTime?: string;
  stateMsg?: string;
  payMethod?: string;
  payToken: string;
  transactionId?: string;
  [key: string]: unknown;
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  applyCors(response);
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return json(response, 405, { error: "METHOD_NOT_ALLOWED" });

  const payToken = String(request.body?.payToken || "").trim();
  const orderNo = String(request.body?.orderNo || "").trim();
  if (!payToken || !/^[A-Za-z0-9_:.^@-]{1,50}$/.test(orderNo)) {
    return json(response, 400, { error: "INVALID_PAYMENT_REQUEST" });
  }

  try {
    const context = await getAppsInTossPaymentContext(request);
    const intentResult = await context.admin
      .from("payment_intents")
      .select(
        "id, user_id, order_id, amount_krw, status, provider_mode, metadata, project_id, product:payment_products(code, product_type, name_ko, credit_amount, bonus_credit_amount)",
      )
      .eq("order_id", orderNo)
      .eq("user_id", context.user.id)
      .maybeSingle();
    if (intentResult.error || !intentResult.data) {
      return json(response, 404, { error: "PAYMENT_NOT_FOUND" });
    }

    const intent = intentResult.data as unknown as IntentRow;
    const metadata = intent.metadata || {};
    if (
      intent.user_id !== context.user.id ||
      intent.provider_mode !== (context.isTestPayment ? "test" : "live") ||
      metadata.appsInTossPayToken !== payToken
    ) {
      return json(response, 403, { error: "PAYMENT_MISMATCH" });
    }

    if (intent.status === "provisioned") {
      const existingPayment = await context.admin
        .from("payments")
        .select("id")
        .eq("order_id", orderNo)
        .maybeSingle();
      return json(response, 200, {
        success: true,
        duplicate: true,
        provisioned: true,
        paymentId: existingPayment.data?.id || null,
      });
    }

    // 샌드박스는 토스 정책상 생성·인증까지만 지원한다. 실제 승인·상품 지급은 하지 않는다.
    if (context.isTestPayment) {
      await context.admin
        .from("payment_intents")
        .update({ status: "test_authenticated" })
        .eq("id", intent.id);
      return json(response, 200, {
        success: true,
        testMode: true,
        provisioned: false,
        message: "샌드박스 결제 인증 테스트가 완료됐습니다. 실제 결제와 상품 지급은 없습니다.",
      });
    }

    await context.admin
      .from("payment_intents")
      .update({ status: "confirming" })
      .eq("id", intent.id);

    const executed = await requestAppsInTossPay<ExecuteResult>({
      path: "/api-partner/v1/apps-in-toss/pay/execute-payment",
      tossUserKey: context.tossUserKey,
      body: { payToken, orderNo, isTestPayment: false },
    });
    if (
      executed.orderNo !== orderNo ||
      executed.payToken !== payToken ||
      Number(executed.amount) !== Number(intent.amount_krw)
    ) {
      await context.admin.from("payment_reconciliation_jobs").insert({
        payment_intent_id: intent.id,
        order_id: orderNo,
        payment_key: payToken,
        issue_type: "apps_in_toss_pay_response_mismatch",
        severity: "critical",
        description_ko: "앱인토스 페이 승인 응답이 서버 주문 정보와 일치하지 않음",
      });
      return json(response, 409, { error: "PAYMENT_RESPONSE_MISMATCH" });
    }

    let paymentResult = await context.admin
      .from("payments")
      .insert({
        payment_intent_id: intent.id,
        user_id: context.user.id,
        provider: "apps_in_toss_pay",
        payment_key: payToken,
        order_id: orderNo,
        method: executed.payMethod || "TOSS_PAY",
        easy_pay_provider: "TOSS_PAY",
        amount_krw: intent.amount_krw,
        status: "DONE",
        approved_at: executed.approvalTime || new Date().toISOString(),
        raw_payment: executed,
      })
      .select("id")
      .single();
    if (paymentResult.error && /duplicate|unique/i.test(paymentResult.error.message)) {
      paymentResult = await context.admin
        .from("payments")
        .select("id")
        .eq("payment_key", payToken)
        .single();
    }
    if (paymentResult.error || !paymentResult.data) {
      throw paymentResult.error || new Error("PAYMENT_RECORD_FAILED");
    }

    await context.admin
      .from("payment_intents")
      .update({ status: "paid" })
      .eq("id", intent.id);
    await context.admin.from("payment_events").upsert(
      {
        payment_intent_id: intent.id,
        payment_id: paymentResult.data.id,
        user_id: context.user.id,
        provider: "apps_in_toss_pay",
        event_type: "PAYMENT_CONFIRMED",
        event_key: `apps-in-toss-pay:confirm:${payToken}`,
        order_id: orderNo,
        payment_key: payToken,
        amount_krw: intent.amount_krw,
        raw_event: executed,
      },
      { onConflict: "provider,event_key", ignoreDuplicates: true },
    );

    const rawProduct = Array.isArray(intent.product) ? intent.product[0] : intent.product;
    if (!rawProduct) throw new Error("PAYMENT_PRODUCT_MISSING");
    const product: ProvisionProduct = {
      code: rawProduct.code,
      productType: rawProduct.product_type,
      nameKo: rawProduct.name_ko,
      paidCredits: Number(rawProduct.credit_amount || 0),
      bonusCredits: Number(rawProduct.bonus_credit_amount || 0),
    };

    try {
      const provisioned = await provisionAppsInTossPayment({
        admin: context.admin,
        userId: context.user.id,
        paymentId: paymentResult.data.id,
        product,
        estimateId: String(metadata.estimateId || "") || null,
        consumerProjectId:
          String(metadata.consumerProjectId || intent.project_id || "") || null,
      });
      await context.admin
        .from("payment_intents")
        .update({ status: "provisioned" })
        .eq("id", intent.id);
      return json(response, 200, {
        success: true,
        provisioned: true,
        paymentId: paymentResult.data.id,
        ...provisioned,
      });
    } catch (error) {
      await context.admin.from("payment_reconciliation_jobs").insert({
        payment_intent_id: intent.id,
        payment_id: paymentResult.data.id,
        order_id: orderNo,
        payment_key: payToken,
        issue_type: "apps_in_toss_pay_provision_failed",
        severity: "critical",
        description_ko: error instanceof Error ? error.message : "상품 지급 실패",
      });
      return json(response, 200, {
        success: true,
        provisioned: false,
        paymentId: paymentResult.data.id,
        warning: "결제는 완료됐지만 상품 지급 확인이 필요합니다. 고객센터에서 자동 확인합니다.",
      });
    }
  } catch (error) {
    console.error("[inpick-toss-api/payment-execute]", error);
    if (error instanceof AppsInTossPayError) {
      return json(response, error.status, { error: error.code, hint: error.message });
    }
    return json(response, 500, { error: "PAYMENT_EXECUTE_FAILED" });
  }
}
