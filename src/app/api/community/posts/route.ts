/**
 * GET  /api/community/posts?boardSlug=&postType=&page=&limit=&q=&scope=
 *   scope=home → 서비스 피드백·사업자 게시판 제외한 통합 피드
 *   응답 posts[]에 attachments/author/likedByMe/estimateSummary 포함 (피드 렌더용)
 * POST /api/community/posts { boardSlug, title, content, imageUrls?, attachProjectId?, ... }
 *   imageUrls: /api/community/upload로 올린 이미지 → community_attachments(type image)
 *   attachProjectId: 내 AI 프로젝트 첨부 → 스냅샷 + design_output 첨부 자동 생성
 *
 * 가이드: §8-2 + 커뮤니티 v2(2026-07-04)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { mapDbPost } from "@/types/community-v2";
import { buildCommunityPrivacyReport } from "@/lib/inpick/community/redaction";
import { fetchProjectCard } from "@/lib/inpick/community/project-attach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGES_PER_POST = 10;
/** 홈 피드에서 제외할 게시판 (서비스 피드백은 전용 탭, pro-*는 사업자 라운지) */
const HOME_EXCLUDED_SLUGS = ["service-feedback", "pro-lounge", "pro-knowhow", "pro-materials", "pro-jobs"];

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const sp = req.nextUrl.searchParams;
  const boardSlug = sp.get("boardSlug");
  const postType = sp.get("postType");
  const q = sp.get("q")?.trim();
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(sp.get("limit") ?? 20)));
  const offset = (page - 1) * limit;

  const scope = sp.get("scope"); // home | null

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

  // scope=home → 제외 게시판 ID 목록
  let excludedBoardIds: string[] = [];
  if (scope === "home" && !boardId) {
    const { data: ex } = await supabase
      .from("community_boards")
      .select("id, slug")
      .in("slug", HOME_EXCLUDED_SLUGS);
    excludedBoardIds = ((ex ?? []) as Array<{ id: string }>).map((b) => b.id);
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
  if (excludedBoardIds.length > 0) query = query.not("board_id", "in", `(${excludedBoardIds.join(",")})`);
  if (postType) query = query.eq("post_type", postType);
  if (q) query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);

  const { data, error, count } = await query;
  if (error) {
    console.error("[community/posts] GET error:", error.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const posts = (data ?? []).map((r) => mapDbPost(r as Record<string, unknown>));

  // ── 피드 렌더용 보강: 첨부·작성자·좋아요·견적요약 (실패해도 목록은 반환) ──
  const postIds = posts.map((p) => p.id);
  const authorIds = Array.from(new Set(posts.map((p) => p.authorId).filter(Boolean)));
  const snapshotIds = Array.from(
    new Set(posts.map((p) => p.publicSnapshotId).filter(Boolean)),
  ) as string[];

  const attachmentsByPost: Record<string, Array<{ type: string; url: string; thumbnailUrl: string | null }>> = {};
  const authorsById: Record<string, { displayName: string; avatarUrl: string | null }> = {};
  const estimateBySnapshot: Record<string, unknown> = {};
  let likedSet = new Set<string>();

  if (postIds.length > 0) {
    const [attachRes, profileRes, snapRes] = await Promise.all([
      supabase
        .from("community_attachments")
        .select("post_id, attachment_type, url, thumbnail_url, sort_order")
        .in("post_id", postIds)
        .eq("is_public", true)
        .order("sort_order", { ascending: true }),
      authorIds.length > 0
        ? supabase
            .from("community_profiles")
            .select("user_id, display_name, avatar_url")
            .in("user_id", authorIds)
        : Promise.resolve({ data: [] }),
      snapshotIds.length > 0
        ? supabase
            .from("community_public_snapshots")
            .select("id, redacted_estimate_summary")
            .in("id", snapshotIds)
        : Promise.resolve({ data: [] }),
    ]);
    for (const a of ((attachRes.data ?? []) as Array<{ post_id: string; attachment_type: string; url: string; thumbnail_url: string | null }>)) {
      (attachmentsByPost[a.post_id] ??= []).push({
        type: a.attachment_type,
        url: a.url,
        thumbnailUrl: a.thumbnail_url,
      });
    }
    for (const pr of ((profileRes.data ?? []) as Array<{ user_id: string; display_name: string | null; avatar_url: string | null }>)) {
      authorsById[pr.user_id] = {
        displayName: pr.display_name || "인픽 이웃",
        avatarUrl: pr.avatar_url,
      };
    }
    for (const s of ((snapRes.data ?? []) as Array<{ id: string; redacted_estimate_summary: unknown }>)) {
      estimateBySnapshot[s.id] = s.redacted_estimate_summary;
    }

    // 좋아요 여부 (테이블 미생성/미로그인 시 조용히 스킵)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: likes } = await supabase
          .from("community_post_likes")
          .select("post_id")
          .in("post_id", postIds)
          .eq("user_id", user.id);
        likedSet = new Set(((likes ?? []) as Array<{ post_id: string }>).map((l) => l.post_id));
      }
    } catch {
      /* community_post_likes 미생성 환경 — 무시 */
    }
  }

  const enriched = posts.map((p) => ({
    ...p,
    attachments: attachmentsByPost[p.id] ?? [],
    author: (p.authorId ? authorsById[p.authorId] : undefined) ?? { displayName: "인픽 이웃", avatarUrl: null },
    likedByMe: likedSet.has(p.id),
    estimateSummary: p.publicSnapshotId ? estimateBySnapshot[p.publicSnapshotId] ?? null : null,
  }));

  return NextResponse.json({
    posts: enriched,
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
    /** v2: 업로드된 이미지 URL 목록 (/api/community/upload 결과) */
    imageUrls?: string[];
    /** v2: 내 AI 프로젝트 첨부 */
    attachProjectId?: string;
  };

  // v2 피드 컴포저는 제목 없이 본문만 — 본문 첫 줄로 제목 자동 생성
  const rawContent = body.content?.trim() ?? "";
  const rawTitle =
    body.title?.trim() ||
    rawContent.split("\n")[0]?.slice(0, 80) ||
    "";
  if (!body.boardSlug || !rawTitle || !rawContent) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const imageUrls = (body.imageUrls ?? []).filter((u) => typeof u === "string" && u.startsWith("http")).slice(0, MAX_IMAGES_PER_POST);

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
  const titleReport = buildCommunityPrivacyReport(rawTitle);
  const contentReport = buildCommunityPrivacyReport(rawContent);
  const privacyRemoved = titleReport.report.removed + contentReport.report.removed;

  const status = bd.require_admin_approval ? "pending_review" : "published";

  // ── 프로젝트 첨부 준비 (본문 insert 전에 카드 데이터 확보 — 소유권 검증 포함) ──
  const admin = getAdmin();
  let projectCard: Awaited<ReturnType<typeof fetchProjectCard>> = null;
  let snapshotId: string | null = body.publicSnapshotId ?? null;
  if (body.attachProjectId && admin) {
    projectCard = await fetchProjectCard(admin, user.id, body.attachProjectId);
    if (!projectCard) {
      return NextResponse.json({ error: "project_not_found_or_forbidden" }, { status: 403 });
    }
    // 상세 페이지(Snapshot 타입)와 호환되는 형태로 저장
    const total = projectCard.estimateTotal;
    const { data: snap, error: snapErr } = await admin
      .from("community_public_snapshots")
      .insert({
        owner_id: user.id,
        source_project_id: projectCard.projectId,
        snapshot_type: "design_share",
        project_mode: projectCard.projectMode ?? "apartment",
        redacted_project: {
          regionLabel: projectCard.regionLabel,
          areaLabel: projectCard.areaLabel,
          areaM2: null,
          expansionLabel: null,
          rooms: [],
          scope: [],
        },
        redacted_design_outputs: projectCard.images.map((img, i) => ({
          id: `attach-${i}`,
          imageUrl: img.url,
          targetLabel: img.label,
        })),
        redacted_estimate_summary: {
          totalAmount: total,
          totalAmountRangeLabel: total != null ? `약 ${Math.round(total / 10_000).toLocaleString()}만원` : null,
          precisionLevel: null,
          lineCount: 0,
          tradeCount: 0,
        },
        privacy_report: { source: "community_v2_attach", removedFields: [], autoScanPassed: true },
        visibility_options: { showDesignImages: true, showTotalAmount: total != null },
      })
      .select("id")
      .single();
    if (snapErr || !snap) {
      console.error("[community/posts] snapshot insert failed:", snapErr?.message);
      return NextResponse.json({ error: "snapshot_failed" }, { status: 500 });
    }
    snapshotId = (snap as { id: string }).id;
  }

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
      post_type: projectCard ? "design_share" : body.postType ?? "general",
      project_mode: projectCard?.projectMode ?? body.projectMode ?? null,
      public_snapshot_id: snapshotId,
      source_project_id: projectCard?.projectId ?? body.sourceProjectId ?? null,
      source_estimate_context_id: body.sourceEstimateContextId ?? null,
      source_estimate_id: body.sourceEstimateId ?? null,
      region_label: projectCard?.regionLabel ?? body.regionLabel ?? null,
      area_label: projectCard?.areaLabel ?? body.areaLabel ?? null,
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
  const postId = (inserted as { id: string }).id;

  // ── 첨부 insert (이미지 업로드 + 프로젝트 디자인 이미지) — 실패해도 게시글은 유지 ──
  const attachRows: Array<Record<string, unknown>> = [];
  imageUrls.forEach((url, i) => {
    attachRows.push({
      post_id: postId,
      uploader_id: user.id,
      attachment_type: "image",
      url,
      thumbnail_url: url,
      is_public: true,
      sort_order: i,
    });
  });
  (projectCard?.images ?? []).slice(0, 8).forEach((img, i) => {
    attachRows.push({
      post_id: postId,
      uploader_id: user.id,
      attachment_type: "design_output",
      url: img.url,
      thumbnail_url: img.url,
      is_public: true,
      sort_order: 100 + i,
    });
  });
  if (attachRows.length > 0) {
    const client = admin ?? supabase;
    const { error: attachErr } = await client.from("community_attachments").insert(attachRows);
    if (attachErr) console.error("[community/posts] attachments insert failed:", attachErr.message);
  }

  return NextResponse.json({
    postId,
    status,
    privacyRemoved,
    attachedImages: imageUrls.length,
    attachedProject: projectCard ? projectCard.projectId : null,
    suspiciousMatches: [
      ...titleReport.report.suspicious,
      ...contentReport.report.suspicious,
    ],
  });
}
