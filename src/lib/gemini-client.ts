/**
 * Gemini 클라이언트 — DEPRECATED (2026-05-10).
 *
 * 정책: AI_PROVIDER_POLICY=anthropic_openai_runpod_only (default)
 *      → Gemini provider 사용 금지.
 *
 * 동작:
 *   - isGeminiConfigured(): API 키 존재 + 정책 허용 시에만 true
 *   - getGeminiClient(): 정책 차단 시 항상 null
 *   - 결과적으로 기존 라우트의 fallback path가 자동 활성화됨
 *
 * 가이드: docs/ops/GEMINI_REMOVAL_AUDIT.md
 *
 * 후속 작업:
 *   - 이 파일을 부르는 라우트가 0개 되면 파일 삭제
 *   - Vision 라우트는 OpenAI gpt-image-2 / Anthropic Claude Vision으로 마이그레이션
 */
import { GoogleGenAI } from "@google/genai";
import { isAIProviderAllowed } from "./ai/model-registry";

let instance: GoogleGenAI | null = null;
let warnedDeprecated = false;

/**
 * Gemini 사용 가능 여부.
 * 1. 정책 (AI_PROVIDER_POLICY)이 gemini를 허용해야 함 — default 차단
 * 2. GOOGLE_GEMINI_API_KEY 설정되어 있어야 함
 *
 * 둘 중 하나라도 안 되면 false → 호출자는 mock/fallback path 사용.
 */
export function isGeminiConfigured(): boolean {
  // 1. 정책 차단 (default)
  if (!isAIProviderAllowed("gemini")) {
    if (!warnedDeprecated && process.env.NODE_ENV !== "production") {
      console.warn(
        "[gemini-client] Gemini provider blocked by AI_PROVIDER_POLICY. " +
          "Routes will use fallback path. " +
          "(docs/ops/GEMINI_REMOVAL_AUDIT.md 참조)",
      );
      warnedDeprecated = true;
    }
    return false;
  }
  // 2. 키 검증
  const key = process.env.GOOGLE_GEMINI_API_KEY;
  return !!key && key.length > 10;
}

export function getGeminiClient(): GoogleGenAI | null {
  if (!isGeminiConfigured()) return null;
  if (!instance) {
    instance = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });
  }
  return instance;
}
