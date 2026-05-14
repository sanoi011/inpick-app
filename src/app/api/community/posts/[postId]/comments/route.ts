/**
 * GET  /api/community/posts/[postId]/comments
 * POST /api/community/posts/[postId]/comments { content, parentId? }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mapDbComment } from "@/types/community-v2";
import { buildCommunityPrivacyReport } from "@/lib/inpick/community/redaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { postId: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("community_comments")
    .select("*")
    .eq("post_id", params.postId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[community/posts/:id/comments] GET error:", error.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  return NextResponse.json({
    comments: (data ?? []).map((r) => mapDbComment(r as Record<string, unknown>)),
  });
}

export async function POST(req: NextRequest, { params }: { params: { postId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    content?: string;
    parentId?: string | null;
    commentType?: string;
  };
  if (!body.content?.trim()) {
    return NextResponse.json({ error: "missing_content" }, { status: 400 });
  }

  // 게시글 확인 + 댓글 허용 여부
  const { data: post } = await supabase
    .from("community_posts")
    .select("id, board_id, is_deleted")
    .eq("id", params.postId)
    .maybeSingle();
  if (!post || (post as { is_deleted: boolean }).is_deleted) {
    return NextResponse.json({ error: "post_not_found" }, { status: 404 });
  }
  const { data: bd } = await supabase
    .from("community_boards")
    .select("allow_comments")
    .eq("id", (post as { board_id: string }).board_id)
    .maybeSingle();
  if (bd && !(bd as { allow_comments: boolean }).allow_comments) {
    return NextResponse.json({ error: "comments_disabled" }, { status: 403 });
  }

  const cleaned = buildCommunityPrivacyReport(body.content.trim());

  const { data: inserted, error } = await supabase
    .from("community_comments")
    .insert({
      post_id: params.postId,
      parent_id: body.parentId ?? null,
      author_id: user.id,
      author_role: "consumer",
      content: cleaned.cleanText,
      comment_type: body.commentType ?? "comment",
    })
    .select("id")
    .single();
  if (error) {
    console.error("[community/posts/:id/comments] POST error:", error.message);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  // 댓글 카운터 증가 (fire-and-forget)
  supabase.rpc("increment_post_comment_count", { p_post_id: params.postId }).then(
    () => {},
    () => {
      // RPC 없으면 직접 update
      supabase
        .from("community_posts")
        .select("comment_count")
        .eq("id", params.postId)
        .single()
        .then(({ data }) => {
          if (data) {
            supabase
              .from("community_posts")
              .update({ comment_count: (data as { comment_count: number }).comment_count + 1 })
              .eq("id", params.postId);
          }
        });
    },
  );

  return NextResponse.json({
    commentId: (inserted as { id: string }).id,
    privacyRemoved: cleaned.report.removed,
  });
}
