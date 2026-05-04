/**
 * POST /api/user/consume
 *
 * 토큰 차감 — service_role로 RLS 우회하여 user_credits 또는 user_tokens 차감.
 *
 * 입력: { amount, feature }
 * 출력: { success, balance, source }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  amount: number;
  feature: "ai_render" | "ar_session" | "drawing_option" | "welcome" | "manual";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const amount = Math.max(1, Math.floor(body.amount || 1));
    const feature = body.feature || "ai_render";

    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "인증 필요" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1) RPC deduct_tokens 시도
    try {
      const { data, error } = await admin.rpc("deduct_tokens", {
        p_user_id: user.id,
        p_amount: amount,
        p_feature: feature,
      });
      if (!error && data?.success) {
        const { data: tok } = await admin
          .from("user_tokens")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle();
        return NextResponse.json({
          success: true,
          balance: tok?.balance ?? 0,
          source: "rpc_deduct_tokens",
        });
      }
    } catch {
      /* fallback */
    }

    // 2) user_credits 직접 update (옛 시스템 + RLS 우회)
    const { data: cred } = await admin
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();
    if (cred && cred.balance >= amount) {
      const newBal = cred.balance - amount;
      const { error: upErr } = await admin
        .from("user_credits")
        .update({ balance: newBal })
        .eq("user_id", user.id);
      if (!upErr) {
        await admin.from("credit_transactions").insert({
          user_id: user.id,
          amount: -amount,
          type: "USE",
          description: `토큰 사용 (${feature})`,
        });
        return NextResponse.json({
          success: true,
          balance: newBal,
          source: "user_credits",
        });
      }
    }

    // 3) user_tokens 직접 update
    const { data: tok } = await admin
      .from("user_tokens")
      .select("balance, total_used")
      .eq("user_id", user.id)
      .maybeSingle();
    if (tok && tok.balance >= amount) {
      const newBal = tok.balance - amount;
      await admin
        .from("user_tokens")
        .update({ balance: newBal, total_used: (tok.total_used ?? 0) + amount })
        .eq("user_id", user.id);
      await admin.from("token_transactions").insert({
        user_id: user.id,
        type: "use",
        feature,
        amount: -amount,
        balance_after: newBal,
      });
      return NextResponse.json({
        success: true,
        balance: newBal,
        source: "user_tokens",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "잔액 부족",
        creditsBalance: cred?.balance ?? null,
        tokensBalance: tok?.balance ?? null,
      },
      { status: 402 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
