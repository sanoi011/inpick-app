/**
 * EstimatePrecisionLevel — 견적 정확도 5단계.
 * 가이드: inpick-ultra-precision-estimate-engine-v3-dev-plan-20260513.md §2
 *
 * AI 시대에도 "확정 입력값 기준 100% 계산"이 가능하지만, 현장 조건은 100% 알 수 없다.
 * 따라서 견적에 정확도 레벨을 명시한다.
 */
import type { ConstructionEstimate, ConstructionEstimateLine } from "@/lib/inpick/estimate-v2/types";

export type EstimatePrecisionLevel =
  | "L0_AREA_ONLY"
  | "L1_DESIGN_CONTEXT"
  | "L2_VISION_EVIDENCE"
  | "L3_DB_PRODUCT_LOCKED"
  | "L4_USER_CONFIRMED"
  | "L5_CONTRACTOR_VERIFIED";

export interface PrecisionLevelInfo {
  level: EstimatePrecisionLevel;
  label: string;
  description: string;
  colorClass: string;
  emoji: string;
}

export const PRECISION_LEVEL_INFO: Record<EstimatePrecisionLevel, PrecisionLevelInfo> = {
  L0_AREA_ONLY: {
    level: "L0_AREA_ONLY",
    label: "L0 면적 기반 가견적",
    description: "평수/업종만으로 산출 — 정밀도 낮음. 도면 또는 이미지 추가로 정확도 향상.",
    colorClass: "bg-rose-100 text-rose-800 border-rose-300",
    emoji: "📐",
  },
  L1_DESIGN_CONTEXT: {
    level: "L1_DESIGN_CONTEXT",
    label: "L1 디자인 기반 견적",
    description: "Step2 이미지/프롬프트 반영. 자재는 카테고리 기본값으로 추정.",
    colorClass: "bg-amber-100 text-amber-800 border-amber-300",
    emoji: "🎨",
  },
  L2_VISION_EVIDENCE: {
    level: "L2_VISION_EVIDENCE",
    label: "L2 이미지 분석 견적",
    description: "Vision 자재 분석 완료. DB 상품 추천 반영.",
    colorClass: "bg-sky-100 text-sky-800 border-sky-300",
    emoji: "👁️",
  },
  L3_DB_PRODUCT_LOCKED: {
    level: "L3_DB_PRODUCT_LOCKED",
    label: "L3 DB 상품 확정 정밀 견적",
    description: "주요 라인이 material_products + material_price_lookup 매칭 — 브랜드/SKU/단가 출처 명시.",
    colorClass: "bg-blue-100 text-blue-800 border-blue-300",
    emoji: "🔒",
  },
  L4_USER_CONFIRMED: {
    level: "L4_USER_CONFIRMED",
    label: "L4 사용자 확정 견적",
    description: "사용자가 부위·자재·공사범위 확정. RFQ 발송 준비 완료.",
    colorClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    emoji: "✅",
  },
  L5_CONTRACTOR_VERIFIED: {
    level: "L5_CONTRACTOR_VERIFIED",
    label: "L5 사업자 검수 견적",
    description: "사업자가 현장/도면 검수 후 수정·확정한 견적. 계약 직전.",
    colorClass: "bg-violet-100 text-violet-800 border-violet-300",
    emoji: "🏆",
  },
};

export interface PrecisionScoreBreakdown {
  level: EstimatePrecisionLevel;
  info: PrecisionLevelInfo;
  /** 0~100 점수 */
  score: number;
  /** 라인 source 분포 */
  lineStats: {
    total: number;
    userSelected: number;
    visionConfirmed: number;
    visionRecommended: number;
    productLocked: number;
    promptExtracted: number;
    standardFallback: number;
    highValueFallback: number;
  };
  recommendations: string[];
}

/**
 * 견적의 정확도 레벨 자동 산정.
 *
 * 규칙:
 *   - 라인이 0개 또는 모두 fallback → L0
 *   - design_output evidence 있음 → L1
 *   - vision 자재 분석 결과 있음 → L2
 *   - DB 상품 확정(product_match_status=confirmed/recommended) 비율 ≥ 50% → L3
 *   - 사용자 자재 선택 비율 ≥ 30% 또는 user_material_edits > 5 → L4
 *   - 사업자 검수 표시 (contract status) → L5 (RFQ 후)
 */
