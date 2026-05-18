/**
 * GET /api/admin/estimate-quality?estimateId=... 또는 ?contextId=...
 *
 * 견적 품질 진단 — fallback 통계 + 고액 fallback 라인 경고.
 * 가이드: inpick-estimate-v2-product-price-pdf-fix-plan-20260513.md §9
 *
 * 정책:
 *   - 관리자만 접근 (ADMIN_PASSWORD Bearer)
 *   - 100만원 이상 + standard_fallback 라인 → unresolvedHighValueLines로 노출
 *   - source 분포 + match status 분포 동시 표시
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

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

import { isAdminAuthorized } from "@/lib/admin-auth";
function checkAdminAuth(req: NextRequest): boolean {
  return isAdminAuthorized(req);
}

interface QualityResponse {
  estimateContextId?: string;
  estimateId?: string;
  lineCount: number;
  productResolvedCount: number;
  priceResolvedCount: number;
  fallbackCount: number;
  matchStatusBreakdown: Record<string, number>;
  priceSourceBreakdown: Record<string, number>;
  fallbackByTrade: Record<string, { count: number; totalAmount: number }>;
  unresolvedHighValueLines: Array<{
    lineId: string;
    tradeCode: string;
    tradeName: string;
    itemName: string;
    totalAmount: number;
    fallbackReason: string | null;
    matchStatus: string | null;
  }>;
  fallbackRatio: number;
  warningMessage?: string;
}

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "SERVICE_NOT_CONFIGURED" }, { status: 500 });
  }

  const estimateContextId = req.nextUrl.searchParams.get("contextId");
  const estimateId = req.nextUrl.searchParams.get("estimateId");
  if (!estimateContextId && !estimateId) {
    return NextResponse.json(
      { error: "MISSING_PARAM", hint: "contextId 또는 estimateId 필요" },
      { status: 400 },
    );
  }

  // construction_estimate_lines 조회
  let query = admin
    .from("construction_estimate_lines")
    .select(
      "id, trade_code, trade_name, sub_trade_name, item_name, total_amount, product_match_status, material_price_source, fallback_reason",
    );
  if (estimateId) query = query.eq("estimate_id", estimateId);
  if (estimateContextId) query = query.eq("estimate_context_id", estimateContextId);

  const { data, error } = await query;
  if (error) {
    console.error("[estimate-quality] select failed:", error);
    return NextResponse.json({ error: "SELECT_FAILED" }, { status: 500 });
  }

  const lines = (data ?? []) as Array<{
    id: string;
    trade_code: string;
    trade_name: string;
    sub_trade_name: string;
    item_name: string;
    total_amount: number;
    product_match_status: string | null;
    material_price_source: string | null;
    fallback_reason: string | null;
  }>;

  const matchStatusBreakdown: Record<string, number> = {};
  const priceSourceBreakdown: Record<string, number> = {};
  const fallbackByTrade: Record<string, { count: number; totalAmount: number }> = {};
  const unresolvedHighValueLines: QualityResponse["unresolvedHighValueLines"] = [];
  let productResolvedCount = 0;
  let priceResolvedCount = 0;
  let fallbackCount = 0;

  for (const l of lines) {
    const ms = l.product_match_status ?? "unset";
    matchStatusBreakdown[ms] = (matchStatusBreakdown[ms] || 0) + 1;
    if (ms === "confirmed" || ms === "recommended") productResolvedCount++;

    const ps = l.material_price_source ?? "unset";
    priceSourceBreakdown[ps] = (priceSourceBreakdown[ps] || 0) + 1;
    if (ps && ps !== "kpa_standard" && ps !== "category_standard") priceResolvedCount++;

    if (ms === "standard_fallback") {
      fallbackCount++;
      const tradeKey = l.trade_name || l.trade_code;
      if (!fallbackByTrade[tradeKey])
        fallbackByTrade[tradeKey] = { count: 0, totalAmount: 0 };
      fallbackByTrade[tradeKey].count++;
      fallbackByTrade[tradeKey].totalAmount += Number(l.total_amount) || 0;

      // 100만원 이상 고액 fallback
      if (Number(l.total_amount) >= 1_000_000) {
        unresolvedHighValueLines.push({
          lineId: l.id,
          tradeCode: l.trade_code,
          tradeName: l.trade_name,
          itemName: l.item_name,
          totalAmount: Number(l.total_amount),
          fallbackReason: l.fallback_reason,
          matchStatus: l.product_match_status,
        });
      }
    }
  }

  const fallbackRatio = lines.length > 0 ? fallbackCount / lines.length : 0;
  let warningMessage: string | undefined;
  if (unresolvedHighValueLines.length > 0) {
    warningMessage = `고액 항목 ${unresolvedHighValueLines.length}건이 표준 fallback 상태입니다 — 사업자 입찰 또는 자재 확정 시 금액 변동 가능.`;
  } else if (fallbackRatio > 0.5) {
    warningMessage = `전체 라인의 ${Math.round(fallbackRatio * 100)}%가 fallback — material_products DB 보강 필요.`;
  }

  const response: QualityResponse = {
    estimateContextId: estimateContextId ?? undefined,
    estimateId: estimateId ?? undefined,
    lineCount: lines.length,
    productResolvedCount,
    priceResolvedCount,
    fallbackCount,
    fallbackRatio,
    matchStatusBreakdown,
    priceSourceBreakdown,
    fallbackByTrade,
    unresolvedHighValueLines,
    warningMessage,
  };
  return NextResponse.json(response);
}
