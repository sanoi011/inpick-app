import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { AD_BANNER_PLACEMENTS, AD_PARTNER_STATUSES } from "@/lib/business-center";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const value = (input: unknown, max = 500) => String(input ?? "").trim().slice(0, max);
const nullable = (input: unknown, max = 500) => value(input, max) || null;

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });
  const [partnersResult, bannersResult] = await Promise.all([
    admin.from("advertising_partners").select("*").order("created_at", { ascending: false }),
    admin.from("advertising_banners").select("*, advertising_partners(company_name)").order("is_featured", { ascending: false }).order("priority", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  if (partnersResult.error) return NextResponse.json({ error: partnersResult.error.message }, { status: 500 });
  if (bannersResult.error) return NextResponse.json({ error: bannersResult.error.message }, { status: 500 });
  return NextResponse.json({ partners: partnersResult.data ?? [], banners: bannersResult.data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const entity = value(body.entity, 30);
  if (entity === "partner") {
    const companyName = value(body.companyName, 200);
    if (!companyName) return NextResponse.json({ error: "광고주명이 필요합니다." }, { status: 400 });
    const status = AD_PARTNER_STATUSES.includes(body.status) ? body.status : "lead";
    const { data, error } = await admin.from("advertising_partners").insert({
      company_name: companyName,
      business_registration_no: nullable(body.businessRegistrationNo, 20),
      contact_name: nullable(body.contactName, 100),
      contact_email: nullable(body.contactEmail, 200),
      contact_phone: nullable(body.contactPhone, 30),
      website: nullable(body.website, 1_000),
      status,
      note: nullable(body.note, 4_000),
    }).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ partner: data });
  }
  if (entity === "banner") {
    const placement = value(body.placement, 80);
    const title = value(body.title, 200);
    const targetUrl = value(body.targetUrl, 1_000);
    if (!title || !targetUrl || !AD_BANNER_PLACEMENTS.some((item) => item.value === placement)) {
      return NextResponse.json({ error: "배너 제목·링크·위치를 확인해주세요." }, { status: 400 });
    }
    const { data, error } = await admin.from("advertising_banners").insert({
      partner_id: nullable(body.partnerId, 50),
      title,
      subtitle: nullable(body.subtitle, 500),
      image_url: nullable(body.imageUrl, 1_000),
      mobile_image_url: nullable(body.mobileImageUrl, 1_000),
      target_url: targetUrl,
      alt_text: nullable(body.altText, 300),
      placement,
      priority: Math.max(-9999, Math.min(9999, Number(body.priority) || 0)),
      is_featured: Boolean(body.isFeatured),
      is_active: body.isActive !== false,
      starts_at: nullable(body.startsAt, 80),
      ends_at: nullable(body.endsAt, 80),
    }).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ banner: data });
  }
  return NextResponse.json({ error: "저장 대상을 확인해주세요." }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const entity = value(body.entity, 30);
  const id = value(body.id, 60);
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  if (entity === "partner") {
    const status = value(body.status, 30);
    if (!AD_PARTNER_STATUSES.includes(status as (typeof AD_PARTNER_STATUSES)[number])) return NextResponse.json({ error: "상태를 확인해주세요." }, { status: 400 });
    const { error } = await admin.from("advertising_partners").update({ status }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (entity === "banner") {
    const placement = value(body.placement, 80);
    if (!AD_BANNER_PLACEMENTS.some((item) => item.value === placement)) return NextResponse.json({ error: "노출 위치를 확인해주세요." }, { status: 400 });
    const { error } = await admin.from("advertising_banners").update({
      partner_id: nullable(body.partnerId, 50),
      title: value(body.title, 200),
      subtitle: nullable(body.subtitle, 500),
      image_url: nullable(body.imageUrl, 1_000),
      mobile_image_url: nullable(body.mobileImageUrl, 1_000),
      target_url: value(body.targetUrl, 1_000),
      alt_text: nullable(body.altText, 300),
      placement,
      priority: Math.max(-9999, Math.min(9999, Number(body.priority) || 0)),
      is_featured: Boolean(body.isFeatured),
      is_active: Boolean(body.isActive),
      starts_at: nullable(body.startsAt, 80),
      ends_at: nullable(body.endsAt, 80),
    }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "수정 대상을 확인해주세요." }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });
  const entity = req.nextUrl.searchParams.get("entity");
  const id = req.nextUrl.searchParams.get("id");
  if (!id || (entity !== "partner" && entity !== "banner")) return NextResponse.json({ error: "삭제 대상을 확인해주세요." }, { status: 400 });
  const table = entity === "partner" ? "advertising_partners" : "advertising_banners";
  const { error } = await admin.from(table).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
