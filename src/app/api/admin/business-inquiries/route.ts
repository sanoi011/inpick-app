import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { BUSINESS_INQUIRY_STATUSES } from "@/lib/business-center";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });
  const status = req.nextUrl.searchParams.get("status");
  let query = admin.from("business_inquiries").select("*").order("created_at", { ascending: false }).limit(300);
  if (status && BUSINESS_INQUIRY_STATUSES.includes(status as (typeof BUSINESS_INQUIRY_STATUSES)[number])) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const inquiries = (data ?? []).map((row) => ({
    id: row.id,
    inquiryType: row.inquiry_type,
    companyName: row.company_name,
    businessRegistrationNo: row.business_registration_no,
    businessAddress: row.business_address,
    contactEmail: row.contact_email,
    message: row.message,
    status: row.status,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  return NextResponse.json({ inquiries });
}

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const status = String(body.status ?? "");
  const adminNote = String(body.adminNote ?? "").trim().slice(0, 4_000);
  if (!id || !BUSINESS_INQUIRY_STATUSES.includes(status as (typeof BUSINESS_INQUIRY_STATUSES)[number])) {
    return NextResponse.json({ error: "상태값을 확인해주세요." }, { status: 400 });
  }
  const { error } = await admin.from("business_inquiries").update({ status, admin_note: adminNote || null }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
