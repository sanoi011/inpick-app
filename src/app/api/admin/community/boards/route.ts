/**
 * GET/POST  /api/admin/community/boards
 * PATCH/DELETE /api/admin/community/boards/[boardId]
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { mapDbBoard } from "@/types/community-v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { isAdminAuthorized } from "@/lib/admin-auth";
function checkAdmin(req: NextRequest): boolean {
  return isAdminAuthorized(req);
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
  const { data } = await admin
    .from("community_boards")
    .select("*")
    .order("sort_order", { ascending: true });
  return NextResponse.json({
    boards: (data ?? []).map((r) => mapDbBoard(r as Record<string, unknown>)),
  });
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as {
    slug?: string;
    name?: string;
    description?: string;
    boardType?: string;
    sortOrder?: number;
    allowUserPosts?: boolean;
    allowComments?: boolean;
    allowContractorReplies?: boolean;
    requireAdminApproval?: boolean;
  };
  if (!body.slug?.trim() || !body.name?.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("community_boards")
    .insert({
      slug: body.slug.trim(),
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
      board_type: body.boardType ?? "general",
      sort_order: body.sortOrder ?? 100,
      allow_user_posts: body.allowUserPosts ?? true,
      allow_comments: body.allowComments ?? true,
      allow_contractor_replies: body.allowContractorReplies ?? true,
      require_admin_approval: body.requireAdminApproval ?? false,
    })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: "insert_failed", hint: error.message }, { status: 500 });
  }
  return NextResponse.json({ board: mapDbBoard(data as Record<string, unknown>) });
}
