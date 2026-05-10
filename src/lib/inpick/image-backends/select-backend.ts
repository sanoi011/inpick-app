/**
 * Backend selector — env 기반 자동 분기 + fallback.
 *
 * 가이드: c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md §10 (환경변수)
 *
 * 환경변수:
 *   IMAGE_GEN_BACKEND=openai|runpod|auto  (default: openai 안전쪽)
 *   OPENAI_IMAGE_FALLBACK_ENABLED=true (auto 모드에서 RunPod 실패 시 OpenAI 시도)
 *
 * 정책:
 *   - "openai": OpenAI만 (현재 기본값)
 *   - "runpod": RunPod만 (Phase 5 이후 활성화)
 *   - "auto": 우선 RunPod, 실패 시 OpenAI fallback (Phase 5 이후)
 *
 * 안전장치:
 *   - production에서 처음부터 backend default를 runpod로 바꾸지 않는다 (가이드 §12)
 *   - evaluation harness 통과 후 명시 변경 (가이드 §13 Phase 8)
 */

import { hasOpenAIKey } from "@/lib/inpick/openai-env";
import { getOpenAIBackend } from "./openai-backend";
import { getRunPodBackend } from "./runpod-backend";
import type {
  ImageBackendName,
  ImageGenerationBackend,
  RenderRoomRequest,
  RenderRoomResult,
  BackendSelectionContext,
} from "./types";

/**
 * 환경변수에서 선호 백엔드 읽기.
 * 미설정 시 "openai" (안전 기본값).
 *
 * Phase 10 production guardrail (가이드 §13):
 *   - production 환경에서 backend=runpod 또는 auto로 변경하려면
 *     INPICK_EVAL_REPORT_PASSED=true 환경변수 명시 필요.
 *   - 미설정 시 production은 무조건 "openai" 강제 (안전).
 *   - 비production (dev/test/PoC)은 자유.
 */
export function getPreferredBackend(): ImageBackendName {
  const env = (process.env.IMAGE_GEN_BACKEND || "openai").toLowerCase();
  const requested: ImageBackendName =
    env === "runpod" || env === "auto" ? env : "openai";

  // Phase 10 — production guardrail
  if (process.env.NODE_ENV === "production" && requested !== "openai") {
    const evalPassed = process.env.INPICK_EVAL_REPORT_PASSED === "true";
    if (!evalPassed) {
      console.warn(
        `[select-backend] Production guardrail: IMAGE_GEN_BACKEND=${requested} requested ` +
          `but INPICK_EVAL_REPORT_PASSED!=true. Forcing "openai" for safety. ` +
          `가이드 §13: evaluation harness 통과 후 backend 변경.`,
      );
      return "openai";
    }
  }
  return requested;
}

/**
 * Backend 선택 컨텍스트 빌드.
 */
export function buildSelectionContext(): BackendSelectionContext {
  return {
    preferredBackend: getPreferredBackend(),
    isProduction: process.env.NODE_ENV === "production",
    hasOpenAIKey: hasOpenAIKey(),
    hasRunpodConfig: !!(
      process.env.RUNPOD_API_KEY &&
      (process.env.RUNPOD_FLUX_ENDPOINT ||
        process.env.RUNPOD_SYNC_ENDPOINT ||
        process.env.RUNPOD_ASYNC_ENDPOINT)
    ),
  };
}

/**
 * 단일 backend 인스턴스 반환 (분기 X — 명시 호출).
 */
export function getBackend(name: "openai" | "runpod"): ImageGenerationBackend {
  return name === "openai" ? getOpenAIBackend() : getRunPodBackend();
}

/**
 * 메인 엔트리포인트 — render-room route에서 호출.
 *
 * 1. preferredBackend 결정 (env)
 * 2. "auto" 모드: RunPod 시도 → 실패 시 OpenAI fallback (env로 토글)
 * 3. 명시 모드: 해당 backend만 호출, 실패해도 fallback X
 *
 * 결과는 RenderRoomResult (성공/실패 모두 동일 shape).
 */
export async function renderRoomViaBackend(
  input: RenderRoomRequest,
): Promise<RenderRoomResult> {
  const ctx = buildSelectionContext();
  const preferred = ctx.preferredBackend ?? "openai";

  // ─── 명시 모드 (openai 또는 runpod 단일) ───
  if (preferred === "openai") {
    return getOpenAIBackend().renderRoom(input);
  }
  if (preferred === "runpod") {
    return getRunPodBackend().renderRoom(input);
  }

  // ─── "auto" 모드 — RunPod 우선 + OpenAI fallback ───
  const fallbackEnabled = process.env.OPENAI_IMAGE_FALLBACK_ENABLED !== "false";

  // RunPod 시도
  const runpodResult = await getRunPodBackend().renderRoom(input);
  if (runpodResult.status === "completed") return runpodResult;

  // 실패 — fallback 가능 여부 판단
  if (!fallbackEnabled) {
    return runpodResult; // 사용자 정책상 fallback 비활성
  }
  if (!ctx.hasOpenAIKey) {
    return {
      ...runpodResult,
      hint:
        (runpodResult.hint || "") +
        " | OpenAI fallback 가능했으나 OPENAI_API_KEY 미설정.",
    };
  }

  // OpenAI fallback 시도
  const openaiResult = await getOpenAIBackend().renderRoom(input);
  if (openaiResult.status === "completed") {
    return {
      ...openaiResult,
      metadata: {
        ...(openaiResult.metadata || {}),
        fallbackFrom: "runpod",
        runpodError: runpodResult.error,
      },
    };
  }

  // 둘 다 실패 — RunPod 에러를 primary로 반환 (사용자 정책)
  return {
    ...runpodResult,
    error: `RunPod: ${runpodResult.error} | OpenAI fallback: ${openaiResult.error}`,
    hint: runpodResult.hint || openaiResult.hint,
  };
}
