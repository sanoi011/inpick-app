import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AppsInTossIapError,
  getAppsInTossIapOrderStatus,
  isAppsInTossOrderId,
  isAppsInTossSku,
  isGrantableAppsInTossIapStatus,
} from "../lib/apps-in-toss-iap.js";
import {
  AppsInTossPayError,
  getAppsInTossPaymentContext,
} from "../lib/apps-in-toss-pay.js";
import { applyCors, json } from "../lib/http.js";
import {
  provisionAppsInTossPayment,
  type ProvisionProduct,
} from "../lib/payment-provision.js";
import type { AdminClient } from "../lib/supabase-admin.js";

type ProductRow = {
  id: string;
  code: string;
  product_type: string;
  name_ko: string;
  amount_krw: number;
  credit_amount: number | null;
  bonus_credit_amount: number | null;
  is_visible?: boolean | null;
  effective_from?: string | null;
  effective_to?: string | null;
  apps_in_toss_sku: string;
  apps_in_toss_product_type: string;
  apps_in_toss_sale_amount_krw?: number | null;
};

type IapOrderRow = {
  order_id: string;
  user_id: string;
  product_id: string;
  sku: string;
  status: string;
  payment_intent_id?: string | null;
  payment_id?: string | null;
  estimate_id?: string | null;
  consumer_project_id?: string | null;
  provisioning_attempts?: number | null;
};

function optionalUuid(value: unknown): string | null | undefined {
  if (value == null || value === "") return null;
  const normalized = String(value).trim();
  return isAppsInTossOrderId(normalized) ? normalized : undefined;
}

function approvedAt(value: string): string {
  if (!value) return new Date().toISOString();
  if (/Z$|[+-]\d{2}:\d{2}$/.test(value)) return value;
  return `${value}+09:00`;
}

