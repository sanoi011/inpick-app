import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getContractorIdFromRequest } from "@/lib/contractor-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { estimateId: string } },
) {
  const contractorId = getContractorIdFromRequest(request);
  if (!contractorId) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: estimate, error } = await admin
      .from("estimates")
      .select(
        "id, status, rfq_data, estimate_items(id, space_name, item_name, unit, quantity, material_cost, labor_cost, overhead_cost, subtotal, sort_order)",
      )
      .eq("id", params.estimateId)
      .maybeSingle();

    if (error || !estimate) {
      return NextResponse.json({ error: "공고를 찾을 수 없습니다" }, { status: 404 });
    }

    const rfq = asObject(estimate.rfq_data);
    const matches = stringArray(rfq.matchedContractorIds);
    const { data: ownBid } = await admin
      .from("bids")
      .select("id")
      .eq("estimate_id", params.estimateId)
      .eq("contractor_id", contractorId)
      .maybeSingle();

    const legacyPublic =
      matches.length === 0 && Boolean(rfq.publishedAt || rfq.sentAt);
    if (!ownBid && !matches.includes(contractorId) && !legacyPublic) {
      return NextResponse.json({ error: "이 공고를 볼 권한이 없습니다" }, { status: 403 });
    }

    return NextResponse.json({
      estimate: {
        id: estimate.id,
        status: estimate.status,
        estimate_items: estimate.estimate_items || [],
      },
    });
  } catch (error) {
    console.error("[contractor/rfqs/detail] failed", error);
    return NextResponse.json({ error: "견적 상세 조회 중 오류가 발생했습니다" }, { status: 500 });
  }
}
