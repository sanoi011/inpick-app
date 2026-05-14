/**
 * GET    /api/community/posts/[postId]
 * PATCH  /api/community/posts/[postId]
 * DELETE /api/community/posts/[postId]
 *
 * 가이드: §8-2
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mapDbPost } from "@/types/community-v2";
import { buildCommunityPrivacyReport } from "@/lib/inpick/community/redaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { postId: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("id", params.postId)
    .eq("is_deleted", false)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // 조회수 증가 (fire-and-forget)
  supabase
    .from("community_posts")
    .update({ view_count: (data as { view_count: number }).view_count + 1 })
    .eq("id", params.postId)
    .then(() => {});

  // snapshot 동봉
  const post = mapDbPost(data as Record<string, unknown>);
  let snapshot: Record<string, unknown> | null = null;
  if (post.publicSnapshotId) {
    const { data: snap } = await supabase
      .from("community_public_snapshots")
      .select("*")
      .eq("id", post.publicSnapshotId)
      .maybeSingle();
    snapshot = (snap as Record<string, unknown> | null) ?? null;
  }

  // 첨부 파일
  const { data: attachments } = await supabase
    .from("community_attachments")
    .select("*")
    .eq("post_id", params.postId)
    .eq("is_public", true)
    .order("sort_order", { ascending: true });

  return NextResponse.json({ post, snapshot, attachments: attachments ?? [] });
}

export async function PATCH(req: NextRequest, { params }: { params: { postId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  // 소유권 확인
  const { data: existing } = await supabase
    .from("community_posts")
    .select("author_id")
    .eq("id", params.postId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((existing as { author_id: string }).author_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    content?: string;
    tags?: string[];
    visibility?: "public" | "members_only";
  };

  const updates: Record<string, unknown> = {};
  if (body.title) {
    updates.title = buildCommunityPrivacyReport(body.title.trim()).cleanText;
  }
  if (body.content) {
    updates.content = buildCommunityPrivacyReport(body.content.trim()).cleanText;
  }
  if (body.tags) updates.tags = body.tags;
  if (body.visibility) updates.visibility = body.visibility;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("community_posts")
    .update(updates)
    .eq("id", params.postId);
  if (error) {
    console.error("[community/posts/:id] PATCH error:", error.message);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { postId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  // soft delete (RLS는 본인만 허용)
  const { error } = await supabase
    .from("community_posts")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
      status: "deleted",
    })
    .eq("id", params.postId)
    .eq("author_id", user.id);
  if (error) {
    console.error("[community/posts/:id] DELETE error:", error.message);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
