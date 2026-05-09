/**
 * POST /api/user/refund
 *
 * 토큰 환불 — 클라이언트에서 timeout 등으로 응답을 못 받았을 때 명시적으로 호출.
 * server-side helper는 lib/inpick/credit-policy.ts의 refundCredits() 직접 사용.
 *
 * 입력: { amount, reason }
 * 출력: { refunded, source }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { refundCredits } from "@/lib/inpick/credit-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  amount: number;
  reason?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const amount = Math.max(1, Math.floor(body.amount || 1));
    const reason = body.reason || "client_refund";

    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "인증 필요" }, { status: 401 });
    }

    const result = await refundCredits(user.id, amount, reason);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
