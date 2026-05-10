/**
 * Vision Material — Score + Confidence gate.
 *
 * 가이드: §8-4 점수 공식 + §8-5 confidence gate
 *
 * 핵심 정책:
 *   - 견적서 자동 확정은 confidence >= 0.82 + margin >= 0.10 + DB SKU 존재 + price 존재
 *   - 그 외는 추천 후보 또는 generic fallback
 *   - SKU hallucination 절대 금지 — DB에 없는 row 금지
 */

import type {
  CandidateScores,
  MaterialProductCandidate,
  MatchRecommendation,
} from "./types";

/**
 * 가중합 (가이드 §8-4 비율 그대로).
 * 합계 = 1.00.
 */
export function computeMaterialCandidateScore(scores: Omit<CandidateScores, "total">): number {
  return (
    scores.category * 0.30 +
    scores.visual * 0.25 +
    scores.texture * 0.10 +
    scores.color * 0.10 +
    scores.ocr * 0.10 +
    scores.price * 0.05 +
    scores.roomRule * 0.07 +
    scores.budgetStyle * 0.03
  );
}

/**
 * Total score → confidence (0~1).
 * 기본 동일하되 정규화 + 클램프.
 */
export function totalToConfidence(total: number): number {
  return Math.max(0, Math.min(1, total));
}

// ─── confidence gate (§8-5) ───
export const CONFIDENCE_THRESHOLDS = {
  AUTO_CONFIRM: 0.82,
  AUTO_MARGIN: 0.10,
  RECOMMEND: 0.60,
} as const;

/**
 * Top-K 후보로부터 매칭 결정.
 *
 * 규칙:
 *   - top1.confidence >= 0.82 AND (top1 - top2) >= 0.10 AND DB SKU 존재 AND 단가 존재 → confirmed
 *   - top1.confidence >= 0.60 AND DB SKU 존재 → recommended (단가 없으면 fallbackReason 기록)
 *   - 그 외 → fallback (generic 단가 사용)
 */
export function decideMaterialMatch(
  candidates: MaterialProductCandidate[],
  options: {
    /** 카테고리/방 호환성 검증 결과 — 부적합 시 confirmed 금지 */
    categoryCompatible?: boolean;
  } = {},
): MatchRecommendation {
  const top1 = candidates[0];
  const top2 = candidates[1];

  if (!top1) {
    return {
      status: "fallback",
      confidence: 0,
      fallbackReason: "NO_PRODUCT_CANDIDATE",
      displayLabel: "[기본] 제품 후보 없음 — 표준 단가 적용",
    };
  }

  const margin = top2 ? top1.confidence - top2.confidence : top1.confidence;
  const hasPrice = typeof top1.unitPrice === "number" && top1.unitPrice > 0;
  const hasDbSku = Boolean(top1.materialProductId);
  const compatible = options.categoryCompatible !== false; // 기본 true (명시적으로 false일 때만 차단)

  // 자동 확정
  if (
    top1.confidence >= CONFIDENCE_THRESHOLDS.AUTO_CONFIRM &&
    margin >= CONFIDENCE_THRESHOLDS.AUTO_MARGIN &&
    hasDbSku &&
    hasPrice &&
    compatible
  ) {
    return {
      status: "confirmed",
      selectedMaterialProductId: top1.materialProductId,
      confidence: top1.confidence,
      displayLabel: `[확정] ${top1.brand ? top1.brand + " " : ""}${top1.productName}${top1.sku ? ` / ${top1.sku}` : ""}`,
    };
  }

  // 추천 후보
  if (top1.confidence >= CONFIDENCE_THRESHOLDS.RECOMMEND && hasDbSku) {
    const reason = !compatible
      ? "CATEGORY_ROOM_INCOMPATIBLE"
      : !hasPrice
        ? "PRICE_MISSING_RECOMMENDATION_ONLY"
        : margin < CONFIDENCE_THRESHOLDS.AUTO_MARGIN
          ? "TOP_MARGIN_TOO_SMALL"
          : "BELOW_AUTO_THRESHOLD";
    return {
      status: "recommended",
      selectedMaterialProductId: top1.materialProductId,
      confidence: top1.confidence,
      fallbackReason: reason,
      displayLabel: `[추천] ${top1.brand ? top1.brand + " " : ""}${top1.productName} (신뢰도 ${Math.round(top1.confidence * 100)}%)`,
    };
  }

  // Fallback
  return {
    status: "fallback",
    confidence: top1.confidence,
    fallbackReason: "LOW_CONFIDENCE_USE_GENERIC_PRICE",
    displayLabel: "[기본] 추정 부정확 — 표준 단가 적용",
  };
}

/**
 * 전체 분석 결과 summary 통계.
 */
export interface SummaryCounts {
  observationCount: number;
  highConfidenceCount: number;
  recommendedCount: number;
  fallbackCount: number;
}

export function summarizeRecommendations(
  recs: MatchRecommendation[],
): SummaryCounts {
  return {
    observationCount: recs.length,
    highConfidenceCount: recs.filter((r) => r.status === "confirmed").length,
    recommendedCount: recs.filter((r) => r.status === "recommended").length,
    fallbackCount: recs.filter((r) => r.status === "fallback").length,
  };
}
