/**
 * Estimate bridge — vision-materials 결과 → 17공종 견적 라인 metadata.
 *
 * 가이드: §9 (견적 엔진 통합)
 *
 * 책임:
 *   1. AnalyzedSurface[] → estimateLineId 매핑 (room + surfaceType 기반)
 *   2. confirmed/recommended/fallback 구분
 *   3. material_estimate_line_links에 저장
 *   4. PDF용 displayLabel 제공
 *
 * 정책:
 *   - confirmed만 자동 단가 적용
 *   - recommended는 단가 표시하되 사용자 선택 권장
 *   - fallback은 generic 단가 (estimate.ts KPA fallback)
 */

import type {
  AnalyzedSurface,
  EstimateLineMaterialMeta,
  MatchStatus,
} from "./types";
import { insertEstimateLineLinks } from "./repository";

export interface BridgeInput {
  projectId: string;
  estimateId?: string;
  /** 견적 라인 ID (consolidated row from estimate page) */
  lineMap: Array<{
    estimateLineId: string;
    tradeCode?: string;
    roomId?: string;
    roomName?: string;
    surfaceType?: string;
    quantity?: number;
    unit?: string;
  }>;
  analyzedSurfaces: AnalyzedSurface[];
}

export interface BridgeOutput {
  /** estimateLineId → metadata */
  metaByLineId: Record<string, EstimateLineMaterialMeta>;
  /** 통계 */
  stats: {
    confirmed: number;
    recommended: number;
    fallback: number;
    total: number;
  };
}

/**
 * AnalyzedSurface를 견적 line과 매칭하여 metadata 생성.
 * 매칭 키: roomId + surfaceType (가장 단순) → 동일하면 첫 surface 우선.
 */
export async function bridgeVisionToEstimate(input: BridgeInput): Promise<BridgeOutput> {
  const metaByLineId: Record<string, EstimateLineMaterialMeta> = {};
  const stats = { confirmed: 0, recommended: 0, fallback: 0, total: 0 };

  // 인덱스 — surfaceType + roomId
  const surfaceIndex = new Map<string, AnalyzedSurface>();
  for (const a of input.analyzedSurfaces) {
    const key = surfaceKey(
      a.observation.surfaceType,
      a.observation.id ? "" : "", // roomId는 observation row에 직접 없음 — input에서 매핑
    );
    if (!surfaceIndex.has(key)) {
      surfaceIndex.set(key, a);
    }
  }

  const linksToInsert: Parameters<typeof insertEstimateLineLinks>[0] = [];

  for (const line of input.lineMap) {
    const key = surfaceKey(line.surfaceType || "unknown", "");
    const matched = surfaceIndex.get(key);

    let meta: EstimateLineMaterialMeta;
    if (!matched) {
      // 매칭 없음 — fallback
      meta = {
        matchStatus: "fallback",
        fallbackReason: "NO_OBSERVATION_FOR_LINE",
        candidateCount: 0,
      };
      stats.fallback++;
    } else {
      const top = matched.candidates[0];
      const status: MatchStatus = matched.recommendation.status;
      if (status === "confirmed" && top) {
        meta = {
          materialProductId: top.materialProductId,
          brand: top.brand,
          productName: top.productName,
          sku: top.sku,
          spec: top.spec,
          unit: top.unit,
          unitPrice: top.unitPrice,
          priceSource: top.priceSource,
          matchStatus: "confirmed",
          confidence: top.confidence,
          candidateCount: matched.candidates.length,
          observationId: matched.observation.id,
        };
        stats.confirmed++;
      } else if (status === "recommended" && top) {
        meta = {
          materialProductId: top.materialProductId,
          brand: top.brand,
          productName: top.productName,
          sku: top.sku,
          spec: top.spec,
          unit: top.unit,
          unitPrice: top.unitPrice,
          priceSource: top.priceSource,
          matchStatus: "recommended",
          confidence: top.confidence,
          fallbackReason: matched.recommendation.fallbackReason,
          candidateCount: matched.candidates.length,
          observationId: matched.observation.id,
        };
        stats.recommended++;
      } else {
        meta = {
          matchStatus: "fallback",
          confidence: top?.confidence,
          fallbackReason: matched.recommendation.fallbackReason || "LOW_CONFIDENCE",
          candidateCount: matched.candidates.length,
          observationId: matched.observation.id,
        };
        stats.fallback++;
      }
    }

    metaByLineId[line.estimateLineId] = meta;
    stats.total++;

    // DB 저장 (mock observation은 skip)
    if (!meta.observationId || !meta.observationId.startsWith("mock-")) {
      // matchStatus는 "rejected" 제외 — DB 컬럼이 confirmed/recommended/fallback만 허용
      const status: "confirmed" | "recommended" | "fallback" =
        meta.matchStatus === "rejected" ? "fallback" : meta.matchStatus;
      linksToInsert.push({
        projectId: input.projectId,
        estimateId: input.estimateId,
        estimateLineId: line.estimateLineId,
        observationId: meta.observationId,
        materialProductId: meta.materialProductId,
        tradeCode: line.tradeCode,
        roomId: line.roomId,
        roomName: line.roomName,
        surfaceType: line.surfaceType,
        quantity: line.quantity,
        unit: meta.unit || line.unit,
        unitPrice: meta.unitPrice,
        priceSource: meta.priceSource,
        confidence: meta.confidence,
        matchStatus: status,
        fallbackReason: meta.fallbackReason,
      });
    }
  }

  if (linksToInsert.length > 0) {
    await insertEstimateLineLinks(linksToInsert);
  }

  return { metaByLineId, stats };
}

function surfaceKey(surfaceType: string, roomId: string): string {
  return `${roomId || ""}::${surfaceType}`;
}

/**
 * PDF 표시용 displayLabel 생성 (가이드 §9-4).
 *
 * [확정] LX Z:IN / 지아자연애 2.2T / SKU: LX-... / ㎡당 00,000원
 * [추천] 동화자연마루 / 나투스진 오크 / 후보 신뢰도 72% / 사용자 확인 필요
 * [기본] 강마루 일반형 / SKU 미확정 / 표준 단가 적용
 */
export function buildDisplayLabel(meta: EstimateLineMaterialMeta): string {
  if (meta.matchStatus === "confirmed") {
    const parts: string[] = ["[확정]"];
    if (meta.brand) parts.push(meta.brand);
    if (meta.productName) parts.push(`/ ${meta.productName}`);
    if (meta.sku) parts.push(`/ SKU: ${meta.sku}`);
    if (meta.unitPrice) parts.push(`/ ${meta.unit || "EA"}당 ${meta.unitPrice.toLocaleString()}원`);
    return parts.join(" ");
  }
  if (meta.matchStatus === "recommended") {
    const parts: string[] = ["[추천]"];
    if (meta.brand) parts.push(meta.brand);
    if (meta.productName) parts.push(`/ ${meta.productName}`);
    if (meta.confidence) parts.push(`/ 신뢰도 ${Math.round(meta.confidence * 100)}%`);
    parts.push("/ 사용자 확인 필요");
    return parts.join(" ");
  }
  // fallback
  const parts: string[] = ["[기본]"];
  parts.push("자재 미확정");
  parts.push("/ 표준 단가 적용");
  if (meta.fallbackReason) parts.push(`(${meta.fallbackReason})`);
  return parts.join(" ");
}
