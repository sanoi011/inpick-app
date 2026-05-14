import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

export async function PATCH(req: NextRequest, { params }: { params: { boardId: string } }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const allowed = [
    "slug",
    "name",
    "description",
    "board_type",
    "sort_order",
    "is_active",
    "allow_user_posts",
    "allow_comments",
    "allow_contractor_replies",
    "require_admin_approval",
  ];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) updates[k] = body[k];
  }
  // camelCase 호환
  const camelToSnake: Record<string, string> = {
    boardType: "board_type",
    sortOrder: "sort_order",
    isActive: "is_active",
    allowUserPosts: "allow_user_posts",
    allowComments: "allow_comments",
    allowContractorReplies: "allow_contractor_replies",
    requireAdminApproval: "require_admin_approval",
  };
  for (const [camel, snake] of Object.entries(camelToSnake)) {
    if (camel in body) updates[snake] = body[camel];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const { error } = await admin.from("community_boards").update(updates).eq("id", params.boardId);
  if (error) return NextResponse.json({ error: "update_failed", hint: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { boardId: string } }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });
  // 안전: 실제 DELETE 대신 is_active=false (게시판 비활성화)
  const { error } = await admin
    .from("community_boards")
    .update({ is_active: false })
    .eq("id", params.boardId);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
