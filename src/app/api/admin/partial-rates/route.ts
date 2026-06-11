/**
 * /api/admin/partial-rates  — 부분 적산 단가 관리 (관리자)
 *  GET : 현재 단가(부위별, DB 행을 기본값 위에 병합) 반환
 *  PUT : 한 부위(surface) 단가 upsert  { surface, installPerUnit, demoPerUnit, disposalPerUnit, auxRate, loss, minLabor }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdminAuthorized, getAdminIdFromRequest } from "@/lib/admin-auth";
import { DEFAULT_PARTIAL_RATES, type PartialSurface } from "@/lib/partial/partial-estimate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const SURFACES: PartialSurface[] = ["floor", "wall", "ceiling", "etc"];
const SURFACE_LABEL: Record<PartialSurface, string> = {
  floor: "바닥재 (면적)",
  wall: "벽 마감 (면적)",
  ceiling: "천정 (면적)",
  etc: "설비·기구 (수량)",
};

type RateRow = {
  surface: string;
  install_per_unit: number;
  demo_per_unit: number;
  disposal_per_unit: number;
  aux_rate: number;
  loss: number;
  min_labor: number;
};

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();

  const dbBySurface: Record<string, RateRow> = {};
  let tableReady = false;
  if (admin) {
    const { data, error } = await admin.from("partial_estimate_rates").select("*");
    if (!error) {
      tableReady = true;
      for (const r of (data ?? []) as RateRow[]) dbBySurface[r.surface] = r;
    }
  }

  // 기본값 위에 DB 행 병합 → 현재 효력 단가
  const rates = SURFACES.map((s) => {
    const d = DEFAULT_PARTIAL_RATES[s];
    const row = dbBySurface[s];
    return {
      surface: s,
      label: SURFACE_LABEL[s],
      basis: d.basis,
      trade: d.trade,
      installPerUnit: row?.install_per_unit ?? d.installPerUnit,
      demoPerUnit: row?.demo_per_unit ?? d.demoPerUnit,
      disposalPerUnit: row?.disposal_per_unit ?? d.disposalPerUnit,
      auxRate: row ? Number(row.aux_rate) : d.auxRate,
      loss: row ? Number(row.loss) : d.loss,
      minLabor: row?.min_labor ?? d.minLabor,
      fromDb: !!row,
    };
  });

  return NextResponse.json({ rates, tableReady });
}

export async function PUT(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const surface = String(body.surface ?? "") as PartialSurface;
  if (!SURFACES.includes(surface)) {
    return NextResponse.json({ error: "올바른 surface가 아닙니다." }, { status: 400 });
  }
  const d = DEFAULT_PARTIAL_RATES[surface];
  const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

  const row = {
    surface,
    basis: d.basis,
    trade: d.trade,
    install_per_unit: Math.max(0, Math.round(num(body.installPerUnit, d.installPerUnit))),
    demo_per_unit: Math.max(0, Math.round(num(body.demoPerUnit, d.demoPerUnit))),
    disposal_per_unit: Math.max(0, Math.round(num(body.disposalPerUnit, d.disposalPerUnit))),
    aux_rate: Math.max(0, num(body.auxRate, d.auxRate)),
    loss: Math.max(0, num(body.loss, d.loss)),
    min_labor: Math.max(0, Math.round(num(body.minLabor, d.minLabor))),
    updated_at: new Date().toISOString(),
    updated_by: getAdminIdFromRequest(req),
  };

  const { error } = await admin.from("partial_estimate_rates").upsert(row, { onConflict: "surface" });
  if (error) {
    console.error("[admin/partial-rates:PUT]", error);
    return NextResponse.json({ error: "저장 실패 (마이그레이션 적용 여부 확인)" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
