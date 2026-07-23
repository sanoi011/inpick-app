import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AppsInTossIapError,
  getAppsInTossIapOrderStatus,
  isAppsInTossOrderId,
} from "../lib/apps-in-toss-iap.js";
import {
  AppsInTossPayError,
  getAppsInTossPaymentContext,
} from "../lib/apps-in-toss-pay.js";
import { applyCors, json } from "../lib/http.js";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  applyCors(response);
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") {
    return json(response, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  const rawOrderIds: unknown[] = Array.isArray(request.body?.orderIds)
    ? request.body.orderIds
    : [];
  const orderIds: string[] = [
    ...new Set<string>(
      rawOrderIds.map((value: unknown) => String(value).trim()),
    ),
  ];
  if (
    orderIds.length === 0 ||
    orderIds.length > 50 ||
    orderIds.some((orderId) => !isAppsInTossOrderId(orderId))
  ) {
    return json(response, 400, { error: "INVALID_IAP_RECONCILE_REQUEST" });
  }

  try {
    const context = await getAppsInTossPaymentContext(request);
    let refunded = 0;
    let unchanged = 0;
    let missing = 0;

    for (const orderId of orderIds) {
      const trackedResult = await context.admin
        .from("apps_in_toss_iap_orders")
        .select("order_id, user_id, payment_intent_id, payment_id, status, sku")
        .eq("order_id", orderId)
        .eq("user_id", context.user.id)
        .maybeSingle();
      if (trackedResult.error) throw trackedResult.error;
      if (!trackedResult.data) {
        missing += 1;
        continue;
      }

      const remoteOrder = await getAppsInTossIapOrderStatus({
        orderId,
        tossUserKey: context.tossUserKey,
      });
      if (remoteOrder.sku !== trackedResult.data.sku) {
        throw new AppsInTossIapError(
          "IAP_ORDER_MISMATCH",
          "환불 주문의 SKU가 인픽 주문 기록과 일치하지 않습니다.",
          409,
        );
      }
      if (remoteOrder.status !== "REFUNDED") {
        unchanged += 1;
        continue;
      }

      const paymentId = trackedResult.data.payment_id as string | null;
      const paymentIntentId = trackedResult.data.payment_intent_id as string | null;
      await context.admin
        .from("apps_in_toss_iap_orders")
        .update({
          status: "refunded",
          remote_status: "REFUNDED",
          raw_status: remoteOrder,
          last_error: null,
        })
        .eq("order_id", orderId)
        .eq("user_id", context.user.id);
      if (paymentId) {
        await context.admin
          .from("payments")
          .update({
            status: "REFUNDED",
            raw_payment: remoteOrder,
          })
          .eq("id", paymentId)
          .eq("user_id", context.user.id);
      }
      if (paymentIntentId) {
        await context.admin
          .from("payment_intents")
          .update({ status: "refunded" })
          .eq("id", paymentIntentId)
          .eq("user_id", context.user.id);
      }
      await context.admin.from("payment_events").upsert(
        {
          payment_intent_id: paymentIntentId,
          payment_id: paymentId,
          user_id: context.user.id,
          provider: "apps_in_toss_iap",
          event_type: "ORDER_REFUNDED",
          event_key: `apps-in-toss-iap:refunded:${orderId}`,
          order_id: orderId,
          payment_key: `iap:${orderId}`,
          raw_event: remoteOrder,
        },
        { onConflict: "provider,event_key", ignoreDuplicates: true },
      );

      const existingJob = await context.admin
        .from("payment_reconciliation_jobs")
        .select("id")
        .eq("order_id", orderId)
        .eq("issue_type", "apps_in_toss_iap_refund_review")
        .eq("status", "open")
        .maybeSingle();
      if (!existingJob.data) {
        await context.admin.from("payment_reconciliation_jobs").insert({
          payment_intent_id: paymentIntentId,
          payment_id: paymentId,
          order_id: orderId,
          payment_key: `iap:${orderId}`,
          issue_type: "apps_in_toss_iap_refund_review",
          severity: "high",
          description_ko:
            "앱마켓 환불 완료. 사용/소진 상태를 확인한 뒤 토큰 또는 권한 회수 처리 필요",
        });
      }
      refunded += 1;
    }

    return json(response, 200, {
      success: true,
      refunded,
      unchanged,
      missing,
    });
  } catch (error) {
    console.error("[inpick-toss-api/iap-reconcile]", error);
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
    return json(response, 500, { error: "IAP_RECONCILE_FAILED" });
  }
}
