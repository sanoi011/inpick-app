/**
 * INPICK 정형화·비전·견적 최상위 모델 정책.
 *
 * 공식 OpenAI 모델 문서(2026-07-15 확인):
 * - 실사용 모델 ID: gpt-5.6-sol (GPT-5.6 Sol)
 * - image input, structured outputs, Chat Completions 지원
 *
 * 정책: gpt-5.6-sol을 항상 1순위로 사용하고, 계정 권한·모델 혼잡·일시 장애에서만
 * 이전 frontier인 gpt-5.5로 안전 폴백한다. 임의로 소형 모델을 선택하지 않는다.
 */
export const INPICK_FRONTIER_MODEL = "gpt-5.6-sol" as const;
export const INPICK_FRONTIER_MODEL_LABEL = "GPT-5.6 Sol" as const;
export const INPICK_FRONTIER_FALLBACK_MODEL = "gpt-5.5" as const;
export const INPICK_FRONTIER_FALLBACK_LABEL = "GPT-5.5" as const;

export const INPICK_VISION_MODEL = INPICK_FRONTIER_MODEL;
export const INPICK_ESTIMATE_MODEL = INPICK_FRONTIER_MODEL;

export const INPICK_FRONTIER_MODEL_CANDIDATES = [
  INPICK_FRONTIER_MODEL,
  INPICK_FRONTIER_FALLBACK_MODEL,
] as const;

export function isRecoverableFrontierModelError(status: number, message: string): boolean {
  const lower = message.toLowerCase();
  return (
    status === 403 ||
    status === 404 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    lower.includes("model_not_found") ||
    lower.includes("does not have access") ||
    lower.includes("at capacity") ||
    lower.includes("overloaded")
  );
}
