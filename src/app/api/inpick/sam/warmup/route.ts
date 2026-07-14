/**
 * POST /api/inpick/sam/warmup
 *
 * Cold start 회피용 — 사용자가 Step2 진입 시 호출.
 * 1×1 더미 이미지로 RunPod Serverless 워커 사전 가동.
 *
 * 가이드 §2 RunPodSAMClient.warmup 동등.
 */
import { NextResponse } from "next/server";
import {
  samAutoSegment,
  sam31Warmup,
  isSamRunPodConfigured,
  isSam31RunPodConfigured,
} from "@/lib/inpick/sam-runpod-client";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST() {
  if (!isSamRunPodConfigured() && !isSam31RunPodConfigured()) {
    return NextResponse.json(
      {
        warmed_up: false,
        hint: "영역 분할 서비스 미활성 (RunPod SAM 엔드포인트 미등록)",
      },
      { status: 200 },
    );
  }

  // 64x64 white PNG으로 warmup (1x1은 SAM/PIL이 거부)
  const tinyPng =
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAfElEQVR4nNXOQREAIADDsFL/nocIHlyjIGcbZRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncf4OvLpyqgN9ZSiDcwAAAABJRU5ErkJggg==";
  try {
    const start = Date.now();
    const [sam2, sam31] = await Promise.all([
      isSamRunPodConfigured()
        ? samAutoSegment(tinyPng).then((result) => ({ ok: true, result })).catch(() => ({ ok: false, result: null }))
        : Promise.resolve({ ok: false, result: null }),
      isSam31RunPodConfigured() ? sam31Warmup() : Promise.resolve(false),
    ]);
    return NextResponse.json({
      warmed_up: sam2.ok || sam31,
      elapsed_ms: Date.now() - start,
      engines: { sam3_1: sam31, sam2_1: sam2.ok },
      total_regions: sam2.result?.total_regions,
      image_size: sam2.result?.image_size,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[sam/warmup] failed:", msg);
    let hint: string | undefined;
    const lower = msg.toLowerCase();
    if (lower.includes("401") || lower.includes("unauthor")) {
      hint = "RUNPOD_API_KEY 인증 실패 — 키 갱신";
    } else if (lower.includes("404") || lower.includes("endpoint not found") || lower.includes("not found")) {
      hint = "RunPod SAM 엔드포인트 ID가 잘못됐거나 엔드포인트가 없습니다";
    } else if (lower.includes("worker") && lower.includes("error")) {
      hint = "RunPod 워커 내부 에러 — 콘솔에서 worker logs 확인";
    } else if (lower.includes("timeout") || lower.includes("abort")) {
      hint = "RunPod 응답 지연 — 첫 워커 cold start (이미지 pull 중)일 수 있음. 5분 후 재시도";
    } else if (lower.includes("billing") || lower.includes("balance") || lower.includes("insufficient")) {
      hint = "RunPod 잔액 부족";
    }
    return NextResponse.json({
      warmed_up: false,
      error: msg.slice(0, 500),
      hint,
    });
  }
}
