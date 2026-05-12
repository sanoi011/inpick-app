/**
 * POST /api/payments/confirm
 *
 * Toss 결제 승인 + INPICK 크레딧 자동 충전.
 *
 * 가이드: c:\Users\user\Downloads\inpick-auth-payment-token-admin-dev-plan-20260512.md §7-2
 *
 * 흐름:
 *  1. orderId로 payment_intents 조회 (user_id 일치 검증, amount 일치 검증)
 *  2. 이미 paid면 기존 결과 반환 (idempotent)
 *  3. Toss /v1/payments/confirm 호출 (Basic Auth)
 *  4. 응답 totalAmount 검증
 *  5. DB: payments insert + payment_intents 'paid' + payment_events insert + creditTokensAfterPayment
 *  6. 실패 시 payment_reconciliation_jobs 생성
 *
 * 중요:
 *  - frontend success redirect만으로 절대 크레딧 충전 X
 *  - 같은 paymentKey/orderId 중복 호출은 같은 결과 반환
 *  - 서버 amount 검증 (클라이언트 amount 무시)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { creditTokensAfterPayment } from "@/lib/inpick/tokens/ledger";

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

interface ConfirmBody {
  paymentKey?: string;
  orderId?: string;
  amount?: number | string;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as ConfirmBody;
  const { paymentKey, orderId } = body;
  const amountNum = Number(body.amount);
  if (!paymentKey || !orderId || !Number.isFinite(amountNum) || amountNum <= 0) {
    return NextResponse.json(
      { error: "missing_params", hint: "paymentKey/orderId/amount 필수" },
      { status: 400 },
    );
  }

  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "service not configured" }, { status: 500 });
  }

  // 1) payment_intents 조회 + user_id/amount 검증
  const { data: intent, error: intentErr } = await admin
    .from("payment_intents")
    .select("*, product:payment_products(*)")
    .eq("order_id", orderId)
    .maybeSingle();
  if (intentErr || !intent) {
    return NextResponse.json(
      { error: "order_not_found", hint: `orderId=${orderId}` },
      { status: 404 },
    );
  }
  // Supabase가 select(..., product:fk(...))를 단일 객체 또는 배열로 반환할 수 있음
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

  if (intentRow.user_id !== user.id) {
    return NextResponse.json({ error: "user_mismatch" }, { status: 403 });
  }
  if (intentRow.amount_krw !== amountNum) {
    // 결제 위조 시도 가능성 → reconciliation job
    await admin.from("payment_reconciliation_jobs").insert({
      payment_intent_id: intentRow.id,
      order_id: orderId,
      payment_key: paymentKey,
      issue_type: "amount_mismatch",
      severity: "high",
      description_ko: `클라이언트 amount=${amountNum} vs 서버 amount=${intentRow.amount_krw}`,
    });
    return NextResponse.json(
      { error: "amount_mismatch", hint: "서버 금액과 일치하지 않습니다." },
      { status: 400 },
    );
  }

  // 2) 이미 paid면 기존 결과 반환 (idempotent)
  if (intentRow.status === "paid") {
    const { data: existing } = await admin
      .from("payments")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();
    return NextResponse.json({
      success: true,
      duplicate: true,
      paymentId: (existing as { id: string } | null)?.id,
    });
  }

  // 3) Toss confirm 호출
  const secretKey = process.env.TOSS_PAYMENTS_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "toss_not_configured", hint: "TOSS_PAYMENTS_SECRET_KEY 미설정" },
      { status: 500 },
    );
  }

  // confirming 상태로 전환
  await admin
    .from("payment_intents")
    .update({ status: "confirming" })
    .eq("id", intentRow.id);

  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(secretKey + ":").toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount: amountNum }),
  });

  if (!tossRes.ok) {
    const errData = await tossRes.json().catch(() => ({}));
    console.error("[confirm] Toss reject:", errData);
    await admin
      .from("payment_intents")
      .update({ status: "confirm_failed" })
      .eq("id", intentRow.id);
    return NextResponse.json(
      { error: "toss_confirm_failed", hint: errData.message || "Toss 결제 확인 실패", details: errData },
      { status: 400 },
    );
  }
  const tossData = await tossRes.json();
  if (tossData.totalAmount !== amountNum) {
    await admin.from("payment_reconciliation_jobs").insert({
      payment_intent_id: intentRow.id,
      order_id: orderId,
      payment_key: paymentKey,
      issue_type: "toss_amount_mismatch",
      severity: "critical",
      description_ko: `Toss 응답 totalAmount=${tossData.totalAmount} vs 서버 amount=${amountNum}`,
    });
    return NextResponse.json({ error: "toss_amount_mismatch" }, { status: 400 });
  }

  // 4) payments insert (UNIQUE 위반 시 idempotent 처리)
  const { data: paymentRow, error: payErr } = await admin
    .from("payments")
    .insert({
      payment_intent_id: intentRow.id,
      user_id: user.id,
      provider: "toss",
      payment_key: paymentKey,
      order_id: orderId,
      method: tossData.method || null,
      easy_pay_provider: tossData.easyPay?.provider || null,
      amount_krw: amountNum,
      status: tossData.status || "DONE",
      approved_at: tossData.approvedAt || new Date().toISOString(),
      requested_at: tossData.requestedAt || null,
      raw_payment: tossData,
    })
    .select("id")
    .single();

  if (payErr && !payErr.message?.includes("duplicate")) {
    console.error("[confirm] payments insert fail:", payErr.message);
    await admin
      .from("payment_intents")
      .update({ status: "needs_manual_review" })
      .eq("id", intentRow.id);
    await admin.from("payment_reconciliation_jobs").insert({
      payment_intent_id: intentRow.id,
      order_id: orderId,
      payment_key: paymentKey,
      issue_type: "payment_insert_failed",
      severity: "critical",
      description_ko: payErr.message,
    });
    return NextResponse.json({ error: "payment_insert_failed" }, { status: 500 });
  }

  // duplicate handling
  let paymentId = (paymentRow as { id: string } | null)?.id;
  if (!paymentId) {
    const { data: dup } = await admin
      .from("payments")
      .select("id")
      .eq("payment_key", paymentKey)
      .maybeSingle();
    paymentId = (dup as { id: string } | null)?.id || "";
  }

  // 5) payment_intents 'paid' 상태 갱신
  await admin
    .from("payment_intents")
    .update({ status: "paid" })
    .eq("id", intentRow.id);

  // 6) payment_events insert (event_key UNIQUE) — 실패 시 무시 (재시도 안전)
  try {
    await admin
      .from("payment_events")
      .insert({
        payment_intent_id: intentRow.id,
        payment_id: paymentId,
        user_id: user.id,
        provider: "toss",
        event_type: "PAYMENT_CONFIRMED",
        event_key: `toss:confirm:${paymentKey}`,
        order_id: orderId,
        payment_key: paymentKey,
        amount_krw: amountNum,
        raw_event: tossData,
      });
  } catch {
    // UNIQUE 위반 무시
  }

  // 7) 크레딧 충전
  if (!intentRow.product) {
    await admin.from("payment_reconciliation_jobs").insert({
      payment_intent_id: intentRow.id,
      payment_id: paymentId,
      order_id: orderId,
      payment_key: paymentKey,
      issue_type: "product_missing",
      severity: "critical",
      description_ko: "결제 성공했으나 product 정보 없음 — 수동 크레딧 충전 필요",
    });
    return NextResponse.json({
      success: true,
      paymentId,
      warning: "결제는 성공했으나 크레딧 충전 보류. 관리자 확인 중.",
    });
  }

  try {
    const credit = await creditTokensAfterPayment({
      userId: user.id,
      paymentId: paymentId!,
      productCode: intentRow.product.code,
      paidCredits: intentRow.product.credit_amount,
      bonusCredits: intentRow.product.bonus_credit_amount,
      reasonKo: `${intentRow.product.name_ko} 구매`,
    });
    return NextResponse.json({
      success: true,
      paymentId,
      orderId,
      balanceAfter: credit.balanceAfter,
      creditsAdded:
        intentRow.product.credit_amount + intentRow.product.bonus_credit_amount,
    });
  } catch (err) {
    console.error("[confirm] credit fail:", err);
    await admin.from("payment_reconciliation_jobs").insert({
      payment_intent_id: intentRow.id,
      payment_id: paymentId,
      order_id: orderId,
      payment_key: paymentKey,
      issue_type: "credit_failed",
      severity: "critical",
      description_ko: err instanceof Error ? err.message : "크레딧 충전 실패",
    });
    return NextResponse.json({
      success: true,
      paymentId,
      warning: "결제 성공, 크레딧 충전 실패. 관리자가 자동 보정합니다.",
    });
  }
}
