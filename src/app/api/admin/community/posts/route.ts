/**
 * GET   /api/admin/community/posts?status=&boardId=&page=&limit=
 * PATCH /api/admin/community/posts (관리자 일괄 처리 — bulk 미지원, 개별 PATCH 사용)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { mapDbPost } from "@/types/community-v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkAdmin(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const expected = process.env.ADMIN_PASSWORD;
  return !!auth && !!expected && auth === `Bearer ${expected}`;
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const boardId = sp.get("boardId");
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(sp.get("limit") ?? 20)));
  const offset = (page - 1) * limit;

  let query = admin
    .from("community_posts")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (status) query = query.eq("status", status);
  if (boardId) query = query.eq("board_id", boardId);

  const { data, count } = await query;
  return NextResponse.json({
    posts: (data ?? []).map((r) => mapDbPost(r as Record<string, unknown>)),
    total: count ?? 0,
  });
}

export async function PATCH(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as {
    postId?: string;
    action?: "hide" | "delete" | "restore" | "pin" | "unpin";
    reason?: string;
  };
  if (!body.postId || !body.action) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  switch (body.action) {
    case "hide":
      updates.status = "hidden";
      break;
    case "delete":
      updates.is_deleted = true;
      updates.status = "deleted";
      updates.deleted_at = new Date().toISOString();
      break;
    case "restore":
      updates.is_deleted = false;
      updates.status = "published";
      updates.deleted_at = null;
      break;
    case "pin":
      updates.is_pinned = true;
      break;
    case "unpin":
      updates.is_pinned = false;
      break;
  }

  const { data: before } = await admin
    .from("community_posts")
    .select("*")
    .eq("id", body.postId)
    .maybeSingle();
  const { error } = await admin.from("community_posts").update(updates).eq("id", body.postId);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  // moderation log
  await admin.from("community_moderation_actions").insert({
    target_type: "post",
    target_id: body.postId,
    action: body.action,
    reason: body.reason ?? null,
    before_state: before,
    after_state: updates,
  });

  return NextResponse.json({ ok: true });
}
