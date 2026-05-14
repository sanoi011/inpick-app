/**
 * GET /api/community/boards
 *
 * 활성 게시판 목록 (public read).
 * 가이드: inpick-community-naver-cafe-style-dev-plan-20260514.md §8-1
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mapDbBoard } from "@/types/community-v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("community_boards")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[community/boards] GET error:", error.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  return NextResponse.json({
    boards: (data ?? []).map((r) => mapDbBoard(r as Record<string, unknown>)),
  });
}
