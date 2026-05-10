/**
 * RunPod image generation backend — Phase 1 placeholder.
 *
 * 가이드: c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md §6 (RunPod / GPU worker 설계)
 *
 * Phase 1 (현재): placeholder — env 미설정 시 명확한 에러, 설정 시 미구현 안내
 * Phase 2 (Prompt 2 이후): async job + polling 추가
 * Phase 3 (Prompt 3 이후): storage URL 반환
 * Phase 5 (Prompt 5 이후): 실제 RunPod handler.py + endpoint 호출
 *
 * 기존 sam-runpod-client.ts 패턴 (sync timeout 90s + async max wait 240s + poll 1.5s) 재사용 가능.
 */

import { assertModelAllowedForRuntime } from "./model-policy";
import { ensureStorageUrl } from "@/lib/inpick/storage/image-storage";
import type {
  ImageGenerationBackend,
  RenderRoomRequest,
  RenderRoomResult,
} from "./types";

const DEFAULT_MODEL_ID =
  process.env.INPICK_IMAGE_MODEL_ID || "black-forest-labs/FLUX.2-klein-4b";

/**
 * Phase 1 placeholder 구현.
 * - env 검증 (RUNPOD_API_KEY, RUNPOD_FLUX_ENDPOINT)
 * - 모델 정책 검증 (FLUX.1-dev 등 production 차단)
 * - 실제 호출은 Phase 5에서 구현
 */
export class RunPodBackend implements ImageGenerationBackend {
  readonly name = "runpod" as const;

  async renderRoom(input: RenderRoomRequest): Promise<RenderRoomResult> {
    const t0 = Date.now();

    // ─── 1. 환경 검증 ───
    const apiKey = process.env.RUNPOD_API_KEY;
    const endpoint =
      process.env.RUNPOD_FLUX_ENDPOINT ||
      process.env.RUNPOD_SYNC_ENDPOINT ||
      process.env.RUNPOD_ASYNC_ENDPOINT;

    if (!apiKey || !endpoint) {
      return {
        backend: "runpod",
        model: DEFAULT_MODEL_ID,
        status: "failed",
        error: "RunPod 환경변수 미설정",
        hint:
          "Vercel/.env.local에 RUNPOD_API_KEY + RUNPOD_FLUX_ENDPOINT 설정 필요. " +
          "Phase 5 (Prompt 5)에서 worker scaffold 후 활성화.",
        modelStatus: "auth",
        elapsedMs: Date.now() - t0,
      };
    }

    // ─── 2. 모델 정책 검증 (production guard) ───
    try {
      assertModelAllowedForRuntime(DEFAULT_MODEL_ID);
    } catch (e) {
      return {
        backend: "runpod",
        model: DEFAULT_MODEL_ID,
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
        hint:
          "production에서 미허용 모델. INPICK_IMAGE_MODEL_ID 환경변수에 production 허용 모델 설정 필요. " +
          "또는 BFL_COMMERCIAL_LICENSE_CONFIRMED=true override.",
        modelStatus: "blocked",
        elapsedMs: Date.now() - t0,
      };
    }

    // ─── 3. Phase 1 placeholder — 실제 호출 미구현 ───
    return {
      backend: "runpod",
      model: DEFAULT_MODEL_ID,
      status: "failed",
      error: "RunPod backend 미구현 (Phase 5 이후)",
      hint:
        "Phase 5 (Prompt 5)에서 RunPod worker scaffold 작성 + 실제 호출 구현. " +
        "지금은 IMAGE_GEN_BACKEND=openai 사용 권장.",
      modelStatus: "blocked",
      metadata: {
        phase: 1,
        nextPhase: 5,
        endpoint: endpoint.replace(/\/[a-z0-9-]+\/(?:run|runsync|status).*$/i, "/<id>/..."),
        plannedFlow: [
          "1. floorplanImageUrl → fetch + base64",
          "2. roomGeometry 있으면 proxy control image (Phase 6)",
          "3. POST RunPod /run (async) 또는 /runsync (PoC)",
          "4. response → imageUrl (storage URL — Phase 3)",
        ],
      },
      elapsedMs: Date.now() - t0,
    };
  }

  async getJobStatus(jobId: string): Promise<RenderRoomResult> {
    // Phase 2에서 구현 — 현재는 placeholder
    return {
      backend: "runpod",
      model: DEFAULT_MODEL_ID,
      status: "failed",
      error: "RunPod job status 조회 미구현 (Phase 2 이후)",
      hint: "Phase 2 (Prompt 2)에서 GET /api/inpick/render-room/jobs/[jobId] endpoint 작성",
      jobId,
    };
  }
}

/** Singleton */
let _instance: RunPodBackend | null = null;
export function getRunPodBackend(): RunPodBackend {
  if (!_instance) _instance = new RunPodBackend();
  return _instance;
}
