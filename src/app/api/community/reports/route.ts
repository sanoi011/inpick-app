/**
 * POST /api/community/reports { targetType, targetId, reason, detail? }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    targetType?: "post" | "comment" | "quote_offer" | "profile";
    targetId?: string;
    reason?: string;
    detail?: string;
  };
  if (!body.targetType || !body.targetId || !body.reason?.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const { error } = await supabase.from("community_reports").insert({
    target_type: body.targetType,
    target_id: body.targetId,
    reporter_id: user.id,
    reason: body.reason.trim(),
    detail: body.detail ?? null,
    status: "open",
  });
  if (error) {
    console.error("[community/reports] POST error:", error.message);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
