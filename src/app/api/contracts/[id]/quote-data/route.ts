/**
 * GET /api/contracts/[id]/quote-data
 *
 * Phase 3 — 계약 체결 후 확정 견적서 PDF 생성용 데이터.
 *
 * 응답:
 *   - estimate (totals, rfq_data)
 *   - estimate_items (line items snapshot)
 *   - contractor_snapshot (계약 시점 사업자 정보)
 *   - applied_indirect_rates (계약 시점 적용 요율)
 *   - indirectCosts (서버 계산 — 적용 요율 + estimate 직접공사비 기반)
 *
 * 인증: contract의 consumer_id 또는 contractor_id만 접근 가능 (듀얼 인증).
 *
 * 가이드: InPick_Quote_System_Spec.md §A-1, §E Phase 3 Step 9
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getContractorIdFromRequest } from "@/lib/contractor-auth";
import {
  calculateIndirectCosts,
  type BidRateOverride,
} from "@/lib/inpick/indirect-rates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();

  // 듀얼 인증 (소비자 OR 사업자)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authContractorId = getContractorIdFromRequest(req);
  if (!user && !authContractorId) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  // 계약 + 사업자 정보 + 견적 메타 fetch
  const { data: contract, error: contractErr } = await supabase
    .from("contracts")
    .select(`
      id,
      estimate_id,
      consumer_id,
      contractor_id,
      project_name,
      address,
      total_amount,
      contractor_snapshot,
      applied_indirect_rates,
      progress_payments,
      start_date,
      expected_end_date,
      created_at,
      specialty_contractors (id, company_name, contact_name, business_number, address, phone, email)
    `)
    .eq("id", params.id)
    .single();

  if (contractErr || !contract) {
    return NextResponse.json({ error: "계약을 찾을 수 없습니다" }, { status: 404 });
  }

  // 소유권 검증 (소비자 또는 사업자 — 둘 중 하나라도 일치)
  const isConsumer = !!user && contract.consumer_id === user.id;
  const isContractor =
    !!authContractorId && contract.contractor_id === authContractorId;
  if (!isConsumer && !isContractor) {
    return NextResponse.json({ error: "본인 계약만 조회 가능합니다" }, { status: 403 });
  }

  // 견적 + 항목 fetch
  const { data: estimate, error: estErr } = await supabase
    .from("estimates")
    .select("id, title, total_material, total_labor, total_overhead, grand_total, total_area_m2, rfq_data, address, created_at")
    .eq("id", contract.estimate_id)
    .single();

  if (estErr || !estimate) {
    return NextResponse.json({ error: "견적을 찾을 수 없습니다" }, { status: 404 });
  }

  const { data: items } = await supabase
    .from("estimate_items")
    .select("id, space_name, item_name, unit, quantity, material_cost, labor_cost, overhead_cost, subtotal, sort_order")
    .eq("estimate_id", contract.estimate_id)
    .order("sort_order", { ascending: true });

  // 적용 요율 → BidRateOverride 변환
  const snapshotRates = contract.applied_indirect_rates as Record<string, unknown> | null;
  let override: BidRateOverride | undefined;
  if (snapshotRates) {
    override = {
      elevator_protection: Number(snapshotRates.elevator_protection),
      entrance_protection: Number(snapshotRates.entrance_protection),
      scaffolding: Number(snapshotRates.scaffolding),
      waste_disposal: Number(snapshotRates.waste_disposal),
      safety_rate: Number(snapshotRates.safety_rate),
      general_management_rate: Number(snapshotRates.general_management_rate),
      profit_rate: Number(snapshotRates.profit_rate),
    };
  }

  const matSum = Number(estimate.total_material ?? 0);
  const lbrSum = Number(estimate.total_labor ?? 0);
  const directCost = matSum + lbrSum;

  const indirectCosts = calculateIndirectCosts(
    directCost,
    override,
    lbrSum > 0 ? { laborPlusExpense: lbrSum } : undefined,
  );

  // contractor 정보 — snapshot 우선, 없으면 현재 specialty_contractors fallback
  const contractorRow = Array.isArray(contract.specialty_contractors)
    ? contract.specialty_contractors[0]
    : contract.specialty_contractors;
  const contractor = contract.contractor_snapshot ?? (contractorRow
    ? {
        company_name: (contractorRow as Record<string, unknown>).company_name as string,
        representative: (contractorRow as Record<string, unknown>).contact_name as string,
        biz_no: ((contractorRow as Record<string, unknown>).business_number as string) || "",
        address: ((contractorRow as Record<string, unknown>).address as string) || "",
        phone: ((contractorRow as Record<string, unknown>).phone as string) || "",
        email: ((contractorRow as Record<string, unknown>).email as string) || "",
      }
    : null);

  return NextResponse.json({
    contractId: contract.id,
    projectName: contract.project_name,
    address: contract.address,
    startDate: contract.start_date,
    expectedEndDate: contract.expected_end_date,
    contractCreatedAt: contract.created_at,

    contractor,
    contractorSnapshot: contract.contractor_snapshot, // null이면 현재 사업자 정보 활용 신호

    estimate: {
      id: estimate.id,
      title: estimate.title,
      totalMaterial: matSum,
      totalLabor: lbrSum,
      totalOverhead: Number(estimate.total_overhead ?? 0),
      grandTotal: Number(estimate.grand_total ?? 0),
      totalAreaM2: Number(estimate.total_area_m2 ?? 0),
      address: estimate.address,
      rfqData: estimate.rfq_data,
      createdAt: estimate.created_at,
    },

    items: (items ?? []).map((it) => ({
      itemId: it.id,
      spaceName: it.space_name,
      name: it.item_name,
      unit: it.unit,
      quantity: Number(it.quantity),
      materialCost: Number(it.material_cost),
      laborCost: Number(it.labor_cost),
      expenseCost: Number(it.overhead_cost),
      totalCost: Number(it.subtotal),
    })),

    directCost,
    indirectCosts,
    appliedIndirectRates: snapshotRates,
    totalAmount: Number(contract.total_amount),
  });
}
