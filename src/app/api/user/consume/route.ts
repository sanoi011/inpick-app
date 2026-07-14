/**
 * POST /api/user/consume
 *
 * 토큰 차감 — service_role로 RLS 우회하여 user_credits 차감.
 *
 * 2026-07-07 정리: user_tokens/token_transactions/deduct_tokens RPC는 운영 DB에
 * 존재하지 않는 죽은 경로였음(매 호출 실패 라운드트립) → user_credits 단일 경로.
 * 차감은 낙관적 동시성(현재 잔액 일치 조건부 UPDATE)으로 이중차감 race 방지.
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
  feature:
    | "ai_render"
    | "image_unlock"
    | "estimate_details"
    | "ar_session"
    | "drawing_option"
    | "welcome"
    | "manual";
}

const MAX_RETRIES = 3;

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

    let lastBalance: number | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { data: cred } = await admin
        .from("user_credits")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();
      lastBalance = cred?.balance ?? null;
      if (!cred || cred.balance < amount) break;

      const newBal = cred.balance - amount;
      // 읽은 잔액과 일치할 때만 차감 — 동시 요청이 끼어들면 0행 갱신되어 재시도
      const { data: updated, error: upErr } = await admin
        .from("user_credits")
        .update({ balance: newBal })
        .eq("user_id", user.id)
        .eq("balance", cred.balance)
        .select("balance");
      if (upErr) break;
      if (!updated || updated.length === 0) continue; // race — 재시도

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

    return NextResponse.json(
      {
        success: false,
        error: "잔액 부족",
        creditsBalance: lastBalance,
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
