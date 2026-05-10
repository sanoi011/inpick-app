/**
 * AI Provider Registry — InPick 중앙 정책.
 *
 * 작성일: 2026-05-10
 * 정책: GOOGLE_GEMINI_API_KEY 사용 금지 (대표 지시).
 *       AI_PROVIDER_POLICY=anthropic_openai_runpod_only (default)
 *
 * 사용:
 *   import { assertAIProviderAllowed, getActiveAIProvider } from "@/lib/ai/model-registry";
 *   assertAIProviderAllowed("gemini");  // → throw or 501 응답
 *   const ok = isAIProviderAllowed("anthropic"); // boolean
 */

export type AIProvider = "anthropic" | "openai" | "runpod" | "gemini" | "local";
export type AIProviderPolicy =
  | "anthropic_openai_runpod_only" // ← default. Gemini 차단.
  | "all_allowed" // dev/PoC 전용 — production 금지
  | "openai_only"
  | "anthropic_only";

/**
 * 환경변수 AI_PROVIDER_POLICY 읽기.
 * 미설정 시 안전 기본값 (anthropic_openai_runpod_only).
 */
export function getActivePolicy(): AIProviderPolicy {
  const env = (process.env.AI_PROVIDER_POLICY || "anthropic_openai_runpod_only").toLowerCase();
  if (env === "all_allowed") {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[ai-policy] AI_PROVIDER_POLICY=all_allowed은 production에서 위험. " +
          "기본값 anthropic_openai_runpod_only로 강제.",
      );
      return "anthropic_openai_runpod_only";
    }
    return "all_allowed";
  }
  if (env === "openai_only") return "openai_only";
  if (env === "anthropic_only") return "anthropic_only";
  return "anthropic_openai_runpod_only";
}

/**
 * 정책별 허용 provider.
 */
const POLICY_ALLOWED: Record<AIProviderPolicy, ReadonlyArray<AIProvider>> = {
  anthropic_openai_runpod_only: ["anthropic", "openai", "runpod", "local"],
  all_allowed: ["anthropic", "openai", "runpod", "gemini", "local"],
  openai_only: ["openai", "local"],
  anthropic_only: ["anthropic", "local"],
};

/**
 * provider 사용 가능 여부 확인 (boolean).
 */
export function isAIProviderAllowed(provider: AIProvider): boolean {
  const policy = getActivePolicy();
  return POLICY_ALLOWED[policy].includes(provider);
}

/**
 * provider 사용 검증 — 미허용 시 throw.
 * 라우트 진입 시 호출 → 캐치하여 501/403 응답.
 */
export class AIProviderBlockedError extends Error {
  readonly provider: AIProvider;
  readonly policy: AIProviderPolicy;
  constructor(provider: AIProvider, policy: AIProviderPolicy) {
    super(
      `AI provider "${provider}" is blocked under policy "${policy}". ` +
        `Set AI_PROVIDER_POLICY env to override (production: not recommended).`,
    );
    this.name = "AIProviderBlockedError";
    this.provider = provider;
    this.policy = policy;
  }
}

export function assertAIProviderAllowed(provider: AIProvider): void {
  const policy = getActivePolicy();
  if (!POLICY_ALLOWED[policy].includes(provider)) {
    throw new AIProviderBlockedError(provider, policy);
  }
}

/**
 * 환경변수 매트릭스 (health / env-check 라우트용).
 */
export interface AIEnvStatus {
  policy: AIProviderPolicy;
  required: { name: string; present: boolean }[];
  optional: { name: string; present: boolean }[];
  deprecated: { name: string; present: boolean; warning?: string }[];
}

export function getAIEnvStatus(): AIEnvStatus {
  const policy = getActivePolicy();
  const has = (k: string) => !!process.env[k];

  // 정책에 따라 required 다름
  const required: { name: string; present: boolean }[] = [];
  if (policy === "anthropic_only" || policy === "anthropic_openai_runpod_only") {
    required.push({ name: "ANTHROPIC_API_KEY", present: has("ANTHROPIC_API_KEY") });
  }
  if (policy === "openai_only" || policy === "anthropic_openai_runpod_only") {
    required.push({ name: "OPENAI_API_KEY", present: has("OPENAI_API_KEY") });
  }

  const optional: { name: string; present: boolean }[] = [
    { name: "RUNPOD_API_KEY", present: has("RUNPOD_API_KEY") },
    { name: "RUNPOD_FLUX_ENDPOINT", present: has("RUNPOD_FLUX_ENDPOINT") },
    { name: "RUNPOD_SYNC_ENDPOINT", present: has("RUNPOD_SYNC_ENDPOINT") },
    { name: "INPICK_IMAGE_MODEL_ID", present: has("INPICK_IMAGE_MODEL_ID") },
    { name: "IMAGE_GEN_BACKEND", present: has("IMAGE_GEN_BACKEND") },
    { name: "IMAGE_GEN_MODE", present: has("IMAGE_GEN_MODE") },
  ];

  const deprecated: { name: string; present: boolean; warning?: string }[] = [
    {
      name: "GOOGLE_GEMINI_API_KEY",
      present: has("GOOGLE_GEMINI_API_KEY"),
      warning:
        "Gemini는 InPick에서 더 이상 사용하지 않습니다. " +
        "AI_PROVIDER_POLICY=anthropic_openai_runpod_only 정책에 의해 차단됨. " +
        "Vercel 환경변수에서 제거 권장.",
    },
  ];

  return { policy, required, optional, deprecated };
}

/**
 * 라우트에서 사용할 helper — Gemini 호출 직전 차단.
 * 사용:
 *   try {
 *     blockGeminiOrThrow();
 *     // ... Gemini 코드 ...
 *   } catch (e) {
 *     if (e instanceof AIProviderBlockedError) {
 *       return NextResponse.json({ error: "GEMINI_BLOCKED", hint: e.message }, { status: 501 });
 *     }
 *   }
 */
export function blockGeminiOrThrow(): void {
  assertAIProviderAllowed("gemini");
}

/**
 * Hint 메시지 — 클라이언트에 보여줄 수 있음.
 */
export function geminiBlockedHint(): string {
  return (
    "Gemini는 InPick 정책상 사용 중지되었습니다. " +
    "Anthropic Claude / OpenAI / RunPod로 대체된 라우트를 사용하세요. " +
    "(docs/ops/GEMINI_REMOVAL_AUDIT.md 참조)"
  );
}
