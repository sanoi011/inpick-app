/**
 * POST /api/inpick/sam/warmup
 *
 * Cold start 회피용 — 사용자가 Step2 진입 시 호출.
 * 1×1 더미 이미지로 RunPod Serverless 워커 사전 가동.
 *
 * 가이드 §2 RunPodSAMClient.warmup 동등.
 */
import { NextResponse } from "next/server";
import { samWarmup, isSamRunPodConfigured } from "@/lib/inpick/sam-runpod-client";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST() {
  if (!isSamRunPodConfigured()) {
    return NextResponse.json(
      {
        warmed_up: false,
        hint: "영역 분할 서비스 미활성 (RUNPOD_API_KEY/RUNPOD_SAM_ENDPOINT_ID 미등록)",
      },
      { status: 200 }, // warmup은 실패해도 사용자 차단 X
    );
  }

  const ok = await samWarmup();
  return NextResponse.json({ warmed_up: ok });
}