export function computePrecisionLevel(
  estimate: ConstructionEstimate | null,
  extras?: {
    hasContractorReview?: boolean;
    userConfirmedScopeCount?: number;
  },
): PrecisionScoreBreakdown {
  const lineStats = {
    total: 0,
    userSelected: 0,
    visionConfirmed: 0,
    visionRecommended: 0,
    productLocked: 0,
    promptExtracted: 0,
    standardFallback: 0,
    highValueFallback: 0,
  };
  const recommendations: string[] = [];

  if (!estimate || estimate.lines.length === 0) {
    return {
      level: "L0_AREA_ONLY",
      info: PRECISION_LEVEL_INFO.L0_AREA_ONLY,
      score: 20,
      lineStats,
      recommendations: ["견적 데이터가 없습니다. Step1/Step2 진행 후 다시 확인하세요."],
    };
  }

  const HIGH_VALUE_THRESHOLD = 500_000;
  for (const l of estimate.lines as ConstructionEstimateLine[]) {
    lineStats.total++;
    if (l.source === "user_selected_material") lineStats.userSelected++;
    else if (l.source === "vision_confirmed_material") lineStats.visionConfirmed++;
    else if (l.source === "vision_recommended_material") lineStats.visionRecommended++;
    else if (l.source === "prompt_extracted_material") lineStats.promptExtracted++;
    else if (l.source === "standard_fallback_material") {
      lineStats.standardFallback++;
      if (l.totalAmount >= HIGH_VALUE_THRESHOLD) lineStats.highValueFallback++;
    }
    if (l.productMatchStatus === "confirmed" || l.productMatchStatus === "recommended") {
      lineStats.productLocked++;
    }
  }

  // 레벨 결정 (가장 높은 만족 레벨)
  let level: EstimatePrecisionLevel = "L0_AREA_ONLY";
  const total = lineStats.total;

  if (lineStats.userSelected / total >= 0.3 || (extras?.userConfirmedScopeCount ?? 0) >= 3) {
    level = "L4_USER_CONFIRMED";
  } else if (lineStats.productLocked / total >= 0.5) {
    level = "L3_DB_PRODUCT_LOCKED";
  } else if (lineStats.visionConfirmed + lineStats.visionRecommended > 0) {
    level = "L2_VISION_EVIDENCE";
  } else if (lineStats.promptExtracted > 0 || total > 0) {
    level = "L1_DESIGN_CONTEXT";
  }

  if (extras?.hasContractorReview) {
    level = "L5_CONTRACTOR_VERIFIED";
  }

  // Score 0~100
  const score = Math.min(
    100,
    Math.round(
      (lineStats.userSelected * 1.0 +
        lineStats.productLocked * 0.85 +
        lineStats.visionConfirmed * 0.75 +
        lineStats.visionRecommended * 0.6 +
        lineStats.promptExtracted * 0.4 +
        lineStats.standardFallback * 0.2) *
        (100 / total),
    ),
  );

  // 추천 사항
  if (lineStats.highValueFallback > 0) {
    recommendations.push(
      `⚠️ 고액(₩500K+) 항목 ${lineStats.highValueFallback}건이 표준 fallback — 사용자 자재 선택 또는 사업자 검수 권장`,
    );
  }
  if (lineStats.userSelected === 0 && level !== "L5_CONTRACTOR_VERIFIED") {
    recommendations.push("주요 자재를 직접 선택하면 L4 확정 견적으로 격상됩니다.");
  }
  if (lineStats.productLocked / total < 0.3) {
    recommendations.push(
      "DB 상품 매칭 비율이 낮습니다. material_products seed 보강 또는 Vision 자재 분석 재실행이 필요합니다.",
    );
  }
  if (lineStats.standardFallback / total > 0.5) {
    recommendations.push(
      `라인 중 ${Math.round((lineStats.standardFallback / total) * 100)}%가 표준 fallback — 카테고리 taxonomy seed 적용 또는 사용자 입력 보강 필요`,
    );
  }

  return {
    level,
    info: PRECISION_LEVEL_INFO[level],
    score,
    lineStats,
    recommendations,
  };
}
