/**
 * POST /api/payments/refund
 *
 * 결제 환불 — 사용자 요청 또는 관리자 처리.
 *
 * 가이드: c:\Users\user\Downloads\inpick-auth-payment-token-admin-dev-plan-20260512.md §7-2
 *
 * 정책:
 *  - 사용자: 미사용 paid 크레딧만 환불 가능
 *  - 관리자: Toss cancel API 호출 + token_ledger debit
 *  - 무료/보너스 크레딧 환불 X
 *  - 이미 사용된 정상 결과 환불 X (자동 — 사용자가 paid_balance < amount)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { debitTokensForPaymentRefund } from "@/lib/inpick/tokens/ledger";
import { isAdminAuthorized } from "@/lib/admin-auth";

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

interface RefundBody {
  paymentId?: string;
  reason?: string;
  amountKrw?: number; // 부분 환불 시 (생략 시 전액)
  refundType?: "full" | "partial";
  // 관리자 호출 시 actorAdminId
  isAdmin?: boolean;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 관리자 / 사용자 인증 분기 — 관리자는 실제 토큰 검증(단순 Bearer 존재 확인은 IDOR)
  const isAdminRequest = isAdminAuthorized(req);
  if (!user && !isAdminRequest) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as RefundBody;
  if (!body.paymentId || !body.reason) {
    return NextResponse.json(
      { error: "missing_params", hint: "paymentId, reason 필수" },
      { status: 400 },
    );
  }

  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "service not configured" }, { status: 500 });
  }

  // 1) payment 조회
  const { data: payment } = await admin
    .from("payments")
    .select(
      "id, user_id, payment_key, order_id, amount_krw, status, payment_intent_id",
    )
    .eq("id", body.paymentId)
    .maybeSingle();
  if (!payment) {
    return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
  }
  const p = payment as {
    id: string;
    user_id: string;
    payment_key: string;
    order_id: string;
    amount_krw: number;
    status: string;
    payment_intent_id: string;
  };

  // 2) 권한 검증 — 본인 또는 관리자
  if (user && p.user_id !== user.id && !isAdminRequest) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (p.status !== "DONE") {
    return NextResponse.json(
      { error: "not_refundable", hint: `status=${p.status}` },
      { status: 400 },
    );
  }

  const refundAmount = body.amountKrw ?? p.amount_krw;
  if (refundAmount <= 0 || refundAmount > p.amount_krw) {
    return NextResponse.json(
      { error: "invalid_refund_amount" },
      { status: 400 },
    );
  }

  // 3) 사용자 요청 — 미사용 paid 크레딧 검증
  if (!isAdminRequest && user) {
    const { data: wallet } = await admin
      .from("token_wallets")
      .select("paid_balance")
      .eq("user_id", user.id)
      .maybeSingle();
    const paidBalance = (wallet as { paid_balance: number } | null)?.paid_balance ?? 0;
    // 결제 1건당 크레딧 비율로 계산 — 임시: paid_balance가 결제 시 충전한 크레딧 이상이어야
    if (paidBalance <= 0) {
      return NextResponse.json(
        {
          error: "no_refundable_credits",
          hint: "사용 가능한 paid 크레딧이 없어 환불할 수 없습니다.",
        },
        { status: 400 },
      );
    }
  }

  // 4) refund row insert (requested)
  const { data: refundRow, error: refundErr } = await admin
    .from("payment_refunds")
    .insert({
      payment_id: p.id,
      user_id: p.user_id,
      provider: "toss",
      refund_type: refundAmount === p.amount_krw ? "full" : "partial",
      amount_krw: refundAmount,
      status: "requested",
      reason_ko: body.reason,
      requested_by: user?.id || null,
    })
    .select("id")
    .single();
  if (refundErr || !refundRow) {
    return NextResponse.json({ error: "refund_insert_failed" }, { status: 500 });
  }
  const refundId = (refundRow as { id: string }).id;

  // 5) 관리자만 즉시 Toss cancel API 호출. 사용자 요청은 admin 승인 대기.
  if (!isAdminRequest) {
    return NextResponse.json({
      ok: true,
      refundId,
      status: "requested",
      message: "환불 신청이 접수되었습니다. 관리자 검토 후 처리됩니다.",
    });
  }

  // 관리자 즉시 처리
  const secretKey = process.env.TOSS_PAYMENTS_SECRET_KEY;
  if (!secretKey) {
    await admin
      .from("payment_refunds")
      .update({ status: "rejected" })
      .eq("id", refundId);
    return NextResponse.json({ error: "toss_not_configured" }, { status: 500 });
  }

  // Mock 결제는 Toss API 호출 안 함
  const isMock = p.payment_key.startsWith("mock_");
  let tossResp: Record<string, unknown> | null = null;
  if (!isMock) {
    const cancelRes = await fetch(
      `https://api.tosspayments.com/v1/payments/${p.payment_key}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(secretKey + ":").toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cancelReason: body.reason,
          ...(refundAmount !== p.amount_krw && { cancelAmount: refundAmount }),
        }),
      },
    );
    if (!cancelRes.ok) {
      const err = await cancelRes.json().catch(() => ({}));
      await admin
        .from("payment_refunds")
        .update({ status: "rejected", toss_cancel_response: err })
        .eq("id", refundId);
      return NextResponse.json(
        { error: "toss_cancel_failed", details: err },
        { status: 400 },
      );
    }
    tossResp = await cancelRes.json();
  }

  // 6) 크레딧 차감
  try {
    // 크레딧 차감 비율 — 결제금액 대비 환불금액 비율로 paid_credits 차감
    const { data: intent } = await admin
      .from("payment_intents")
      .select("product:payment_products(credit_amount)")
      .eq("id", p.payment_intent_id)
      .maybeSingle();
    const rawProduct = intent
      ? (intent as unknown as {
          product: { credit_amount: number } | Array<{ credit_amount: number }> | null;
        }).product
      : null;
    const productObj = Array.isArray(rawProduct) ? rawProduct[0] || null : rawProduct;
    const creditPortion = productObj?.credit_amount || 0;
    const debitAmount = Math.floor(
      (creditPortion * refundAmount) / p.amount_krw,
    );

    if (debitAmount > 0) {
      await debitTokensForPaymentRefund({
        userId: p.user_id,
        refundId,
        paymentId: p.id,
        amount: debitAmount,
        reasonKo: `환불: ${body.reason}`,
      });
    }

    // payments + refund 상태 갱신
    await admin
      .from("payments")
      .update({
        status: refundAmount === p.amount_krw ? "CANCELED" : "PARTIAL_CANCELED",
      })
      .eq("id", p.id);
    await admin
      .from("payment_refunds")
      .update({
        status: "completed",
        credit_debit_amount: debitAmount,
        toss_cancel_response: tossResp || { mock: true },
        approved_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq("id", refundId);
    await admin
      .from("payment_intents")
      .update({
        status: refundAmount === p.amount_krw ? "refunded" : "partial_refunded",
      })
      .eq("id", p.payment_intent_id);

    return NextResponse.json({
      ok: true,
      refundId,
      status: "completed",
      refundedKrw: refundAmount,
      creditDebited: debitAmount,
    });
  } catch (err) {
    console.error("[refund] credit debit fail:", err);
    await admin.from("payment_reconciliation_jobs").insert({
      payment_id: p.id,
      order_id: p.order_id,
      payment_key: p.payment_key,
      issue_type: "refund_debit_failed",
      severity: "high",
      description_ko: err instanceof Error ? err.message : "환불 크레딧 차감 실패",
    });
    return NextResponse.json(
      {
        ok: true,
        warning: "환불 완료, 크레딧 차감 실패 — 관리자 보정 큐 등록",
      },
      { status: 200 },
    );
  }
}
