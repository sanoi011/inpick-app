/**
 * Model license/runtime policy guard.
 *
 * 가이드: c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md §2 (라이선스/모델 선택 원칙)
 *
 * 핵심 원칙:
 *   - FLUX.1-dev / FLUX [dev] 계열은 상업 라이선스 확인 전 production self-hosting 금지
 *   - 기본값: production allowed = false (안전쪽)
 *   - Override: BFL_COMMERCIAL_LICENSE_CONFIRMED=true 환경변수로만 가능
 *   - Unknown 모델은 throw (백도어 차단)
 */

export type LicenseMode = "apache-2.0" | "commercial-license-required" | "unknown";

export interface ModelPolicy {
  modelId: string;
  provider: "openai" | "runpod" | "bfl" | "local";
  licenseMode: LicenseMode;
  allowedForProduction: boolean;
  reason: string;
  notes?: string;
}

/**
 * 모델 정책 레지스트리 — 신규 모델 추가 시 여기에 등록 + 라이선스 명시.
 * production에서 미등록 모델 사용 시 즉시 throw.
 */
export const MODEL_POLICIES: Record<string, ModelPolicy> = {
  // ─── BFL FLUX 계열 ───
  "black-forest-labs/FLUX.1-dev": {
    modelId: "black-forest-labs/FLUX.1-dev",
    provider: "runpod",
    licenseMode: "commercial-license-required",
    allowedForProduction: false,
    reason:
      "FLUX [dev] 계열은 BFL Non-Commercial License — 상업 라이선스 확인/계약 전 production self-hosting 금지",
    notes: "PoC/내부 테스트만 허용. BFL_COMMERCIAL_LICENSE_CONFIRMED=true 시 override 가능.",
  },
  "black-forest-labs/FLUX.1.1-pro": {
    modelId: "black-forest-labs/FLUX.1.1-pro",
    provider: "bfl",
    licenseMode: "commercial-license-required",
    allowedForProduction: true,
    reason: "BFL API (closed) — 상업 사용 명시적 허용",
    notes: "API 호출당 비용 — bfl.ai 직접 호출 또는 FAL/Replicate 경유",
  },
  "black-forest-labs/FLUX.2-klein-4b": {
    modelId: "black-forest-labs/FLUX.2-klein-4b",
    provider: "runpod",
    licenseMode: "apache-2.0",
    allowedForProduction: true,
    reason: "Apache-2.0 — production 허용. LoRA fine-tune 후보.",
    notes: "공식 모델 카드/라이선스 최종 확인 필요. 4B 빠른 추론용.",
  },
  "black-forest-labs/FLUX.2-klein-4b-base": {
    modelId: "black-forest-labs/FLUX.2-klein-4b-base",
    provider: "runpod",
    licenseMode: "apache-2.0",
    allowedForProduction: true,
    reason: "Apache-2.0 — fine-tune 베이스로 권장",
  },

  // ─── ControlNet (Flux 호환) ───
  "InstantX/FLUX.1-dev-Controlnet-Canny": {
    modelId: "InstantX/FLUX.1-dev-Controlnet-Canny",
    provider: "runpod",
    licenseMode: "commercial-license-required",
    allowedForProduction: false,
    reason: "FLUX.1-dev에 종속 — base 모델 라이선스 따름",
  },

  // ─── OpenAI ───
  "openai/gpt-image-2": {
    modelId: "openai/gpt-image-2",
    provider: "openai",
    licenseMode: "commercial-license-required",
    allowedForProduction: true,
    reason: "OpenAI API 상업 사용 허용 (계정 결제 기반)",
  },
  "openai/gpt-image-1": {
    modelId: "openai/gpt-image-1",
    provider: "openai",
    licenseMode: "commercial-license-required",
    allowedForProduction: true,
    reason: "OpenAI API 상업 사용 허용 (gpt-image-2 fallback)",
  },
  "openai/dall-e-3": {
    modelId: "openai/dall-e-3",
    provider: "openai",
    licenseMode: "commercial-license-required",
    allowedForProduction: true,
    reason: "OpenAI API 상업 사용 허용 (legacy fallback)",
  },
};

/**
 * 런타임에서 모델이 production에서 사용 가능한지 검증.
 * 미허용 시 즉시 throw — 사일런트 fallback 금지.
 */
export function assertModelAllowedForRuntime(modelId: string): void {
  const policy = MODEL_POLICIES[modelId];

  if (!policy) {
    throw new Error(
      `[model-policy] Unknown image model: "${modelId}". ` +
        `MODEL_POLICIES 레지스트리에 등록 필요 (라이선스 명시).`,
    );
  }

  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    return; // dev/test 환경은 자유롭게 (PoC 허용)
  }

  if (policy.allowedForProduction) {
    return; // production 명시 허용
  }

  // production이지만 정책상 금지 — override 확인
  const overrideConfirmed =
    process.env.BFL_COMMERCIAL_LICENSE_CONFIRMED === "true" &&
    policy.provider === "runpod" &&
    policy.licenseMode === "commercial-license-required";

  if (!overrideConfirmed) {
    throw new Error(
      `[model-policy] Model "${modelId}" is NOT allowed in production. ` +
        `Reason: ${policy.reason}. ` +
        `License mode: ${policy.licenseMode}. ` +
        `Override: 상업 라이선스 확보 후 BFL_COMMERCIAL_LICENSE_CONFIRMED=true 환경변수 설정.`,
    );
  }

  // override 활성화됨 — 사용 허용 (감사 로그)
  console.warn(
    `[model-policy] Production override ACTIVE for "${modelId}". ` +
      `Confirmed via BFL_COMMERCIAL_LICENSE_CONFIRMED=true.`,
  );
}

/** 모델 정책 조회 (UI/로그용 — assert 안 함) */
export function getModelPolicy(modelId: string): ModelPolicy | null {
  return MODEL_POLICIES[modelId] ?? null;
}

/** 현재 환경에서 production-허용 모델 목록 */
export function listProductionAllowedModels(): ModelPolicy[] {
  return Object.values(MODEL_POLICIES).filter((p) => p.allowedForProduction);
}
