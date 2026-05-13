/**
 * Product Resolver — SurfacePlan + WorkPackageOutput → material_products row 매칭.
 * 가이드: inpick-estimate-v2-product-price-pdf-fix-plan-20260513.md §4
 *
 * 기존 인프라(lookupMaterialProduct) wrap — 새 DB 쿼리 X, 검증된 5-tier 우선순위 재사용.
 *
 * 매칭 우선순위:
 *   1. surfacePlan.sku 직접 매칭 (사용자 확정)
 *   2. surfacePlan.materialProductId 직접 매칭
 *   3. lookupMaterialProduct() — category_code + popularity rerank
 *   4. category 표준 (lookupMaterialProduct가 null이면 카테고리 기본 메타)
 *   5. standard_fallback (생성된 SKU 금지)
 *
 * 정책:
 *   - AI/VLM이 만든 SKU 금지 — 반드시 material_products row에 존재해야 confirmed/recommended
 *   - resolver 실패 시 throw 안 함 — standard_fallback ResolvedMaterialProduct 반환
 */
import { lookupMaterialProduct } from "@/lib/inpick/material-product-lookup";
import {
  resolveCategoryFromEstimateLine,
  resolveCategoryFromText,
} from "@/lib/inpick/material-taxonomy/category-resolver";
import { getCategoryByCode } from "@/lib/inpick/material-taxonomy/category-seed";
import type {
  ResolvedMaterialProduct,
  SurfacePlan,
  SurfaceType,
} from "./types";

export interface ResolveProductInput {
  surfacePlan?: SurfacePlan;
  /** WorkPackageOutput 내부 정보 — taskName / itemName / spec / categoryCode */
  workOutput: {
    taskNameKo: string;
    defaultItemNameKo: string;
    defaultSpec?: string;
    tradeCode: string;
    subTradeCode: string;
    /** P15-3: WorkPackageLineTemplate.materialCategoryCode 그대로 전달 */
    materialCategoryCode?: string;
    requiredProductMatch?: boolean;
    highValue?: boolean;
  };
  roomName: string;
  /** "fixture" / "floor" / "wall" / "ceiling" 등 */
  surfaceType?: SurfaceType;
  budgetTier?: "basic" | "standard" | "premium";
  /** category 추론 힌트 (옵션) */
  hintCategory?: string;
}

/** SurfaceType → lookup 함수가 받는 한국어 surface 라벨 */
function mapSurfaceToKo(s: SurfaceType): string {
  switch (s) {
    case "floor":
      return "바닥";
    case "wall":
      return "벽";
    case "ceiling":
      return "천장";
    case "door":
      return "도어";
    case "window":
      return "창호";
    case "counter":
    case "cabinet":
    case "sink":
      return "fixture";
    case "fixture":
      return "fixture";
    case "lighting":
      return "조명";
    case "baseboard":
      return "걸레받이";
    case "signage":
      return "signage";
    case "facade":
      return "facade";
    case "partition":
      return "벽";
  }
}

/**
 * 메인 resolver — fail-safe (항상 ResolvedMaterialProduct 반환).
 */
export async function resolveMaterialProductForLine(
  input: ResolveProductInput,
): Promise<ResolvedMaterialProduct> {
  const surface = input.surfaceType ?? input.surfacePlan?.surfaceType;
  const materialName =
    input.surfacePlan?.materialNameKo ||
    input.workOutput.defaultItemNameKo ||
    input.workOutput.taskNameKo;

  // ─── 1순위: surfacePlan에 SKU/brand가 이미 있으면 confirmed ───
  if (input.surfacePlan?.sku || input.surfacePlan?.brand) {
    return {
      materialProductId: undefined, // sku 직접 매칭은 DB lookup 추가 가능 (P12+ 후속)
      brand: input.surfacePlan.brand,
      productName: input.surfacePlan.materialNameKo || materialName,
      sku: input.surfacePlan.sku,
      spec: input.surfacePlan.spec,
      categoryCode: undefined,
      matchStatus:
        input.surfacePlan.source === "user_selected_material" ? "confirmed" : "recommended",
      matchConfidence: input.surfacePlan.confidence,
    };
  }

  // ─── 2~3순위: lookupMaterialProduct (material_products 매칭) ───
  if (surface) {
    try {
      const surfaceKo = mapSurfaceToKo(surface);
      // budgetTier basic → lookup은 economy로 매핑
      const grade: "economy" | "standard" | "premium" =
        input.budgetTier === "basic"
          ? "economy"
          : input.budgetTier === "premium"
            ? "premium"
            : "standard";
      const match = await lookupMaterialProduct({
        surface: surfaceKo,
        roomName: input.roomName,
        materialName,
        preferredGrade: grade,
      });
      if (match) {
        return {
          materialProductId: match.sourceProductId,
          brand: match.brand,
          productName: match.productName,
          sku: match.sku,
          spec: match.specification,
          unit: match.unit,
          categoryCode: undefined, // lookup 내부에서 결정한 카테고리는 별도 반환 X
          matchStatus: "recommended",
          matchConfidence: 0.7,
          raw: match,
        };
      }
    } catch (err) {
      console.warn("[product-resolver] lookupMaterialProduct failed:", err);
    }
  }

  // ─── P15-3: 4순위 — WorkPackageOutput.materialCategoryCode 또는 텍스트에서 추정한 카테고리 ───
  const resolvedCategory =
    (input.workOutput.materialCategoryCode
      ? { categoryCode: input.workOutput.materialCategoryCode, category: getCategoryByCode(input.workOutput.materialCategoryCode), confidence: 1.0, specHints: {}, matchedAliases: [input.workOutput.materialCategoryCode] }
      : null) ||
    resolveCategoryFromEstimateLine({
      itemName: materialName,
      spec: input.surfacePlan?.spec || input.workOutput.defaultSpec,
      materialCategory: input.surfacePlan?.materialCategory || input.hintCategory,
      tradeCode: input.workOutput.tradeCode,
    });

  if (resolvedCategory?.category) {
    const cat = resolvedCategory.category;
    return {
      productName: cat.displayNameKo,
      brand: undefined,
      sku: undefined,
      spec: input.surfacePlan?.spec || input.workOutput.defaultSpec,
      unit: cat.defaultUnit,
      categoryCode: cat.categoryCode,
      categoryName: `${cat.majorNameKo} > ${cat.middleNameKo} > ${cat.minorNameKo}`,
      matchStatus: "category_default",
      matchConfidence: resolvedCategory.confidence * 0.5, // category만 매칭은 0.5 미만
      fallbackReason:
        `material_products row 매칭 실패 — 카테고리(${cat.categoryCode})만 식별. ` +
        `DB seed 필요 또는 사용자 직접 자재 선택 권장.`,
    };
  }

  // ─── 5순위: 진짜 standard_fallback (카테고리도 모름) ───
  return {
    productName: materialName,
    brand: undefined,
    sku: undefined,
    spec: input.surfacePlan?.spec || input.workOutput.defaultSpec,
    matchStatus: "standard_fallback",
    matchConfidence: 0.3,
    fallbackReason: surface
      ? `material_products에서 surface=${surface} room=${input.roomName} 매칭 후보 없음, 카테고리도 추론 불가`
      : `surfaceType 미정 + 카테고리 추론 불가 — 자재 후보 검색 불가`,
  };
}
