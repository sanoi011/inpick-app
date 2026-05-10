/**
 * GET /api/inpick/vision-materials/candidates?observationId=...
 *
 * 가이드: Phase 4 — observation별 후보 조회
 */

import { NextRequest, NextResponse } from "next/server";
import { getCandidatesByObservation } from "@/lib/vision-materials/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const observationId = req.nextUrl.searchParams.get("observationId");
  if (!observationId) {
    return NextResponse.json({ error: "observationId 쿼리 필수" }, { status: 400 });
  }
  const candidates = await getCandidatesByObservation(observationId);
  return NextResponse.json({ observationId, candidates });
}

/**
 * POST /api/inpick/vision-materials/candidates
 *
 * 사용자가 후보를 선택했을 때 — material_match_decisions 저장.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    observationId?: string;
    selectedMaterialProductId?: string;
    decisionType?: string;
    confidence?: number;
    metadata?: Record<string, unknown>;
  };
  if (!body.observationId) {
    return NextResponse.json({ error: "observationId 필수" }, { status: 400 });
  }
  if (!body.decisionType) {
    return NextResponse.json({ error: "decisionType 필수" }, { status: 400 });
  }
  // user_selected는 selectedMaterialProductId 필수
  if (
    body.decisionType === "user_selected" &&
    !body.selectedMaterialProductId
  ) {
    return NextResponse.json(
      { error: "user_selected시 selectedMaterialProductId 필수" },
      { status: 400 },
    );
  }
  const { insertDecision } = await import("@/lib/vision-materials/repository");
  const decisionId = await insertDecision({
    observationId: body.observationId,
    selectedMaterialProductId: body.selectedMaterialProductId,
    decisionType: body.decisionType as
      | "auto_high_confidence"
      | "user_selected"
      | "contractor_selected"
      | "fallback_generic"
      | "rejected",
    confidence: body.confidence || 0,
    metadata: body.metadata,
  });
  return NextResponse.json({ decisionId, ok: !!decisionId });
}
