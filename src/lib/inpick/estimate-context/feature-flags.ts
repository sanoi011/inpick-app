/**
 * Estimate Intelligence Layer 환경변수 진위 헬퍼.
 * 가이드: inpick-estimate-intelligence-layer-implementation-plan-20260512.md §1
 *
 * 운영 권장:
 *   ESTIMATE_ENGINE_MODE=hybrid
 *   ENABLE_ESTIMATE_INTELLIGENCE_LAYER=true
 *   ENABLE_DESIGN_OUTPUTS_PERSISTENCE=true
 *   ENABLE_AUTO_MATERIAL_ANALYSIS=true
 *   ENABLE_ESTIMATE_EVIDENCE_BADGES=true
 */

export type EstimateEngineMode = "legacy" | "evidence" | "hybrid";

function readBool(name: string, defaultValue: boolean): boolean {
  const v = process.env[name];
  if (!v) return defaultValue;
  return v.toLowerCase() === "true" || v === "1";
}

export function getEstimateEngineMode(): EstimateEngineMode {
  const v = (process.env.ESTIMATE_ENGINE_MODE || "hybrid").toLowerCase();
  if (v === "legacy" || v === "evidence" || v === "hybrid") return v;
  return "hybrid";
}

export const FEATURE_FLAGS = {
  estimateEngineMode: getEstimateEngineMode(),
  enableIntelligenceLayer: readBool("ENABLE_ESTIMATE_INTELLIGENCE_LAYER", true),
  enableDesignOutputsPersistence: readBool("ENABLE_DESIGN_OUTPUTS_PERSISTENCE", true),
  enableAutoMaterialAnalysis: readBool("ENABLE_AUTO_MATERIAL_ANALYSIS", true),
  enableEstimateEvidenceBadges: readBool("ENABLE_ESTIMATE_EVIDENCE_BADGES", true),
};

/** 신규 v2 엔진 사용 여부 — legacy 모드면 false, 그 외 hybrid/evidence면 true */
export function shouldUseV2Engine(): boolean {
  return FEATURE_FLAGS.estimateEngineMode !== "legacy";
}

/** evidence 모드는 contextId 강제 — hybrid는 폴백 허용 */
export function shouldRequireContextId(): boolean {
  return FEATURE_FLAGS.estimateEngineMode === "evidence";
}
