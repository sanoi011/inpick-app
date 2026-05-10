/**
 * GET /api/bids/comparison?estimateId=...
 *
 * 소비자가 받은 입찰들의 사업자별 적용 요율 + 계산된 간접비 breakdown 비교.
 *
 * 가이드: InPick_Quote_System_Spec.md §D-6 (소비자 비교 페이지)
 *
 * 응답:
 *  - directCost (estimate 기반)
 *  - bids[] — 각 bid의 contractor / rates / indirectCosts breakdown
 *
 * 인증: 견적의 소유자(소비자)만 비교 데이터 조회 가능.
 *  관리자 등 다른 역할의 접근은 허용하지 않음.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateIndirectCosts, type BidRateOverride } from "@/lib/inpick/indirect-rates";
import { mapDbBidRates, type BidIndirectRatesRow } from "@/types/bid-rates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const estimateId = req.nextUrl.searchParams.get("estimateId");
  if (!estimateId) {
    return NextResponse.json({ error: "estimateId 필수" }, { status: 400 });
  }

  // 소비자 인증 + 견적 소유권 검증
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const { data: estimate, error: estErr } = await supabase
    .from("estimates")
    .select("id, user_id, total_material, total_labor")
    .eq("id", estimateId)
    .single();

  if (estErr || !estimate) {
    return NextResponse.json({ error: "견적을 찾을 수 없습니다" }, { status: 404 });
  }
  if (estimate.user_id && estimate.user_id !== user.id) {
    return NextResponse.json({ error: "본인 견적만 조회 가능합니다" }, { status: 403 });
  }

  // 입찰 + 사업자 + 요율 모두 한 번에 fetch (LEFT JOIN bid_indirect_rates)
  const { data: bidsData, error: bidsErr } = await supabase
    .from("bids")
    .select(`
      id,
      bid_amount,
      estimated_days,
      message,
      status,
      created_at,
      specialty_contractors (id, company_name, rating, total_reviews, is_verified, completed_projects),
      bid_indirect_rates (*)
    `)
    .eq("estimate_id", estimateId)
    .order("created_at", { ascending: false });

  if (bidsErr) {
    console.error("[bids/comparison] 조회 실패:", bidsErr);
    return NextResponse.json({ error: "입찰 조회 실패" }, { status: 500 });
  }

  const directCost =
    Number(estimate.total_material ?? 0) + Number(estimate.total_labor ?? 0);
  const laborPlusExpense = Number(estimate.total_labor ?? 0);

  // 각 bid에 대해 indirectCosts 계산 (저장된 rates → calculateIndirectCosts)
  const bids = (bidsData ?? []).map((b) => {
    const ratesRow = Array.isArray(b.bid_indirect_rates)
      ? (b.bid_indirect_rates[0] as BidIndirectRatesRow | undefined)
      : (b.bid_indirect_rates as BidIndirectRatesRow | null);

    let override: BidRateOverride | undefined;
    let isModified = false;
    if (ratesRow) {
      const r = mapDbBidRates(ratesRow);
      override = {
        elevator_protection: r.setupCosts.elevatorProtection,
        entrance_protection: r.setupCosts.entranceProtection,
        scaffolding: r.setupCosts.scaffolding,
        waste_disposal: r.setupCosts.wasteDisposal,
        safety_rate: r.rates.safetyRate,
        general_management_rate: r.rates.generalManagementRate,
        profit_rate: r.rates.profitRate,
      };
      isModified = ratesRow.is_modified_from_default;
    }

    const indirectCosts = calculateIndirectCosts(
      directCost,
      override,
      laborPlusExpense > 0 ? { laborPlusExpense } : undefined,
    );

    const contractor = Array.isArray(b.specialty_contractors)
      ? b.specialty_contractors[0]
      : b.specialty_contractors;

    return {
      bidId: b.id,
      bidAmount: Number(b.bid_amount),
      estimatedDays: b.estimated_days,
      message: b.message,
      status: b.status,
      createdAt: b.created_at,
      contractor: contractor
        ? {
            id: (contractor as Record<string, unknown>).id as string,
            companyName: (contractor as Record<string, unknown>).company_name as string,
            rating: ((contractor as Record<string, unknown>).rating as number) ?? null,
            totalReviews: ((contractor as Record<string, unknown>).total_reviews as number) ?? 0,
            isVerified: ((contractor as Record<string, unknown>).is_verified as boolean) ?? false,
            completedProjects:
              ((contractor as Record<string, unknown>).completed_projects as number) ?? 0,
          }
        : null,
      ratesModified: isModified,
      appliedRates: override ?? null,
      indirectCosts,
    };
  });

  return NextResponse.json({
    estimateId,
    directCost,
    laborPlusExpense,
    bids,
  });
}
