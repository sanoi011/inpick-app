/**
 * GET /api/user/balance
 *
 * 인증된 사용자의 토큰 잔액 조회 — user_credits 단일 소스 (service_role, RLS 우회).
 * (user_tokens는 운영 DB에 없는 죽은 테이블이라 2026-07-07 조회 제거)
 * 행이 없으면 가입 보너스를 실지급 후 반환.
 *
 * 출력: { balance, totalUsed, totalPurchased, source: "credits"|"signup_bonus" }
 */
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNUP_BONUS = 5;

export async function GET() {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { balance: SIGNUP_BONUS, authenticated: false, source: "signup_bonus" },
        { status: 200 },
      );
    }

    const admin = createAdminClient();
    const credRes = await admin
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    const credBal = credRes.data?.balance ?? null;

    let balance: number;
    let source: "credits" | "signup_bonus";
    if (credBal != null) {
      balance = credBal;
      source = "credits";
    } else {
      // 유령 보너스 수정(2026-07-07): 기존엔 표시만 5로 하고 실제 지급이 없어
      // 신규 유저가 첫 소비에서 402를 맞았음 → 첫 조회 시 user_credits에 실지급.
      const { data: inserted } = await admin
        .from("user_credits")
        .upsert(
          { user_id: user.id, balance: SIGNUP_BONUS, free_generations_used: 0 },
          { onConflict: "user_id", ignoreDuplicates: true },
        )
        .select("user_id");
      if (inserted && inserted.length > 0) {
        await admin.from("credit_transactions").insert({
          user_id: user.id,
          type: "CHARGE",
          amount: SIGNUP_BONUS,
          description: "가입 보너스 토큰",
        });
      }
      balance = SIGNUP_BONUS;
      source = "signup_bonus";
    }

    return NextResponse.json({
      authenticated: true,
      userId: user.id,
      balance,
      totalUsed: 0, // 누적 통계는 credit_transactions 집계로 추후 제공
      totalPurchased: 0,
      tokensTableBalance: null,
      creditsTableBalance: credBal,
      source,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
