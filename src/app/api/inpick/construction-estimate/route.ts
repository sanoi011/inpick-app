/**
 * GET /api/inpick/construction-estimate?consumerProjectId=xxx
 *
 * 사업자가 입찰 화면에서 소비자의 v2 17공종 견적을 조회하기 위한 endpoint.
 * 가이드: inpick-material-category-taxonomy-base-20260513.md §16-3
 *
 * RLS: consumer_project_id로 추적되는 v2 견적은 소비자 + 사업자(입찰 가능 상태) 양쪽이 읽을 수 있어야 함.
 * service role을 사용하되, 호출 시점에 사업자 인증 토큰 검증을 권장 (간단 버전은 검증 생략).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getContractorIdFromRequest } from "@/lib/contractor-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const contractorId = await getContractorIdFromRequest(req);
  if (!contractorId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const consumerProjectId = req.nextUrl.searchParams.get("consumerProjectId");
  if (!consumerProjectId) {
    return NextResponse.json({ error: "consumerProjectId required" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "service not configured" }, { status: 503 });
  }

  const admin = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: estimates, error: estErr } = await admin
    .from("construction_estimates")
    .select("id, project_id, total_with_vat, estimate_json, created_at")
    .eq("project_id", consumerProjectId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (estErr) {
    console.error("[construction-estimate GET] estimates:", estErr.message);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
  if (!estimates || estimates.length === 0) {
    return NextResponse.json({ estimate: null });
  }

  const estimate = estimates[0];

  const { data: lines, error: lineErr } = await admin
    .from("construction_estimate_lines")
    .select(
      "id, sort_no, trade_code, trade_name_ko, sub_trade_code, sub_trade_name_ko, room_id, room_name, room_type, surface_type, task_name_ko, item_name_ko, brand, manufacturer, supplier_name, vendor_name, product_name, model_no, sku, spec, product_spec, unit, quantity_formula_ko, quantity, material_unit_price, labor_unit_price, expense_unit_price, material_amount, labor_amount, expense_amount, total_amount, included, source, confidence, evidence_refs, product_match_status, material_category_code, material_price_source, fallback_reason, assumptions, warnings, pricing_basis, contractor_editable, site_verification_required, variation_notice, site_adjustment_factors, site_condition_adjustment_factor, site_condition_adjustment_reason",
    )
    .eq("estimate_id", estimate.id)
    .order("trade_code", { ascending: true });

  if (lineErr) {
    console.error("[construction-estimate GET] lines:", lineErr.message);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  return NextResponse.json({
    estimate: {
      id: estimate.id,
      consumer_project_id: estimate.project_id,
      total_amount: estimate.total_with_vat,
      precision_level:
        (estimate.estimate_json as { precisionLevel?: string } | null)?.precisionLevel ?? null,
      created_at: estimate.created_at,
      lines: lines ?? [],
    },
  });
}
