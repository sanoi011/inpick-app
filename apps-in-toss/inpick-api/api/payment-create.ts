import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AppsInTossPayError,
  getAppsInTossPaymentContext,
  requestAppsInTossPay,
} from "../lib/apps-in-toss-pay.js";
import { applyCors, json } from "../lib/http.js";

type ProductRow = {
  id: string;
  code: string;
  product_type: string;
  name_ko: string;
  description_ko?: string | null;
  amount_krw: number;
  credit_amount: number | null;
  bonus_credit_amount: number | null;
  is_visible?: boolean | null;
  effective_from?: string | null;
  effective_to?: string | null;
  pricing_version_id?: string | null;
};

function safeProductDescription(value: string): string {
  return value.replace(/[\\"]/g, "").trim().slice(0, 255) || "인픽 디지털 상품";
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  applyCors(response);
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return json(response, 405, { error: "METHOD_NOT_ALLOWED" });

  const productCode = String(request.body?.productCode || "").trim();
  if (!/^[a-z0-9_-]{1,80}$/i.test(productCode)) {
    return json(response, 400, { error: "INVALID_PRODUCT_CODE" });
  }

  try {
    const context = await getAppsInTossPaymentContext(request);
    const productResult = await context.admin
      .from("payment_products")
      .select(
        "id, code, product_type, name_ko, description_ko, amount_krw, credit_amount, bonus_credit_amount, is_visible, effective_from, effective_to, pricing_version_id",
      )
      .eq("code", productCode)
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
      !["token_pack", "ai_credit_pack", "pdf_estimate_single", "pdf_entitlement"].includes(
        product.product_type,
      )
    ) {
      return json(response, 404, { error: "PRODUCT_NOT_AVAILABLE" });
    }

    const amount = Number(product.amount_krw);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return json(response, 409, { error: "INVALID_PRODUCT_PRICE" });
    }

    const orderNo = `INPICK_AIT_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const metadata = {
      productCode: product.code,
      estimateId: request.body?.estimateId || null,
      consumerProjectId: request.body?.consumerProjectId || null,
      returnPath: request.body?.returnPath || null,
      appsInTossPayment: true,
    };
    const productSnapshot = {
      productId: product.code,
      productDbId: product.id,
      productType: product.product_type,
      displayName: product.name_ko,
      description: product.description_ko || null,
      amountKrw: amount,
      currency: "KRW",
      tokenAmount: product.credit_amount || 0,
      bonusTokenAmount: product.bonus_credit_amount || 0,
      totalTokenAmount:
        Number(product.credit_amount || 0) + Number(product.bonus_credit_amount || 0),
      pricingVersionId: product.pricing_version_id || null,
      capturedAt: new Date().toISOString(),
      channel: "apps_in_toss_pay",
    };

    const intentResult = await context.admin
      .from("payment_intents")
      .insert({
        user_id: context.user.id,
        project_id: request.body?.projectId || null,
        product_id: product.id,
        order_id: orderNo,
        order_name: `INPICK ${product.name_ko}`,
        product_type: product.product_type,
        amount_krw: amount,
        status: "created",
        provider: "apps_in_toss_pay",
        customer_key: context.user.id,
        channel: "apps_in_toss_pay",
        platform: "apps_in_toss",
        provider_mode: context.isTestPayment ? "test" : "live",
        pricing_version_id: product.pricing_version_id || null,
        product_snapshot: productSnapshot,
        token_amount: product.credit_amount || 0,
        bonus_token_amount: product.bonus_credit_amount || 0,
        metadata,
      })
      .select("id")
      .single();
    if (intentResult.error || !intentResult.data) {
      throw intentResult.error || new Error("PAYMENT_INTENT_CREATE_FAILED");
    }

    try {
      const created = await requestAppsInTossPay<{ payToken: string }>({
        path: "/api-partner/v1/apps-in-toss/pay/make-payment",
        tossUserKey: context.tossUserKey,
        body: {
          orderNo,
          productDesc: safeProductDescription(`인픽 ${product.name_ko}`),
          amount,
          amountTaxFree: 0,
          cashReceipt: false,
          installment: "NOT_USE",
          isTestPayment: context.isTestPayment,
        },
      });
      if (!created.payToken) throw new Error("PAY_TOKEN_MISSING");

      const updatedMetadata = { ...metadata, appsInTossPayToken: created.payToken };
      const updated = await context.admin
        .from("payment_intents")
        .update({ status: "payment_created", metadata: updatedMetadata })
        .eq("id", intentResult.data.id);
      if (updated.error) throw updated.error;

      return json(response, 200, {
        payToken: created.payToken,
        orderNo,
        orderName: `인픽 ${product.name_ko}`,
        amount,
        testMode: context.isTestPayment,
      });
    } catch (error) {
      await context.admin
        .from("payment_intents")
        .update({ status: "create_failed" })
        .eq("id", intentResult.data.id);
      throw error;
    }
  } catch (error) {
    console.error("[inpick-toss-api/payment-create]", error);
    if (error instanceof AppsInTossPayError) {
      return json(response, error.status, { error: error.code, hint: error.message });
    }
    return json(response, 500, { error: "PAYMENT_CREATE_FAILED" });
  }
}
