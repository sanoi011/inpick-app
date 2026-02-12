import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST: Toss Payments 결제 확인
export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { paymentKey, orderId, amount, credits, userId } = body;

    if (!paymentKey || !orderId || !amount || !userId) {
      return NextResponse.json(
        { error: "필수 파라미터가 누락되었습니다." },
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
        body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
      }
    );

    if (!confirmRes.ok) {
      const errData = await confirmRes.json();
      return NextResponse.json(
        { error: errData.message || "결제 확인 실패" },
        { status: 400 }
      );
    }

    // 결제 성공 → 크레딧 충전
    const creditAmount = Number(credits) || 0;

    const { data: current } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", userId)
      .single();

    const currentBalance = current?.balance || 0;

    await supabase
      .from("user_credits")
      .upsert(
        {
          user_id: userId,
          balance: currentBalance + creditAmount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    // 트랜잭션 기록
    await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount: creditAmount,
      type: "CHARGE",
      description: `${creditAmount} 크레딧 충전 (결제 완료)`,
      metadata: { paymentKey, orderId, paidAmount: amount },
    });

    return NextResponse.json({
      success: true,
      credits: creditAmount,
      newBalance: currentBalance + creditAmount,
    });
  } catch {
    return NextResponse.json(
      { error: "결제 확인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
