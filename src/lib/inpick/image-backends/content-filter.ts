/**
 * Content filter / manual review hook — Phase 10.
 *
 * 가이드: c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md
 *        Prompt 10 (Production guardrail)
 *        필수 guardrail: content filter/manual review hook 자리
 *
 * Phase 10 (현재): 인터페이스 + placeholder.
 * Phase 11+ (후속): 실제 검사 로직 통합 (NSFW classifier, brand-trademark, person 감지 등).
 *
 * 사용 시점:
 *   - 이미지 생성 직후 (storage upload 전)
 *   - manual review 큐로 전송 (옵션)
 */

export type ReviewVerdict = "allow" | "block" | "manual_review";

export interface ContentFilterResult {
  verdict: ReviewVerdict;
  /** "nsfw_score": 0~1, "trademark": detected, "person_face": detected 등 */
  signals?: Record<string, unknown>;
  reason?: string;
  /** manual review 큐 ID (Phase 11+) */
  reviewTicketId?: string;
}

export interface ContentFilterInput {
  imageUrl?: string;
  imageBase64?: string;
  prompt: string;
  modelId: string;
  jobId?: string;
  userId?: string;
}

/**
 * Phase 10 — placeholder.
 * 모든 응답을 "allow"로 통과시킴. Phase 11+에서 실제 분류기 연결.
 *
 * Implementation roadmap:
 *   - NSFW: open_nsfw / safety-checker (CLIP 기반)
 *   - Brand trademark: 별도 모델 (LayoutLMv3 or YOLO trademark)
 *   - Person face: face detection (yolov8-face)
 *   - manual_review 큐: Supabase table `content_review_queue`
 */
export async function filterContent(
  input: ContentFilterInput,
): Promise<ContentFilterResult> {
  // Phase 10 — pass-through
  if (process.env.INPICK_CONTENT_FILTER_ENABLED !== "true") {
    return {
      verdict: "allow",
      signals: { phase: 10, mode: "pass-through" },
    };
  }
  // Phase 11+ — 실제 분류
  // const nsfw = await classifyNsfw(input.imageBase64 || input.imageUrl)
  // if (nsfw.score > 0.85) return { verdict: "block", reason: "nsfw", signals: { nsfw } }
  // ...
  return {
    verdict: "allow",
    signals: { phase: 10, mode: "filter-enabled-but-not-implemented" },
  };
}

/**
 * 차단/리뷰 결과를 audit log에 기록 (Phase 11+).
 * 현재는 console만.
 */
export function logFilterDecision(
  result: ContentFilterResult,
  input: ContentFilterInput,
): void {
  if (result.verdict === "allow") return;
  console.warn(
    `[content-filter] verdict=${result.verdict} reason="${result.reason}" ` +
      `prompt="${input.prompt.slice(0, 80)}" model=${input.modelId} jobId=${input.jobId}`,
  );
}
