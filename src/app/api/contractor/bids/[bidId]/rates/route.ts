/**
 * GET/PUT /api/contractor/bids/[bidId]/rates
 *
 * 사업자가 입찰 시 간접비 요율 override.
 *
 * 가이드: InPick_Quote_System_Spec.md §D-4
 *
 * 검증:
 *  - 인증: Bearer 토큰 (getContractorIdFromRequest)
 *  - 소유권: bids.contractor_id === auth contractorId
 *  - 입찰 상태: 'pending'일 때만 수정 가능 (selected/rejected는 잠금)
 *  - 법정 한도: validateRateOverride (산안비 ≥ 3.11%, 일반관리비 ≤ 6%, 이윤 ≤ 25%)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getContractorIdFromRequest } from "@/lib/contractor-auth";
import { validateRateOverride, type BidRateOverride } from "@/lib/inpick/indirect-rates";
import {
  mapDbBidRates,
  type BidIndirectRatesRow,
  type UpdateBidRatesRequest,
} from "@/types/bid-rates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── GET — 현재 요율 조회 (없으면 trigger가 default로 자동 생성하므로 항상 1건) ───
export async function GET(
  req: NextRequest,
  { params }: { params: { bidId: string } },
) {
  const contractorId = getContractorIdFromRequest(req);
  if (!contractorId) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const supabase = createClient();

  // 소유권 확인
  const { data: bid, error: bidErr } = await supabase
    .from("bids")
    .select("id, contractor_id, status")
    .eq("id", params.bidId)
    .single();

  if (bidErr || !bid) {
    return NextResponse.json({ error: "입찰을 찾을 수 없습니다" }, { status: 404 });
  }
  if (bid.contractor_id !== contractorId) {
    return NextResponse.json({ error: "본인 입찰만 조회 가능합니다" }, { status: 403 });
  }

  // rates 조회 (trigger로 INSERT 시 자동 생성됨, 누락된 경우 백필)
  let { data: ratesRow, error: ratesErr } = await supabase
    .from("bid_indirect_rates")
    .select("*")
    .eq("bid_id", params.bidId)
    .maybeSingle();

  if (ratesErr) {
    console.error("[bid-rates GET] 조회 실패:", ratesErr);
    return NextResponse.json({ error: "요율 조회 실패" }, { status: 500 });
  }

  // 누락된 경우 (trigger 미동작 등) 즉석 backfill
  if (!ratesRow) {
    const { data: created, error: createErr } = await supabase
      .from("bid_indirect_rates")
      .insert({ bid_id: params.bidId })
      .select("*")
      .single();
    if (createErr || !created) {
      console.error("[bid-rates GET] backfill 실패:", createErr);
      return NextResponse.json({ error: "요율 생성 실패" }, { status: 500 });
    }
    ratesRow = created;
  }

  return NextResponse.json({
    rates: mapDbBidRates(ratesRow as BidIndirectRatesRow),
    bidStatus: bid.status,
    editable: bid.status === "pending",
  });
}

// ─── PUT — 요율 수정 ───
export async function PUT(
  req: NextRequest,
  { params }: { params: { bidId: string } },
) {
  const contractorId = getContractorIdFromRequest(req);
  if (!contractorId) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const supabase = createClient();

  // 소유권 + 상태 확인
  const { data: bid, error: bidErr } = await supabase
    .from("bids")
    .select("id, contractor_id, status")
    .eq("id", params.bidId)
    .single();

  if (bidErr || !bid) {
    return NextResponse.json({ error: "입찰을 찾을 수 없습니다" }, { status: 404 });
  }
  if (bid.contractor_id !== contractorId) {
    return NextResponse.json({ error: "본인 입찰만 수정 가능합니다" }, { status: 403 });
  }
  if (bid.status !== "pending") {
    return NextResponse.json(
      {
        error: "BID_LOCKED",
        message: "선정·거절된 입찰의 요율은 수정할 수 없습니다",
      },
      { status: 400 },
    );
  }

  let body: UpdateBidRatesRequest;
  try {
    body = (await req.json()) as UpdateBidRatesRequest;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  // 법정 한도 검증 (validateRateOverride 재사용)
  const override: BidRateOverride = {
    elevator_protection: body.elevator_protection,
    entrance_protection: body.entrance_protection,
    scaffolding: body.scaffolding,
    waste_disposal: body.waste_disposal,
    safety_rate: body.safety_rate,
    general_management_rate: body.general_management_rate,
    profit_rate: body.profit_rate,
  };
  const validation = validateRateOverride(override);
  if (!validation.ok) {
    return NextResponse.json(
      {
        error: validation.error,
        field: validation.field,
        ...(validation.details ?? {}),
      },
      { status: 400 },
    );
  }

  // 추가 양수 검증 (validateRateOverride는 음수만 거르므로 NaN/Infinity 추가 가드)
  for (const k of [
    "elevator_protection",
    "entrance_protection",
    "scaffolding",
    "waste_disposal",
    "safety_rate",
    "general_management_rate",
    "profit_rate",
  ] as const) {
    const v = body[k];
    if (v !== undefined && !Number.isFinite(v)) {
      return NextResponse.json(
        { error: "INVALID_NUMBER", field: k },
        { status: 400 },
      );
    }
  }

  // UPDATE 페이로드 구성 (undefined는 제외)
  const update: Partial<BidIndirectRatesRow> & { is_modified_from_default: boolean } = {
    is_modified_from_default: true,
  };
  if (body.elevator_protection !== undefined) update.elevator_protection = body.elevator_protection;
  if (body.entrance_protection !== undefined) update.entrance_protection = body.entrance_protection;
  if (body.scaffolding !== undefined) update.scaffolding = body.scaffolding;
  if (body.waste_disposal !== undefined) update.waste_disposal = body.waste_disposal;
  if (body.safety_rate !== undefined) update.safety_rate = body.safety_rate;
  if (body.general_management_rate !== undefined)
    update.general_management_rate = body.general_management_rate;
  if (body.profit_rate !== undefined) update.profit_rate = body.profit_rate;
  if (body.modification_reason !== undefined)
    update.modification_reason = body.modification_reason;

  const { data: updated, error: updateErr } = await supabase
    .from("bid_indirect_rates")
    .update(update)
    .eq("bid_id", params.bidId)
    .select("*")
    .single();

  if (updateErr || !updated) {
    console.error("[bid-rates PUT] 수정 실패:", updateErr);
    return NextResponse.json({ error: "요율 수정 실패" }, { status: 500 });
  }

  return NextResponse.json({
    rates: mapDbBidRates(updated as BidIndirectRatesRow),
  });
}
