/**
 * /api/admin/partial-leads — 부분시공 설치 리드 (관리자)
 *  GET  : partial_install_requests 목록 + 각 리드의 지역 기반 사업자 자동매칭 후보
 *  PATCH: 리드 상태 변경 { id, status }  (new|contacted|matched|closed)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["new", "contacted", "matched", "closed"];

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const tokens = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .split(/[\s,/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

type Contractor = {
  id: string;
  company_name: string;
  region: string | null;
  contractor_type: string | null;
  rating: number | null;
  total_reviews: number | null;
  is_verified: boolean | null;
  is_featured: boolean | null;
  contractor_trades?: Array<{ trade_code?: string; trade_name?: string }>;
};

function matchContractors(leadRegion: string | null, contractors: Contractor[]) {
  const lt = tokens(leadRegion);
  return contractors
    .map((c) => {
      const ct = tokens(c.region);
      const regionHit = lt.some((a) => ct.some((b) => a === b || a.includes(b) || b.includes(a)));
      let score = 0;
      if (regionHit) score += 100;
      if (c.is_verified) score += 20;
      if (c.is_featured) score += 8;
      score += Math.min(10, (c.rating ?? 0) * 2);
      return { c, score, regionHit };
    })
    .filter((x) => x.regionHit) // 지역 매칭만 후보로
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((x) => ({
      id: x.c.id,
      companyName: x.c.company_name,
      region: x.c.region,
      type: x.c.contractor_type,
      rating: x.c.rating,
      reviews: x.c.total_reviews,
      isVerified: !!x.c.is_verified,
      trades: (x.c.contractor_trades ?? []).map((t) => t.trade_name).filter(Boolean),
    }));
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const status = req.nextUrl.searchParams.get("status");

  let q = admin
    .from("partial_install_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && STATUSES.includes(status)) q = q.eq("status", status);

  const { data: leads, error } = await q;
  if (error) {
    console.error("[admin/partial-leads:GET]", error);
    return NextResponse.json({ error: "조회 실패 (마이그레이션 적용 여부 확인)" }, { status: 500 });
  }

  // 자동매칭용 사업자 풀 (검증·공개·활성) — 한 번만 조회 후 JS 매칭
  let contractors: Contractor[] = [];
  try {
    const { data } = await admin
      .from("specialty_contractors")
      .select("id, company_name, region, contractor_type, rating, total_reviews, is_verified, is_featured, contractor_trades(trade_code, trade_name)")
      .eq("is_active", true)
      .eq("is_public", true)
      .order("rating", { ascending: false, nullsFirst: false })
      .limit(300);
    contractors = (data ?? []) as Contractor[];
  } catch {
    contractors = [];
  }

  const rows = (leads ?? []).map((l: Record<string, unknown>) => ({
    id: l.id,
    surface: l.surface,
    materialQuery: l.material_query,
    productTitle: l.product_title,
    productPrice: l.product_price,
    productLink: l.product_link,
    region: l.region,
    contact: l.contact,
    note: l.note,
    estimateTotal: l.estimate_total,
    status: l.status,
    createdAt: l.created_at,
    suggestions: matchContractors(l.region as string, contractors),
  }));

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status as string] = (counts[r.status as string] ?? 0) + 1;

  return NextResponse.json({ leads: rows, counts, contractorPool: contractors.length });
}

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const id = String(body.id ?? "");
  const status = String(body.status ?? "");
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  if (!STATUSES.includes(status)) return NextResponse.json({ error: "올바른 상태가 아닙니다." }, { status: 400 });

  const { error } = await admin.from("partial_install_requests").update({ status }).eq("id", id);
  if (error) {
    console.error("[admin/partial-leads:PATCH]", error);
    return NextResponse.json({ error: "상태 변경 실패" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
