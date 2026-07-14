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

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function asStringArray(value: unknown, max = 20): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, max)
    : [];
}

function matchedContractorIds(rfq: JsonObject): string[] {
  return asStringArray(rfq.matchedContractorIds, 20);
}

function designRenders(rfq: JsonObject, metadata: JsonObject) {
  const source = Array.isArray(rfq.designRenders)
    ? rfq.designRenders
    : Array.isArray(metadata.designRenders)
      ? metadata.designRenders
      : [];

  return source.flatMap((item) => {
    const render = asObject(item);
    const url = asString(render.url) || asString(render.refinedUrl);
    if (!url || !/^https?:\/\//i.test(url)) return [];
    return [{
      url,
      refinedUrl: asString(render.refinedUrl),
      roomName: asString(render.roomName) || asString(render.roomKey) || "디자인 시안",
      prompt: asString(render.prompt),
    }];
  }).slice(0, 6);
}

function publicRegion(rfq: JsonObject, fallback?: string | null) {
  const region = asObject(rfq.region);
  const sido = asString(region.sido) || asString(fallback) || "지역 협의";
  const gugun = asString(region.gugun) || "";
  return { sido, gugun, label: `${sido} ${gugun}`.trim() };
}

function isPublishedRfq(rfq: JsonObject): boolean {
  return Boolean(asString(rfq.publishedAt) || asString(rfq.sentAt));
}

export async function GET(request: NextRequest) {
  const contractorId = getContractorIdFromRequest(request);
  if (!contractorId) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const [{ data: estimates, error: estimateError }, { data: bids, error: bidError }] =
      await Promise.all([
        admin
          .from("estimates")
          .select(
            "id, status, project_type, space_type, total_area_m2, grand_total, region, rfq_data, metadata, consumer_project_id, created_at, updated_at",
          )
          .in("status", ["open", "confirmed", "in_progress", "completed"])
          .order("created_at", { ascending: false })
          .limit(150),
        admin
          .from("bids")
          .select(
            "id, estimate_id, bid_amount, discount_rate, estimated_days, start_available_date, message, status, metadata, created_at, updated_at",
          )
          .eq("contractor_id", contractorId)
          .order("created_at", { ascending: false })
          .limit(150),
      ]);

    if (estimateError || bidError) {
      console.error("[contractor/rfqs] query failed", estimateError || bidError);
      return NextResponse.json({ error: "입찰 공고를 불러오지 못했습니다" }, { status: 500 });
    }

    const myBidByEstimate = new Map(
      (bids || []).map((bid) => [String(bid.estimate_id), bid]),
    );

    const rfqs = (estimates || []).flatMap((estimate) => {
      const rfq = asObject(estimate.rfq_data);
      const metadata = asObject(estimate.metadata);
      const matches = matchedContractorIds(rfq);
      const myBid = myBidByEstimate.get(String(estimate.id)) || null;
      const explicitlyMatched = matches.includes(contractorId);
      const legacyPublic = matches.length === 0 && isPublishedRfq(rfq);

      if (!myBid && !explicitlyMatched && !legacyPublic) return [];

      const region = publicRegion(rfq, estimate.region);
      const area = asNumber(rfq.exclusiveAreaM2) ?? asNumber(estimate.total_area_m2) ?? 0;
      const spaceType = asString(rfq.spaceType) || asString(estimate.space_type) || "인테리어";
      const noticeNo = asString(rfq.noticeNo) || `INPICK-${String(estimate.id).slice(0, 8).toUpperCase()}`;
      const budgetWon = asNumber(rfq.budgetWon) ?? asNumber(estimate.grand_total) ?? 0;
      const rank = matches.indexOf(contractorId);

      return [{
        id: estimate.id,
        notice_no: noticeNo,
        title: `${region.label} ${area ? `${Math.round(area)}㎡ ` : ""}${spaceType} 공사`,
        status: estimate.status,
        project_type: estimate.project_type,
        space_type: spaceType,
        total_area_m2: area,
        budget_won: budgetWon,
        region,
        consumer_project_id: estimate.consumer_project_id,
        created_at: estimate.created_at,
        updated_at: estimate.updated_at,
        rfq_data: {
          publishedAt: asString(rfq.publishedAt) || asString(rfq.sentAt) || estimate.created_at,
          deadlineAt: asString(rfq.deadlineAt),
          preferredStart: asString(rfq.preferredStart) || asString(rfq.preferredStartDate),
          preferredDuration: asString(rfq.preferredDuration),
          visitPreference: asString(rfq.visitPreference),
          notes: asString(rfq.notes) || asString(rfq.specialNotes),
          drawingOptions: asStringArray(rfq.drawingOptions, 12),
          comparisonFields: asStringArray(rfq.comparisonFields, 12),
          addressVisibility: asString(rfq.addressVisibility) || "district_only",
          shortlistSize: asNumber(rfq.shortlistSize) || Math.max(matches.length, 3),
          matchingRank: rank >= 0 ? rank + 1 : undefined,
          designRenders: designRenders(rfq, metadata),
        },
        my_bid: myBid,
      }];
    });

    return NextResponse.json({ rfqs });
  } catch (error) {
    console.error("[contractor/rfqs] failed", error);
    return NextResponse.json({ error: "입찰 공고 조회 중 오류가 발생했습니다" }, { status: 500 });
  }
}
