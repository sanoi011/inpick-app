import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST: Toss Payments 결제 확인
export async function POST(request: NextRequest) {
  const supabase = createClient();

  // 소비자 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { paymentKey, orderId, amount, credits } = body;
    const userId = user.id;

    if (!paymentKey || !orderId || !amount || !credits) {
      return NextResponse.json(
        { error: "필수 파라미터가 누락되었습니다." },
        { status: 400 }
      );
    }

    const amountNum = Number(amount);
    const creditsNum = Number(credits);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: "결제 금액이 유효하지 않습니다." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(creditsNum) || creditsNum <= 0) {
      return NextResponse.json(
        { error: "크레딧 수량이 유효하지 않습니다." },
        { status: 400 }
      );
    }

    const secretKey = process.env.TOSS_PAYMENTS_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: "결제 키가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // Toss Payments 결제 확인 API 호출
    const confirmRes = await fetch(
      "https://api.tosspayments.com/v1/payments/confirm",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(secretKey + ":").toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentKey, orderId, amount: amountNum }),
      }
    );

    if (!confirmRes.ok) {
      const errData = await confirmRes.json();
      return NextResponse.json(
        { error: errData.message || "결제 확인 실패" },
        { status: 400 }
      );
    }

    // Toss 응답에서 실제 결제 금액 검증
    const confirmData = await confirmRes.json();
    const paidAmount = confirmData.totalAmount;
    if (paidAmount !== amountNum) {
      return NextResponse.json(
        { error: "결제 금액이 일치하지 않습니다." },
        { status: 400 }
      );
    }

    // 결제 성공 → 크레딧 충전
    const creditAmount = creditsNum;

    // 중복 결제 확인 (orderId 기반 멱등성)
    const { data: existing } = await supabase
      .from("credit_transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "CHARGE")
      .contains("metadata", { orderId })
      .single();

    if (existing) {
      // 이미 처리된 결제 → 성공 응답 (멱등성)
      const { data: cur } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .single();
      return NextResponse.json({
        success: true,
        credits: creditAmount,
        newBalance: cur?.balance || 0,
        duplicate: true,
      });
    }

    // 트랜잭션 기록 먼저 (중복 방지 기준)
    await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount: creditAmount,
      type: "CHARGE",
      description: `${creditAmount} 크레딧 충전 (결제 완료)`,
      metadata: { paymentKey, orderId, paidAmount: amount },
    });

    // 크레딧 잔액 업데이트
    const { data: current } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", userId)
      .single();

    const newBalance = (current?.balance || 0) + creditAmount;

    await supabase
      .from("user_credits")
      .upsert(
        {
          user_id: userId,
          balance: newBalance,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    return NextResponse.json({
      success: true,
      credits: creditAmount,
      newBalance,
    });
  } catch (err) {
    console.error("Payment confirm error:", err);
    return NextResponse.json(
      { error: "결제 확인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
