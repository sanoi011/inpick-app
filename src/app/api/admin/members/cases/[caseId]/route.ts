/**
 * PATCH /api/admin/members/cases/[caseId]
 * 정합성 case 처리 (resolve / dismiss / in_progress)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdminAuthorized as checkAdmin, getAdminIdFromRequest } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { caseId: string } },
) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { status?: string; note?: string };
  if (!body.status || !["in_progress", "resolved", "dismissed"].includes(body.status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const adminId = getAdminIdFromRequest(req);
  const update: Record<string, unknown> = { status: body.status };
  if (body.status === "resolved" || body.status === "dismissed") {
    update.resolved_at = new Date().toISOString();
    update.resolved_by = adminId ?? "admin";
  }
  if (body.note) {
    const { data: cur } = await admin.from("member_reconciliation_cases").select("details").eq("id", params.caseId).maybeSingle();
    const details = ((cur?.details as Record<string, unknown>) ?? {});
    details.resolution_note = body.note;
    update.details = details;
  }

  const { error } = await admin.from("member_reconciliation_cases").update(update).eq("id", params.caseId);
  if (error) {
    return NextResponse.json({ error: "update_failed", hint: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
