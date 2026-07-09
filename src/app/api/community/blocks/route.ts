/**
 * 사용자 차단 API (Apple Guideline 1.2 — UGC 안전장치)
 *
 * GET    → 내가 차단한 사용자 ID 목록
 * POST   { blockedUserId } → 차단 + 운영팀 신고 자동 접수(개발사 통지 요건)
 * DELETE { blockedUserId } → 차단 해제
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ blockedUserIds: [] });

  const { data, error } = await supabase
    .from("community_user_blocks")
    .select("blocked_user_id")
    .eq("blocker_id", user.id);
  if (error) {
    console.error("[community/blocks] GET error:", error.message);
    return NextResponse.json({ blockedUserIds: [] });
  }
  return NextResponse.json({
    blockedUserIds: ((data ?? []) as Array<{ blocked_user_id: string }>).map((b) => b.blocked_user_id),
  });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { blockedUserId?: string };
  if (!body.blockedUserId) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  if (body.blockedUserId === user.id) {
    return NextResponse.json({ error: "cannot_block_self" }, { status: 400 });
  }

  const { error } = await supabase
    .from("community_user_blocks")
    .upsert(
      { blocker_id: user.id, blocked_user_id: body.blockedUserId },
      { onConflict: "blocker_id,blocked_user_id", ignoreDuplicates: true },
    );
  if (error) {
    console.error("[community/blocks] POST error:", error.message);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  // 차단 = 운영팀 통지(신고 자동 접수) — 실패해도 차단 자체는 유효
  const { error: reportErr } = await supabase.from("community_reports").insert({
    target_type: "profile",
    target_id: body.blockedUserId,
    reporter_id: user.id,
    reason: "사용자 차단",
    detail: "이용자가 이 사용자를 차단했습니다 (자동 접수 — 부적절 행위 여부 검토 요망)",
    status: "open",
  });
  if (reportErr) console.error("[community/blocks] report insert error:", reportErr.message);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { blockedUserId?: string };
  if (!body.blockedUserId) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const { error } = await supabase
    .from("community_user_blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_user_id", body.blockedUserId);
  if (error) {
    console.error("[community/blocks] DELETE error:", error.message);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
