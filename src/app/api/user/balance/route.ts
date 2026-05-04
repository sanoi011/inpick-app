/**
 * GET /api/user/balance
 *
 * 인증된 사용자의 토큰 잔액 조회.
 * - user_tokens + user_credits 둘 다 service_role로 조회 (RLS 우회)
 * - 큰 값 사용 (옛 시스템 잔액 보존)
 *
 * 출력: { balance, totalUsed, totalPurchased, source: "tokens"|"credits"|"merged"|"signup_bonus" }
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
    const [tokRes, credRes] = await Promise.all([
      admin
        .from("user_tokens")
        .select("balance, total_purchased, total_used")
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("user_credits")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const tokBal = tokRes.data?.balance ?? null;
    const credBal = credRes.data?.balance ?? null;

    let balance: number;
    let source: "tokens" | "credits" | "merged" | "signup_bonus";
    if (tokBal != null && credBal != null) {
      balance = Math.max(tokBal, credBal);
      source = "merged";
    } else if (tokBal != null) {
      balance = tokBal;
      source = "tokens";
    } else if (credBal != null) {
      balance = credBal;
      source = "credits";
    } else {
      balance = SIGNUP_BONUS;
      source = "signup_bonus";
    }

    return NextResponse.json({
      authenticated: true,
      userId: user.id,
      balance,
      totalUsed: tokRes.data?.total_used ?? 0,
      totalPurchased: tokRes.data?.total_purchased ?? 0,
      tokensTableBalance: tokBal,
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
