/**
 * GET   /api/admin/reconciliation/cases?status=&caseType=&page=
 * PATCH /api/admin/reconciliation/cases { caseId, action: "resolve" | "dismiss", note? }
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

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? "open";
  const caseType = sp.get("caseType");
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit") ?? 50)));

  let query = admin
    .from("reconciliation_cases")
    .select("*", { count: "exact" })
    .order("severity", { ascending: false }) // critical 먼저
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status !== "all") query = query.eq("status", status);
  if (caseType) query = query.eq("case_type", caseType);

  const { data, count } = await query;
  return NextResponse.json({ cases: data ?? [], total: count ?? 0 });
}

export async function PATCH(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as {
    caseId?: string;
    action?: "resolve" | "dismiss";
    note?: string;
  };
  if (!body.caseId || !body.action) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const status = body.action === "resolve" ? "resolved" : "dismissed";
  const { error } = await admin
    .from("reconciliation_cases")
    .update({
      status,
      resolved_at: new Date().toISOString(),
      resolution_note: body.note ?? null,
    })
    .eq("id", body.caseId);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
