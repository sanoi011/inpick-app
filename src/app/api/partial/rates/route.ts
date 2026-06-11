/**
 * GET /api/partial/rates
 * 부분 적산 단가(관리자 단가DB)를 calc 입력 형태로 반환.
 * 응답: { rates: { [surface]: { installPerUnit, demoPerUnit, disposalPerUnit, auxRate, loss, minLabor, basis, trade } } }
 * 테이블 미적용/오류 시 { rates: {} } → 적산 엔진은 내장 기본값 사용 (graceful).
 */
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  surface: string;
  basis: string;
  trade: string;
  install_per_unit: number;
  demo_per_unit: number;
  disposal_per_unit: number;
  aux_rate: number;
  loss: number;
  min_labor: number;
};

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ rates: {} });

  try {
    const admin = createServiceClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.from("partial_estimate_rates").select("*");
    if (error) throw error;
    const rates: Record<string, unknown> = {};
    for (const r of (data ?? []) as Row[]) {
      rates[r.surface] = {
        basis: r.basis,
        trade: r.trade,
        installPerUnit: r.install_per_unit,
        demoPerUnit: r.demo_per_unit,
        disposalPerUnit: r.disposal_per_unit,
        auxRate: Number(r.aux_rate),
        loss: Number(r.loss),
        minLabor: r.min_labor,
      };
    }
    return NextResponse.json({ rates });
  } catch (err) {
    console.warn("[partial/rates] fallback to defaults:", err);
    return NextResponse.json({ rates: {} });
  }
}
