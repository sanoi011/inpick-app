/**
 * Product reranker — VLM 보조 검증 + 규칙 기반 rerank.
 *
 * 가이드: §1-2 Visual RAG + §1-4 Structured Output
 *
 * 단계:
 *   1. retrieve로 받은 Top-K 후보 (예: K=20)
 *   2. (옵션) Claude Vision / OpenAI Vision으로 후보 vs observation crop 검증
 *   3. category 호환성, OCR 텍스트 매칭, 색상 일치 등 규칙 보강
 *   4. 점수 재계산 → 최종 Top-N 반환
 *
 * 정책:
 *   - VLM 호출은 비용 — Top-K 중 상위 후보만 (예: 5개)
 *   - VLM은 신규 SKU 절대 생성 안 함 (검증만)
 *   - JSON Schema (Anthropic tool_use 또는 OpenAI Structured Outputs) 사용
 */

import type { MaterialProductCandidate, SurfaceObservation } from "./types";
import { computeMaterialCandidateScore } from "./confidence";

export interface RerankInput {
  observation: SurfaceObservation;
  candidates: MaterialProductCandidate[];
  /** 상위 N개만 반환 (default 5) */
  topN?: number;
  /** VLM 검증 활성화 (default false — 비용 보호) */
  useVlmRerank?: boolean;
}

/**
 * 후보 rerank.
 * 현재 구현 (Phase 5 minimal):
 *   - 규칙 기반만 (VLM 미사용)
 *   - 색상 매칭 점수 보강
 *   - OCR 매칭 점수 보강
 *   - Top-N 반환
 *
 * 후속 (Phase 5 후반):
 *   - useVlmRerank=true 시 Claude Vision 호출 (Top-5 검증)
 *   - JSON Schema로 sku-by-id 응답 강제 (hallucination 차단)
 */
export async function rerankCandidates(input: RerankInput): Promise<MaterialProductCandidate[]> {
  const { observation, candidates } = input;
  const topN = input.topN ?? 5;

  if (candidates.length === 0) return [];

  // ─── 색상 매칭 점수 ───
  const obsColors = observation.dominantColors || [];
  const obsTopColor = obsColors[0]?.hex || "";

  // ─── OCR 매칭 점수 ───
  const ocr = (observation.ocrText || "").toLowerCase();

  const reranked = candidates.map((c) => {
    let colorScore = c.scores.color;
    let ocrScore = c.scores.ocr;
    const reasons = [...c.reasons];
    const warnings = [...c.warnings];

    // 색상 매칭 — 단순히 hex 거리 계산 (production은 LAB color space 권장)
    if (obsTopColor) {
      // 후보의 색상 정보가 product_name/spec에 있을 수 있음 — 간단 keyword
      const productName = (c.productName || "").toLowerCase();
      const spec = (c.spec || "").toLowerCase();
      const text = `${productName} ${spec}`;
      // 자주 등장하는 컬러 키워드와 obsTopColor의 대략적 매칭 (간단)
      const colorKeywords = ["white", "그레이", "gray", "black", "검정", "브라운", "brown", "베이지", "beige", "오크", "oak", "월넛", "walnut"];
      const matchedColor = colorKeywords.find((k) => text.includes(k));
      if (matchedColor) {
        colorScore = Math.min(1, colorScore + 0.2);
        reasons.push(`color hint match: ${matchedColor}`);
      }
    }

    // OCR 매칭 — 브랜드/품명/SKU 텍스트가 OCR에 포함됐는지
    if (ocr.length > 2) {
      const brand = (c.brand || "").toLowerCase();
      const productName = (c.productName || "").toLowerCase();
      const sku = (c.sku || "").toLowerCase();
      if (brand && ocr.includes(brand)) {
        ocrScore = Math.max(ocrScore, 0.9);
        reasons.push(`OCR brand match: ${c.brand}`);
      } else if (productName && ocr.includes(productName.slice(0, 6))) {
        ocrScore = Math.max(ocrScore, 0.7);
        reasons.push(`OCR product name partial match`);
      } else if (sku && ocr.includes(sku)) {
        ocrScore = Math.max(ocrScore, 1.0);
        reasons.push(`OCR SKU exact match: ${c.sku}`);
      }
    }

    const newScores = {
      ...c.scores,
      color: colorScore,
      ocr: ocrScore,
      total: 0,
    };
    newScores.total = computeMaterialCandidateScore(newScores);

    return {
      ...c,
      scores: newScores,
      confidence: Math.max(0, Math.min(1, newScores.total)),
      reasons,
      warnings,
    };
  });

  // 점수 내림차순 정렬
  reranked.sort((a, b) => b.scores.total - a.scores.total);

  // rank 재할당
  reranked.forEach((c, i) => {
    c.rank = i + 1;
  });

  // ─── (옵션) VLM 검증 — Phase 5 후반/Phase 8에서 활성 ───
  if (input.useVlmRerank) {
    // TODO: Claude Vision 또는 OpenAI Vision 호출
    // 현재는 placeholder — Phase 5 minimal에서는 규칙만
    console.info("[vision-materials/reranker] useVlmRerank=true 요청됨 — Phase 5 minimal에서는 미구현");
  }

  return reranked.slice(0, topN);
}
