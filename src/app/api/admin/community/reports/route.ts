/**
 * GET   /api/admin/community/reports?status=open
 * PATCH /api/admin/community/reports { reportId, action: "resolve" | "dismiss", note? }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

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

  const status = req.nextUrl.searchParams.get("status") ?? "open";
  const { data, count } = await admin
    .from("community_reports")
    .select("*", { count: "exact" })
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);
  return NextResponse.json({ reports: data ?? [], total: count ?? 0 });
}

export async function PATCH(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as {
    reportId?: string;
    action?: "resolve" | "dismiss";
    note?: string;
  };
  if (!body.reportId || !body.action) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const status = body.action === "resolve" ? "resolved" : "dismissed";
  const { error } = await admin
    .from("community_reports")
    .update({
      status,
      handled_at: new Date().toISOString(),
      resolution_note: body.note ?? null,
    })
    .eq("id", body.reportId);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
