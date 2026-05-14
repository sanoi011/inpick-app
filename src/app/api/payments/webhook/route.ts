/**
 * POST /api/payments/webhook
 *
 * Toss Payments webhook 수신 — 결제 상태 변경 자동 동기화.
 *
 * 가이드: c:\Users\user\Downloads\inpick-auth-payment-token-admin-dev-plan-20260512.md §7-2
 *
 * 처리:
 *  1. TOSS_WEBHOOK_SECRET 검증 (없으면 dev mode)
 *  2. event_key 생성 (provider+eventType+paymentKey+status+approvedAt)
 *  3. payment_events UNIQUE insert — 중복이면 200 OK 반환
 *  4. DONE 이벤트인데 credit 누락이면 자동 보정 (idempotency_key로 중복 차단)
 *  5. CANCELED/EXPIRED이면 payment_intents/payments 상태 갱신
 *  6. 이상 상태는 payment_reconciliation_jobs 생성
 *
 * 항상 200 OK 반환 (재시도 방지) — 예외는 reconciliation_jobs로 처리.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
// P3 (2026-05-14): 단일 finalizer — PDF entitlement 분기 포함
// (기존 creditTokensAfterPayment 호출은 finalizer 내부에서 처리됨)
import { finalizePaymentProvisioning } from "@/lib/inpick/payments/finalize-provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface TossWebhookBody {
  eventType?: string;
  createdAt?: string;
  data?: {
    paymentKey?: string;
    orderId?: string;
    status?: string;
    totalAmount?: number;
    approvedAt?: string;
    method?: string;
    [k: string]: unknown;
  };
}

export async function POST(req: NextRequest) {
  // 1) Webhook secret 검증
  const secret = process.env.TOSS_WEBHOOK_SECRET;
  const headerSecret =
    req.headers.get("x-toss-signature") || req.headers.get("x-webhook-secret");
  if (secret && headerSecret !== secret) {
    console.warn("[webhook] secret mismatch");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  let body: TossWebhookBody;
  try {
    body = (await req.json()) as TossWebhookBody;
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const admin = getAdmin();
  if (!admin) {
    console.error("[webhook] admin not configured");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const { eventType, data } = body;
  if (!eventType || !data?.paymentKey || !data?.orderId) {
    console.warn("[webhook] invalid body:", body);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 2) event_key UNIQUE insert (중복 webhook 자동 차단)
  const eventKey = `toss:${eventType}:${data.paymentKey}:${data.status}:${data.approvedAt || data.orderId}`;
  const { error: insErr } = await admin
    .from("payment_events")
    .insert({
      provider: "toss",
      event_type: eventType,
      event_key: eventKey,
      order_id: data.orderId,
      payment_key: data.paymentKey,
      amount_krw: data.totalAmount,
      raw_event: body,
    })
    .select("id")
    .single();

  if (insErr && insErr.message?.includes("event_key")) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
  }

  // 3) payment_intents + payments 조회
  const { data: intent } = await admin
    .from("payment_intents")
    .select("id, user_id, amount_krw, status, product:payment_products(*)")
    .eq("order_id", data.orderId)
    .maybeSingle();
  const { data: paymentRow } = await admin
    .from("payments")
    .select("id, user_id, amount_krw, status")
    .eq("payment_key", data.paymentKey)
    .maybeSingle();

  // 4) 상태별 처리
  const status = data.status?.toUpperCase();

  if (status === "DONE" && intent) {
    const rawIntent = intent as unknown as {
      id: string;
      user_id: string;
      amount_krw: number;
      status: string;
      product:
        | { code: string; credit_amount: number; bonus_credit_amount: number; name_ko: string }
        | Array<{ code: string; credit_amount: number; bonus_credit_amount: number; name_ko: string }>
        | null;
    };
    const productObj = Array.isArray(rawIntent.product)
      ? rawIntent.product[0] || null
      : rawIntent.product;
    const intentRow = { ...rawIntent, product: productObj };

    if (intentRow.status !== "paid") {
      await admin
        .from("payment_intents")
        .update({ status: "paid" })
        .eq("id", intentRow.id);
    }

    let paymentId: string | undefined;
    if (paymentRow) {
      paymentId = (paymentRow as { id: string }).id;
    } else {
      const { data: inserted } = await admin
        .from("payments")
        .insert({
          payment_intent_id: intentRow.id,
          user_id: intentRow.user_id,
          provider: "toss",
          payment_key: data.paymentKey,
          order_id: data.orderId,
          method: data.method || null,
          amount_krw: data.totalAmount || intentRow.amount_krw,
          status: "DONE",
          approved_at: data.approvedAt || new Date().toISOString(),
          raw_payment: data,
        })
        .select("id")
        .single();
      paymentId = (inserted as { id: string } | null)?.id;
    }

    // P3: 단일 finalizer로 token_pack / pdf_entitlement 분기 처리
    // (idempotency_key로 중복 차단됨 — 이미 confirm 라우트에서 처리됐으면 no-op)
    if (paymentId) {
      const result = await finalizePaymentProvisioning(intentRow.id, paymentId);
      if (result.status === "failed" || result.status === "missing_product") {
        await admin.from("payment_reconciliation_jobs").insert({
          payment_intent_id: intentRow.id,
          payment_id: paymentId,
          order_id: data.orderId,
          payment_key: data.paymentKey,
          issue_type: "webhook_provisioning_failed",
          severity: "high",
          description_ko: result.errorMessage || "webhook provisioning 실패",
        });
      }
    }
  }

  if (status === "CANCELED" || status === "ABORTED" || status === "EXPIRED") {
    const targetStatus =
      status === "EXPIRED"
        ? "expired"
        : status === "CANCELED"
          ? "cancelled"
          : "auth_failed_returned";
    if (intent) {
      await admin
        .from("payment_intents")
        .update({ status: targetStatus })
        .eq("id", (intent as { id: string }).id);
    }
    if (paymentRow) {
      await admin
        .from("payments")
        .update({ status })
        .eq("id", (paymentRow as { id: string }).id);
    }
  }

  if (status === "PARTIAL_CANCELED" && paymentRow) {
    await admin.from("payment_reconciliation_jobs").insert({
      payment_intent_id: intent ? (intent as { id: string }).id : null,
      payment_id: (paymentRow as { id: string }).id,
      order_id: data.orderId,
      payment_key: data.paymentKey,
      issue_type: "partial_cancel_received",
      severity: "medium",
      description_ko: "Toss 부분 취소 webhook 수신 — 크레딧 차감 수동 확인 필요",
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
