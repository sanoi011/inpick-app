/**
 * GET  /api/community/posts?boardSlug=&postType=&page=&limit=&q=
 * POST /api/community/posts { boardSlug, title, content, postType?, tags?, visibility? }
 *
 * 가이드: §8-2
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mapDbPost } from "@/types/community-v2";
import { buildCommunityPrivacyReport } from "@/lib/inpick/community/redaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const sp = req.nextUrl.searchParams;
  const boardSlug = sp.get("boardSlug");
  const postType = sp.get("postType");
  const q = sp.get("q")?.trim();
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(sp.get("limit") ?? 20)));
  const offset = (page - 1) * limit;

  // 게시판 ID 조회 (slug 사용 시)
  let boardId: string | null = null;
  if (boardSlug) {
    const { data: bd } = await supabase
      .from("community_boards")
      .select("id")
      .eq("slug", boardSlug)
      .eq("is_active", true)
      .maybeSingle();
    if (!bd) {
      return NextResponse.json({ posts: [], total: 0, hasMore: false });
    }
    boardId = (bd as { id: string }).id;
  }

  let query = supabase
    .from("community_posts")
    .select(
      "id, board_id, author_id, author_role, title, content, status, visibility, post_type, project_mode, public_snapshot_id, region_label, area_label, building_type, business_type, tags, view_count, comment_count, like_count, bookmark_count, quote_offer_count, is_pinned, is_notice, is_deleted, converted_rfq_at, created_at, updated_at",
      { count: "exact" },
    )
    .eq("is_deleted", false)
    .in("status", ["published"])
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (boardId) query = query.eq("board_id", boardId);
  if (postType) query = query.eq("post_type", postType);
  if (q) query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);

  const { data, error, count } = await query;
  if (error) {
    console.error("[community/posts] GET error:", error.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const posts = (data ?? []).map((r) => mapDbPost(r as Record<string, unknown>));
  return NextResponse.json({
    posts,
    total: count ?? posts.length,
    hasMore: (count ?? 0) > offset + limit,
  });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    boardSlug?: string;
    title?: string;
    content?: string;
    postType?: string;
    tags?: string[];
    visibility?: "public" | "members_only";
    publicSnapshotId?: string;
    sourceProjectId?: string;
    sourceEstimateContextId?: string;
    sourceEstimateId?: string;
    regionLabel?: string;
    areaLabel?: string;
    buildingType?: string;
    businessType?: string;
    projectMode?: string;
  };

  if (!body.boardSlug || !body.title?.trim() || !body.content?.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // 게시판 검증
  const { data: board } = await supabase
    .from("community_boards")
    .select("id, allow_user_posts, require_admin_approval, board_type")
    .eq("slug", body.boardSlug)
    .eq("is_active", true)
    .maybeSingle();
  if (!board) {
    return NextResponse.json({ error: "board_not_found" }, { status: 404 });
  }
  const bd = board as { id: string; allow_user_posts: boolean; require_admin_approval: boolean; board_type: string };
  if (!bd.allow_user_posts) {
    return NextResponse.json({ error: "posts_disabled" }, { status: 403 });
  }

  // 본문 개인정보 자동 마스킹
  const titleReport = buildCommunityPrivacyReport(body.title.trim());
  const contentReport = buildCommunityPrivacyReport(body.content.trim());
  const privacyRemoved = titleReport.report.removed + contentReport.report.removed;

  const status = bd.require_admin_approval ? "pending_review" : "published";

  const { data: inserted, error: insertErr } = await supabase
    .from("community_posts")
    .insert({
      board_id: bd.id,
      author_id: user.id,
      author_role: "consumer",
      title: titleReport.cleanText,
      content: contentReport.cleanText,
      status,
      visibility: body.visibility ?? "public",
      post_type: body.postType ?? "general",
      project_mode: body.projectMode ?? null,
      public_snapshot_id: body.publicSnapshotId ?? null,
      source_project_id: body.sourceProjectId ?? null,
      source_estimate_context_id: body.sourceEstimateContextId ?? null,
      source_estimate_id: body.sourceEstimateId ?? null,
      region_label: body.regionLabel ?? null,
      area_label: body.areaLabel ?? null,
      building_type: body.buildingType ?? null,
      business_type: body.businessType ?? null,
      tags: body.tags ?? [],
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    console.error("[community/posts] POST error:", insertErr?.message);
    return NextResponse.json(
      { error: "insert_failed", hint: insertErr?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    postId: (inserted as { id: string }).id,
    status,
    privacyRemoved,
    suspiciousMatches: [
      ...titleReport.report.suspicious,
      ...contentReport.report.suspicious,
    ],
  });
}
