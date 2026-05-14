/**
 * PATCH/DELETE /api/community/comments/[commentId]
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCommunityPrivacyReport } from "@/lib/inpick/community/redaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { commentId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { content?: string };
  if (!body.content?.trim()) return NextResponse.json({ error: "missing_content" }, { status: 400 });

  const cleaned = buildCommunityPrivacyReport(body.content.trim());
  const { error } = await supabase
    .from("community_comments")
    .update({ content: cleaned.cleanText })
    .eq("id", params.commentId)
    .eq("author_id", user.id);
  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { commentId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { error } = await supabase
    .from("community_comments")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq("id", params.commentId)
    .eq("author_id", user.id);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
