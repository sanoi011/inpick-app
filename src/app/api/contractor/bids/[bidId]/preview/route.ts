/**
 * GET /api/contractor/bids/[bidId]/preview
 *
 * 사업자가 수정한 요율 적용 시 견적 미리보기 (실시간).
 *
 * 가이드: InPick_Quote_System_Spec.md §D-4
 *
 * Query params:
 *   - directCost (선택): 직접공사비 (자재+노무+경비). 미지정 시 estimate에서 추정.
 *   - laborPlusExpense (선택): 노무+경비 합계 (이윤 정확도 ↑). 미지정 시 directCost × 0.6.
 *
 * 사용 흐름:
 *   사업자 edit-rates 페이지 → 요율 슬라이더 변경 → PUT /rates 저장 → GET /preview 호출 → 합계 표시
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getContractorIdFromRequest } from "@/lib/contractor-auth";
import {
  calculateIndirectCosts,
  type BidRateOverride,
} from "@/lib/inpick/indirect-rates";
import { mapDbBidRates, type BidIndirectRatesRow } from "@/types/bid-rates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { bidId: string } },
) {
  const contractorId = getContractorIdFromRequest(req);
  if (!contractorId) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const supabase = createClient();

  const { data: bid, error: bidErr } = await supabase
    .from("bids")
    .select("id, contractor_id, estimate_id, bid_amount")
    .eq("id", params.bidId)
    .single();

  if (bidErr || !bid) {
    return NextResponse.json({ error: "입찰을 찾을 수 없습니다" }, { status: 404 });
  }
  if (bid.contractor_id !== contractorId) {
    return NextResponse.json({ error: "본인 입찰만 조회 가능합니다" }, { status: 403 });
  }

  // 현재 저장된 요율 조회
  const { data: ratesRow, error: ratesErr } = await supabase
    .from("bid_indirect_rates")
    .select("*")
    .eq("bid_id", params.bidId)
    .maybeSingle();

  if (ratesErr) {
    console.error("[bid-preview] rates 조회 실패:", ratesErr);
    return NextResponse.json({ error: "요율 조회 실패" }, { status: 500 });
  }

  // directCost 결정 — 우선순위: query param > estimate 합계
  const qDirect = req.nextUrl.searchParams.get("directCost");
  const qLaborExpense = req.nextUrl.searchParams.get("laborPlusExpense");
  let directCost = qDirect ? Number(qDirect) : NaN;
  let laborPlusExpense = qLaborExpense ? Number(qLaborExpense) : undefined;

  if (!Number.isFinite(directCost)) {
    const { data: estimate } = await supabase
      .from("estimates")
      .select("total_material, total_labor")
      .eq("id", bid.estimate_id)
      .maybeSingle();
    const matSum = Number(estimate?.total_material ?? 0);
    const lbrSum = Number(estimate?.total_labor ?? 0);
    directCost = matSum + lbrSum;
    if (laborPlusExpense === undefined) laborPlusExpense = lbrSum;
  }

  // override 빌드 — 저장된 rates 그대로 사용 (있으면)
  let override: BidRateOverride | undefined;
  if (ratesRow) {
    const r = mapDbBidRates(ratesRow as BidIndirectRatesRow);
    override = {
      elevator_protection: r.setupCosts.elevatorProtection,
      entrance_protection: r.setupCosts.entranceProtection,
      scaffolding: r.setupCosts.scaffolding,
      waste_disposal: r.setupCosts.wasteDisposal,
      safety_rate: r.rates.safetyRate,
      general_management_rate: r.rates.generalManagementRate,
      profit_rate: r.rates.profitRate,
    };
  }

  const indirectCosts = calculateIndirectCosts(
    directCost,
    override,
    laborPlusExpense !== undefined ? { laborPlusExpense } : undefined,
  );

  return NextResponse.json({
    bidId: bid.id,
    estimateId: bid.estimate_id,
    bidAmount: Number(bid.bid_amount),
    directCost,
    laborPlusExpense,
    indirectCosts,
    /** 미리보기 합계 — 사업자가 입찰서로 보낼 금액 */
    previewTotal: indirectCosts.totalAmount,
  });
}
