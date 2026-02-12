import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST: 결제 세션 생성
export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { packageId, userId } = body;

    if (!packageId || !userId) {
      return NextResponse.json(
        { error: "packageId와 userId가 필요합니다." },
        { status: 400 }
      );
    }

    // 패키지 확인
    const PACKAGES: Record<string, { credits: number; price: number; label: string }> = {
      "pkg-10": { credits: 10, price: 1000, label: "10 크레딧" },
      "pkg-50": { credits: 50, price: 4500, label: "50 크레딧" },
      "pkg-100": { credits: 100, price: 8000, label: "100 크레딧" },
      "pkg-300": { credits: 300, price: 21000, label: "300 크레딧" },
    };

    const pkg = PACKAGES[packageId];
    if (!pkg) {
      return NextResponse.json({ error: "유효하지 않은 패키지" }, { status: 400 });
    }

    const orderId = crypto.randomUUID();

    // credit_transactions에 pending 레코드
    await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount: pkg.credits,
      type: "CHARGE",
      description: `${pkg.label} 충전 (결제 대기)`,
      metadata: { orderId, packageId, price: pkg.price, status: "pending" },
    });

    // Toss Payments 키 확인
    const clientKey = process.env.TOSS_PAYMENTS_CLIENT_KEY;
    const isMockMode = !clientKey;

    if (isMockMode) {
      // Mock 모드: 바로 크레딧 충전
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
            balance: currentBalance + pkg.credits,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      // 트랜잭션 완료 기록
      await supabase.from("credit_transactions").insert({
        user_id: userId,
        amount: pkg.credits,
        type: "CHARGE",
        description: `${pkg.label} 충전 완료 (테스트 모드)`,
      });

      return NextResponse.json({
        mockMode: true,
        credits: pkg.credits,
        newBalance: currentBalance + pkg.credits,
      });
    }

    // 실제 Toss Payments 모드
    const origin = request.headers.get("origin") || "https://inpick.vercel.app";

    return NextResponse.json({
      mockMode: false,
      orderId,
      amount: pkg.price,
      orderName: `INPICK ${pkg.label}`,
      clientKey,
      successUrl: `${origin}/payments/success?orderId=${orderId}&amount=${pkg.price}&credits=${pkg.credits}`,
      failUrl: `${origin}/payments/fail`,
    });
  } catch {
    return NextResponse.json(
      { error: "결제 세션 생성 실패" },
      { status: 500 }
    );
  }
}
