/**
 * Price Resolver — ResolvedMaterialProduct → material_price_lookup 단가 매칭.
 * 가이드: inpick-estimate-v2-product-price-pdf-fix-plan-20260513.md §5
 *
 * 기존 인프라(vision-materials/price-resolver) wrap.
 *
 * 단가 우선순위:
 *   1. 사용자/사업자 override (selectedMaterialUnitPrice)
 *   2. material_price_lookup product 매칭
 *   3. material_price_observations 최근 30일 평균
 *   4. material_products.contractor_price
 *   5. material_products.retail_price
 *   6. category 표준 / KPA fallback
 */
import { resolveMaterialPrice as legacyResolve } from "@/lib/vision-materials/price-resolver";
import type {
  EstimateUnit,
  MaterialPriceSource,
  ResolvedMaterialPrice,
  ResolvedMaterialProduct,
} from "./types";

export interface ResolvePriceInput {
  product: ResolvedMaterialProduct;
  unit: EstimateUnit;
  /** 사용자/사업자가 override한 단가 (있으면 최우선) */
  overridePriceWon?: number;
  /** WorkPackageRule의 fallback 단가 — 모든 DB 매칭 실패 시 사용 */
  fallbackDefaultPriceWon?: number;
  /** 카테고리 표준 단가 키 (KPA 등) */
  categoryStandardKey?: string;
}

/** legacy price-resolver의 source 문자열 → v2 MaterialPriceSource 매핑 */
function mapLegacySource(s: string): MaterialPriceSource {
  switch (s) {
    case "material_price_lookup":
      return "material_price_lookup";
    case "contractor_price":
      return "contractor_price";
    case "retail_price":
      return "catalog_price";
    case "price_observations_avg":
      return "material_price_observations";
    case "category_default":
      return "category_standard";
    default:
      return "kpa_standard";
  }
}

/** legacy confidence 문자열 (A~E) → 0~1 숫자 */
function mapLegacyConfidence(c?: string): number {
  if (!c) return 0.5;
  switch (c.toUpperCase()) {
    case "A":
      return 0.95;
    case "B":
      return 0.85;
    case "C":
      return 0.7;
    case "D":
      return 0.55;
    case "E":
      return 0.4;
    case "VERIFIED":
      return 0.85;
    case "ESTIMATED":
      return 0.55;
    default:
      return 0.5;
  }
}

/**
 * 메인 resolver — fail-safe (항상 ResolvedMaterialPrice 반환).
 */
export async function resolveMaterialPriceForLine(
  input: ResolvePriceInput,
): Promise<ResolvedMaterialPrice> {
  // ─── 1순위: override (사용자/사업자가 명시) ───────────────────
  if (input.overridePriceWon && input.overridePriceWon > 0) {
    return {
      unitPrice: input.overridePriceWon,
      currency: "KRW",
      priceSource: "manual_override",
      confidence: 1.0,
      appliedAt: new Date().toISOString(),
    };
  }

  // ─── 2~5순위: 기존 legacy resolver wrap ──────────────────────
  //   material_price_lookup → contractor_price → retail_price → observations_avg
  if (input.product.materialProductId) {
    try {
      const legacy = await legacyResolve({
        materialProductId: input.product.materialProductId,
        unit: input.unit,
        // raw에 contractor/retail price 정보가 있으면 전달
        contractorPrice: getNumberFromRaw(input.product.raw, "contractor_price"),
        retailPrice: getNumberFromRaw(input.product.raw, "retail_price"),
      });
      if (legacy.source !== "missing" && legacy.unitPriceWon > 0) {
        return {
          unitPrice: legacy.unitPriceWon,
          currency: "KRW",
          priceSource: mapLegacySource(legacy.source),
          confidence: mapLegacyConfidence(legacy.confidence),
          appliedAt: legacy.asOf || new Date().toISOString(),
          raw: legacy,
        };
      }
    } catch (err) {
      console.warn("[price-resolver] legacy resolve failed:", err);
    }
  }

  // ─── 6순위: WorkPackageRule fallback default ─────────────────
  if (input.fallbackDefaultPriceWon && input.fallbackDefaultPriceWon > 0) {
    return {
      unitPrice: input.fallbackDefaultPriceWon,
      currency: "KRW",
      priceSource: "category_standard",
      confidence: 0.45,
      fallbackReason: `material_products/material_price_lookup 매칭 실패 — WorkPackageRule 카테고리 표준 단가 적용`,
    };
  }

  // ─── 7순위: 최종 fallback (단가 정보 전혀 없음) ──────────────
  return {
    unitPrice: 0,
    currency: "KRW",
    priceSource: "kpa_standard",
    confidence: 0.2,
    fallbackReason: `모든 단가 출처에서 매칭 실패 — 수동 입력 필요`,
  };
}

function getNumberFromRaw(raw: unknown, key: string): number | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const v = (raw as Record<string, unknown>)[key];
  return typeof v === "number" && v > 0 ? v : undefined;
}