async function existingProvisionResult(input: {
  admin: AdminClient;
  paymentId: string | null | undefined;
  product: ProductRow;
}) {
  if (!input.paymentId) return {};
  if (["token_pack", "ai_credit_pack"].includes(input.product.product_type)) {
    const ledger = await input.admin
      .from("token_ledger")
      .select("balance_after")
      .eq("idempotency_key", `payment:${input.paymentId}:credit`)
      .maybeSingle();
    return {
      kind: "tokens",
      creditsAdded: 0,
      balanceAfter:
        ledger.data?.balance_after == null
          ? undefined
          : Number(ledger.data.balance_after),
    };
  }
  const entitlement = await input.admin
    .from("user_entitlements")
    .select("id")
    .eq("source", "payment")
    .eq("source_id", input.paymentId)
    .eq("entitlement_type", "estimate_pdf_single")
    .maybeSingle();
  return {
    kind: "estimate_pdf",
    entitlementId: entitlement.data?.id || undefined,
  };
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  applyCors(response);
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") {
    return json(response, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  const orderId = String(request.body?.orderId || "").trim();
  const sku = String(request.body?.sku || "").trim();
  const estimateId = optionalUuid(request.body?.estimateId);
  const consumerProjectId = optionalUuid(request.body?.consumerProjectId);
  const projectId = optionalUuid(request.body?.projectId);
  if (
    !isAppsInTossOrderId(orderId) ||
    !isAppsInTossSku(sku) ||
    estimateId === undefined ||
    consumerProjectId === undefined ||
    projectId === undefined
  ) {
    return json(response, 400, { error: "INVALID_IAP_GRANT_REQUEST" });
  }

  try {
    const context = await getAppsInTossPaymentContext(request);
    const remoteOrder = await getAppsInTossIapOrderStatus({
      orderId,
      tossUserKey: context.tossUserKey,
    });
    if (remoteOrder.orderId !== orderId || remoteOrder.sku !== sku) {
      return json(response, 409, { error: "IAP_ORDER_MISMATCH" });
    }
    if (!isGrantableAppsInTossIapStatus(remoteOrder.status)) {
      return json(response, remoteOrder.status === "ORDER_IN_PROGRESS" ? 409 : 422, {
        error: `IAP_ORDER_${remoteOrder.status}`,
        hint: remoteOrder.reason || "결제가 완료되지 않았습니다.",
      });
    }

    const productResult = await context.admin
      .from("payment_products")
      .select(
        "id, code, product_type, name_ko, amount_krw, credit_amount, bonus_credit_amount, is_visible, effective_from, effective_to, apps_in_toss_sku, apps_in_toss_product_type, apps_in_toss_sale_amount_krw",
      )
      .eq("apps_in_toss_sku", sku)
      .eq("apps_in_toss_enabled", true)
      .eq("is_active", true)
      .maybeSingle();
    const product = productResult.data as ProductRow | null;
    const now = Date.now();
    if (
      productResult.error ||
      !product ||
      product.is_visible === false ||
      (product.effective_from && Date.parse(product.effective_from) > now) ||
      (product.effective_to && Date.parse(product.effective_to) < now) ||
      product.apps_in_toss_product_type !== "CONSUMABLE" ||
      !["token_pack", "ai_credit_pack", "pdf_estimate_single", "pdf_entitlement"].includes(
        product.product_type,
      )
    ) {
      return json(response, 404, { error: "IAP_PRODUCT_NOT_AVAILABLE" });
    }

    const existingResult = await context.admin
      .from("apps_in_toss_iap_orders")
      .select(
        "order_id, user_id, product_id, sku, status, payment_intent_id, payment_id, estimate_id, consumer_project_id, provisioning_attempts",
      )
      .eq("order_id", orderId)
      .maybeSingle();
    if (existingResult.error) throw existingResult.error;
    let tracked = existingResult.data as IapOrderRow | null;
    if (
      tracked &&
      (tracked.user_id !== context.user.id ||
        tracked.product_id !== product.id ||
        tracked.sku !== sku)
    ) {
      return json(response, 403, { error: "IAP_ORDER_OWNERSHIP_MISMATCH" });
    }
    if (tracked?.status === "granted") {
      return json(response, 200, {
        success: true,
        provisioned: true,
        duplicate: true,
        paymentId: tracked.payment_id || null,
        ...(await existingProvisionResult({
          admin: context.admin,
          paymentId: tracked.payment_id,
          product,
        })),
      });
    }
    if (tracked?.status === "refunded") {
      return json(response, 422, {
        error: "IAP_ORDER_REFUNDED",
        hint: "환불 완료된 주문은 다시 지급할 수 없습니다.",
      });
    }

    if (remoteOrder.status === "PURCHASED") {
      await context.admin.from("apps_in_toss_iap_orders").upsert(
        {
          order_id: orderId,
          user_id: context.user.id,
          product_id: product.id,
          sku,
          status: "completed_without_local_grant",
          remote_status: remoteOrder.status,
          raw_status: remoteOrder,
          status_determined_at: approvedAt(remoteOrder.statusDeterminedAt),
        },
        { onConflict: "order_id" },
      );
      await context.admin.from("payment_reconciliation_jobs").insert({
        order_id: orderId,
        payment_key: `iap:${orderId}`,
        issue_type: "apps_in_toss_iap_completed_without_local_grant",
        severity: "critical",
        description_ko:
          "앱인토스 주문은 지급 완료 상태이나 인픽의 로컬 지급 기록을 찾지 못함",
      });
      return json(response, 409, {
        error: "IAP_COMPLETED_WITHOUT_LOCAL_GRANT",
        hint: "이미 완료된 주문입니다. 중복 지급 방지를 위해 고객센터 확인이 필요합니다.",
      });
    }

    const amount = Number(
      product.apps_in_toss_sale_amount_krw || product.amount_krw,
    );
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return json(response, 409, { error: "INVALID_IAP_PRODUCT_PRICE" });
    }
    const effectiveEstimateId = tracked?.estimate_id || estimateId || null;
    const effectiveProjectId =
      tracked?.consumer_project_id || consumerProjectId || projectId || null;
    const productSnapshot = {
      productId: product.code,
      productDbId: product.id,
      productType: product.product_type,
      displayName: product.name_ko,
      amountKrw: amount,
      currency: "KRW",
      tokenAmount: Number(product.credit_amount || 0),
      bonusTokenAmount: Number(product.bonus_credit_amount || 0),
      sku,
      capturedAt: new Date().toISOString(),
      channel: "apps_in_toss_iap",
    };

    let intentResult = await context.admin
      .from("payment_intents")
      .select("id, status, user_id")
      .eq("order_id", orderId)
      .maybeSingle();
    if (intentResult.error) throw intentResult.error;
    if (intentResult.data && intentResult.data.user_id !== context.user.id) {
      return json(response, 403, { error: "IAP_PAYMENT_INTENT_OWNERSHIP_MISMATCH" });
    }
    if (!intentResult.data) {
      const insertedIntent = await context.admin
        .from("payment_intents")
        .insert({
          user_id: context.user.id,
          project_id: projectId || consumerProjectId || null,
          product_id: product.id,
          order_id: orderId,
          order_name: `INPICK ${product.name_ko}`,
          product_type: product.product_type,
          amount_krw: amount,
          status: "paid",
          provider: "apps_in_toss_iap",
          customer_key: context.user.id,
          channel: "apps_in_toss_iap",
          platform: "apps_in_toss",
          provider_mode: context.isTestPayment ? "test" : "live",
          product_snapshot: productSnapshot,
          token_amount: Number(product.credit_amount || 0),
          bonus_token_amount: Number(product.bonus_credit_amount || 0),
          metadata: {
            sku,
            estimateId: effectiveEstimateId,
            consumerProjectId: effectiveProjectId,
            appsInTossIap: true,
          },
        })
        .select("id, status, user_id")
        .single();
      if (
        insertedIntent.error &&
        /duplicate|unique/i.test(insertedIntent.error.message)
      ) {
        intentResult = await context.admin
          .from("payment_intents")
          .select("id, status, user_id")
          .eq("order_id", orderId)
          .single();
      } else {
        intentResult = insertedIntent;
      }
    }
    if (intentResult.error || !intentResult.data) {
      throw intentResult.error || new Error("IAP_PAYMENT_INTENT_CREATE_FAILED");
    }
    const paymentIntentId = intentResult.data.id;

    if (!tracked) {
      const insertedOrder = await context.admin
        .from("apps_in_toss_iap_orders")
        .insert({
          order_id: orderId,
          user_id: context.user.id,
          product_id: product.id,
          sku,
          status: "payment_completed",
          remote_status: remoteOrder.status,
          payment_intent_id: paymentIntentId,
          estimate_id: effectiveEstimateId,
          consumer_project_id: effectiveProjectId,
          status_determined_at: approvedAt(remoteOrder.statusDeterminedAt),
          raw_status: remoteOrder,
          provisioning_attempts: 0,
        })
        .select(
          "order_id, user_id, product_id, sku, status, payment_intent_id, payment_id, estimate_id, consumer_project_id, provisioning_attempts",
        )
        .single();
      if (
        insertedOrder.error &&
        /duplicate|unique/i.test(insertedOrder.error.message)
      ) {
        const concurrent = await context.admin
          .from("apps_in_toss_iap_orders")
          .select(
            "order_id, user_id, product_id, sku, status, payment_intent_id, payment_id, estimate_id, consumer_project_id, provisioning_attempts",
          )
          .eq("order_id", orderId)
          .single();
        if (concurrent.error || !concurrent.data) {
          throw concurrent.error || new Error("IAP_ORDER_TRACKING_FAILED");
        }
        tracked = concurrent.data as IapOrderRow;
      } else if (insertedOrder.error || !insertedOrder.data) {
        throw insertedOrder.error || new Error("IAP_ORDER_TRACKING_FAILED");
      } else {
        tracked = insertedOrder.data as IapOrderRow;
      }
    }

    const paymentKey = `iap:${orderId}`;
    let paymentResult = await context.admin
      .from("payments")
      .select("id, user_id")
      .eq("order_id", orderId)
      .maybeSingle();
    if (paymentResult.error) throw paymentResult.error;
    if (paymentResult.data && paymentResult.data.user_id !== context.user.id) {
      return json(response, 403, { error: "IAP_PAYMENT_OWNERSHIP_MISMATCH" });
    }
    if (!paymentResult.data) {
      const insertedPayment = await context.admin
        .from("payments")
        .insert({
          payment_intent_id: paymentIntentId,
          user_id: context.user.id,
          provider: "apps_in_toss_iap",
          payment_key: paymentKey,
          order_id: orderId,
          method: "IN_APP_PURCHASE",
          easy_pay_provider: "APP_MARKET",
          amount_krw: amount,
          status: "DONE",
          approved_at: approvedAt(remoteOrder.statusDeterminedAt),
          raw_payment: remoteOrder,
        })
        .select("id, user_id")
        .single();
      if (
        insertedPayment.error &&
        /duplicate|unique/i.test(insertedPayment.error.message)
      ) {
        paymentResult = await context.admin
          .from("payments")
          .select("id, user_id")
          .eq("order_id", orderId)
          .single();
      } else {
        paymentResult = insertedPayment;
      }
    }
    if (paymentResult.error || !paymentResult.data) {
      throw paymentResult.error || new Error("IAP_PAYMENT_RECORD_FAILED");
    }
    const paymentId = paymentResult.data.id;

    await context.admin.from("payment_events").upsert(
      {
        payment_intent_id: paymentIntentId,
        payment_id: paymentId,
        user_id: context.user.id,
        provider: "apps_in_toss_iap",
        event_type: "PAYMENT_COMPLETED",
        event_key: `apps-in-toss-iap:payment-completed:${orderId}`,
        order_id: orderId,
        payment_key: paymentKey,
        amount_krw: amount,
        raw_event: remoteOrder,
      },
      { onConflict: "provider,event_key", ignoreDuplicates: true },
    );

    const productForProvision: ProvisionProduct = {
      code: product.code,
      productType: product.product_type,
      nameKo: product.name_ko,
      paidCredits: Number(product.credit_amount || 0),
      bonusCredits: Number(product.bonus_credit_amount || 0),
    };
    try {
      const provisioned = await provisionAppsInTossPayment({
        admin: context.admin,
        userId: context.user.id,
        paymentId,
        product: productForProvision,
        estimateId: effectiveEstimateId,
        consumerProjectId: effectiveProjectId,
        channel: "apps_in_toss_iap",
      });
      const trackedUpdate = await context.admin
        .from("apps_in_toss_iap_orders")
        .update({
          status: "granted",
          remote_status: remoteOrder.status,
          payment_intent_id: paymentIntentId,
          payment_id: paymentId,
          granted_at: new Date().toISOString(),
          last_error: null,
          provisioning_attempts: Number(tracked?.provisioning_attempts || 0) + 1,
          raw_status: remoteOrder,
        })
        .eq("order_id", orderId)
        .eq("user_id", context.user.id);
      if (trackedUpdate.error) throw trackedUpdate.error;
      await context.admin
        .from("payment_intents")
        .update({ status: "provisioned" })
        .eq("id", paymentIntentId);
      await context.admin.from("payment_events").upsert(
        {
          payment_intent_id: paymentIntentId,
          payment_id: paymentId,
          user_id: context.user.id,
          provider: "apps_in_toss_iap",
          event_type: "PRODUCT_GRANTED",
          event_key: `apps-in-toss-iap:granted:${orderId}`,
          order_id: orderId,
          payment_key: paymentKey,
          amount_krw: amount,
          raw_event: { order: remoteOrder, provisioned },
        },
        { onConflict: "provider,event_key", ignoreDuplicates: true },
      );
      return json(response, 200, {
        success: true,
        provisioned: true,
        paymentId,
        ...provisioned,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "인앱결제 상품 지급 실패";
      await context.admin
        .from("apps_in_toss_iap_orders")
        .update({
          status: "grant_failed",
          remote_status: remoteOrder.status,
          payment_intent_id: paymentIntentId,
          payment_id: paymentId,
          last_error: message,
          provisioning_attempts: Number(tracked?.provisioning_attempts || 0) + 1,
          raw_status: remoteOrder,
        })
        .eq("order_id", orderId)
        .eq("user_id", context.user.id);
      await context.admin.from("payment_reconciliation_jobs").insert({
        payment_intent_id: paymentIntentId,
        payment_id: paymentId,
        order_id: orderId,
        payment_key: paymentKey,
        issue_type: "apps_in_toss_iap_provision_failed",
        severity: "critical",
        description_ko: message,
      });
      return json(response, 500, {
        success: false,
        provisioned: false,
        error: "IAP_PRODUCT_GRANT_FAILED",
        hint: "결제는 완료됐지만 상품 지급이 지연되고 있습니다. 앱을 다시 열면 자동 복구합니다.",
      });
    }
  } catch (error) {
    console.error("[inpick-toss-api/iap-grant]", error);
    if (error instanceof AppsInTossIapError) {
      return json(response, error.status, {
        error: error.code,
        hint: error.message,
      });
    }
    if (error instanceof AppsInTossPayError) {
      return json(response, error.status, {
        error: error.code,
        hint: error.message,
      });
    }
    return json(response, 500, { error: "IAP_GRANT_FAILED" });
  }
}
