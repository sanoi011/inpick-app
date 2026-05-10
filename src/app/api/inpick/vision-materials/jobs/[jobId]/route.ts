/**
 * GET /api/inpick/vision-materials/jobs/[jobId]
 *
 * 가이드: Phase 4 — async job polling
 *
 * 현재 (Phase 4 minimal):
 *   - analyze API는 sync 완료 응답이 default
 *   - async job 처리는 jobs/{jobId}로 polling — DB observation 조회로 fallback
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getObservationsByProject,
  getCandidatesByObservation,
} from "@/lib/vision-materials/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  const jobId = params.jobId;
  if (!jobId) {
    return NextResponse.json({ error: "jobId 필수" }, { status: 400 });
  }

  // jobId가 projectId인 경우 — 해당 프로젝트의 최근 observations + candidates
  // (Phase 4 minimal: 별도 jobs 테이블 X — projectId-based)
  const observations = await getObservationsByProject(jobId, { limit: 20 });
  if (observations.length === 0) {
    return NextResponse.json({
      jobId,
      status: "pending",
      observations: [],
      hint: "분석 결과 없음 — analyze API를 먼저 호출하세요",
    });
  }

  const enriched = await Promise.all(
    observations.map(async (o) => ({
      observation: o,
      candidates: await getCandidatesByObservation(o.id),
    })),
  );

  return NextResponse.json({
    jobId,
    status: "completed",
    observations: enriched,
    count: enriched.length,
  });
}
