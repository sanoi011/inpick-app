/**
 * 견적 엔진 — SurfacePlan[] + RoomQuantityBasis[] → ConstructionEstimate.
 * 가이드: inpick-construction-trade-estimate-engine-dev-plan-20260512.md §7
 *
 * Flow:
 *   surfacePlan
 *     → findWorkPackageRules (매칭)
 *     → 각 rule.outputLines를 line으로 전개 (수량×단가)
 *     → mergeDuplicateLines (같은 trade/sub/room/spec 병합)
 *     → tradeSummaries / roomSummaries / materialSummary 집계
 *     → totals (간접비/관리비/이윤/VAT)
 */
import {
  resolveQuantity,
  surfaceLabel,
} from "./quantity-formulas";
import { ALL_WORK_PACKAGE_RULES } from "./work-package-rules";
import { getTradeSortOrder } from "./trades";
import { resolveMaterialProductForLine } from "./product-resolver";
import { resolveMaterialPriceForLine } from "./price-resolver";
// P17-4: 단가 sanity check
import { validatePriceBand } from "@/lib/inpick/estimate-precision/price-sanity-check";
// P13-2: KitchenPlan으로 주방 라인 수량 정밀화
import {
  buildKitchenPlan,
  getKitchenLineQuantity,
  type KitchenPlan,
} from "./kitchen-plan-builder";
import type {
  ConfidenceSummary,
  ConstructionEstimate,
  ConstructionEstimateLine,
  EstimateRateConfig,
  EstimateTotals,
  MaterialSummary,
  ProjectMode,
  ResolvedMaterialPrice,
  ResolvedMaterialProduct,
  RoomQuantityBasis,
  RoomSummary,
  SurfacePlan,
  TradeSummary,
  WorkPackageLineTemplate,
  WorkPackageRule,
} from "./types";
import { DEFAULT_RATE_CONFIG } from "./types";
import {
  buildBaseSiteConditionAllowanceLines,
  getSiteConditionPricingMeta,
} from "./site-condition-pricing";
import {
  applySiteConditionAdjustments,
  type SiteConditionAnswers,
} from "./site-condition-answers";

export interface BuildConstructionEstimateInput {
  projectId: string;
  projectMode: ProjectMode;
  surfacePlans: SurfacePlan[];
  quantityBasisByRoom: Record<string, RoomQuantityBasis>;
  /** 사용자 프롬프트/직접 선택에서 확정된 주방 부품 수량·구성 */
  kitchenPlanOverrides?: Record<string, Partial<KitchenPlan>>;
  rateOverrides?: Partial<EstimateRateConfig>;
  siteConditions?: SiteConditionAnswers;
}

/**
 * P12: async 버전 — DB에서 product/price resolver 호출 후 line에 brand/sku/source 채움.
 * 사용처: build-estimate API server-side. client-builder는 sync 버전 사용.
 */
export async function buildConstructionEstimateWithProductResolution(
  input: BuildConstructionEstimateInput,
): Promise<ConstructionEstimate> {
  const rawLines: ConstructionEstimateLine[] = [];

  // P13-2 + P14-1: 주방 SurfacePlan이 있으면 KitchenPlan 미리 생성 (room별 1회)
  const kitchenPlansByRoom = new Map<string, KitchenPlan>();
  for (const sp of input.surfacePlans) {
    if (sp.roomType === "kitchen" && !kitchenPlansByRoom.has(sp.roomId)) {
      const basis = input.quantityBasisByRoom[sp.roomId];
      // P14-1: surfacePlan.floorplanRoom 또는 basis.widthM/depthM에서 도면 치수 확보
      const floorplanRoom =
        sp.floorplanRoom ||
        (basis?.widthM && basis?.depthM
          ? {
              widthMm: basis.widthM * 1000,
              depthMm: basis.depthM * 1000,
            }
          : undefined);
      kitchenPlansByRoom.set(
        sp.roomId,
        buildKitchenPlan({
          projectId: input.projectId,
          roomName: sp.roomName,
          kitchenBasis: basis,
          floorplanRoom,
          userInput: input.kitchenPlanOverrides?.[sp.roomId],
        }),
      );
    }
  }

  for (const surfacePlan of input.surfacePlans) {
    const basis = input.quantityBasisByRoom[surfacePlan.roomId];
    if (!basis) {
      rawLines.push(createWarningLine(surfacePlan));
      continue;
    }

    const matchedRules = findWorkPackageRules(surfacePlan);
    if (matchedRules.length === 0) {
      rawLines.push(createFallbackLine(surfacePlan, basis));
      continue;
    }

    const kitchenPlan = kitchenPlansByRoom.get(surfacePlan.roomId);

    for (const rule of matchedRules) {
      for (const template of rule.outputLines) {
        if (!shouldIncludeTemplate(template, surfacePlan, basis)) continue;
        const line = createEstimateLine(surfacePlan, basis, template);
        // P13-2: 주방 룰의 라인이면 KitchenPlan으로 수량 정밀화 (룰의 quantityMultiplier 무시)
        if (kitchenPlan && template.tradeCode.match(/^(02|04|05|07|12|14|15)$/)) {
          const planQty = getKitchenLineQuantity(template.subTradeCode, kitchenPlan);
          if (planQty != null && planQty > 0) {
            const newQty = Math.round(planQty * (1 + (template.wasteFactor ?? 0)) * 10) / 10;
            line.quantity = newQty;
            line.materialAmount = Math.round(line.materialUnitPrice * newQty);
            line.laborAmount = Math.round(line.laborUnitPrice * newQty);
            line.expenseAmount = Math.round(line.expenseUnitPrice * newQty);
            line.totalAmount = line.materialAmount + line.laborAmount + line.expenseAmount;
            line.quantityFormulaKo = `KitchenPlan ${template.subTradeCode} · ${kitchenPlan.source}`;
            line.assumptions.push(`주방 ${template.subTradeNameKo}: ${kitchenPlan.source} 기반 ${newQty}${template.unit}`);
            if (template.subTradeCode === "12-13" && kitchenPlan.tallCabinetLabels.length > 0) {
              const labels = kitchenPlan.tallCabinetLabels.join(" · ");
              line.itemNameKo = labels;
              line.assumptions.push(`사용자 요구 주방장 구성: ${labels}`);
            }
          }
        }
        // 완성 마감재 라인만 상품 resolver를 실행한다.
        // 바탕처리·부자재·철거 라인에 같은 SurfacePlan 마감재를 매칭하면
        // 모든 품명이 "강마루/실크벽지"로 덮이고 원가 단가까지 오염될 수 있다.
        if (hasMaterialIntent(template)) {
          try {
            const useSelectedSurfaceProduct = shouldUseSelectedMaterialForTemplate(
              template,
              surfacePlan,
            );
            const product = await resolveMaterialProductForLine({
              surfacePlan,
              useSelectedSurfaceProduct,
              workOutput: {
                taskNameKo: template.taskNameKo,
                defaultItemNameKo: template.defaultItemNameKo,
                defaultSpec: template.defaultSpec,
                tradeCode: template.tradeCode,
                subTradeCode: template.subTradeCode,
                // P15-3: template의 카테고리 코드 전달 → resolver가 우선 사용
                materialCategoryCode: materialCategoryCodeForTemplate(
                  template,
                  surfacePlan,
                ),
                requiredProductMatch: template.requiredProductMatch,
                highValue: template.highValue,
              },
              roomName: surfacePlan.roomName,
              surfaceType: surfacePlan.surfaceType,
            });
            const price = await resolveMaterialPriceForLine({
              product,
              unit: template.unit,
              overridePriceWon: useSelectedSurfaceProduct
                ? surfacePlan.selectedMaterialUnitPrice
                : undefined,
              overridePriceSource: useSelectedSurfaceProduct
                ? surfacePlan.selectedMaterialPriceSource
                : undefined,
              fallbackDefaultPriceWon: template.costModel.defaultMaterialUnitPrice,
            });
            applyResolvedProductPriceToLine(line, product, price);
          } catch (err) {
            console.warn("[build-construction-estimate] resolver failed for line:", line.id, err);
          }
        }
        rawLines.push(line);
      }
    }
  }

  rawLines.push(
    ...buildBaseSiteConditionAllowanceLines({
      projectId: input.projectId,
      projectMode: input.projectMode,
      quantityBasisByRoom: input.quantityBasisByRoom,
      existingLines: rawLines,
    }),
  );

  const adjustedLines = applySiteConditionAdjustments(rawLines, input.siteConditions);
  const deduped = mergeDuplicateLines(adjustedLines);
  const sorted = sortEstimateLines(deduped);

  return {
    id: randomId(),
    projectId: input.projectId,
    projectMode: input.projectMode,
    version: 1,
    lines: sorted,
    tradeSummaries: summarizeByTrade(sorted),
    roomSummaries: summarizeByRoom(sorted),
    materialSummary: summarizeMaterials(sorted),
    totals: computeTotals(sorted, input.rateOverrides),
    confidenceSummary: computeConfidenceSummary(sorted),
    assumptions: collectUniqueStrings(sorted.flatMap((l) => l.assumptions)),
    warnings: collectUniqueStrings(sorted.flatMap((l) => l.warnings)),
  };
}

/** WorkPackageLineTemplate이 자재가 있는 작업인지 (단가 0이라도 자재 의도 있으면 resolver 호출) */
export function hasMaterialIntent(template: WorkPackageLineTemplate): boolean {
  return Boolean(
    template.materialCategoryCode ||
    template.requiredProductMatch ||
    template.costModel.materialUnitPriceKey === "selected_material_unit_price"
  );
}

/**
 * 한 SurfacePlan이 여러 완제품으로 전개되는 욕실·주방 패키지에서는 선택 단가를
 * 모든 부품에 복제하지 않는다. 범용 "싱크대" 선택은 하부장 대표 단가에만 쓰고,
 * 부품 카테고리를 직접 선택한 경우에만 해당 부품에 적용한다.
 */
export function shouldUseSelectedMaterialForTemplate(
  template: WorkPackageLineTemplate,
  plan: SurfacePlan,
): boolean {
  if (
    template.costModel.materialUnitPriceKey !== "selected_material_unit_price"
  ) {
    return false;
  }
  if (plan.roomType !== "kitchen") return true;

  const selectedCategory = plan.materialCategory.trim().toLowerCase();
  const broadKitchenSelection = [
    "kitchen_standard",
    "kitchen_cabinet",
    "sink_cabinet",
    "arch_kitchen",
    "주방",
    "싱크대",
  ].some((alias) => selectedCategory.includes(alias));

  if (broadKitchenSelection) return template.subTradeCode === "12-11";
  if (!template.materialCategoryCode) return false;

  const templateCategory = template.materialCategoryCode.toLowerCase();
  return (
    selectedCategory === templateCategory ||
    selectedCategory.includes(templateCategory) ||
    templateCategory.includes(selectedCategory)
  );
}

/** 욕실 벽 타일은 바닥 타일과 다른 상품 카테고리로 조회한다. */
function materialCategoryCodeForTemplate(
  template: WorkPackageLineTemplate,
  plan: SurfacePlan,
): string | undefined {
  if (
    plan.roomType === "bathroom" &&
    plan.surfaceType === "wall" &&
    template.materialCategoryCode === "MAT-FLR-PORCELAIN"
  ) {
    return "MAT-WAL-TILE";
  }
  return template.materialCategoryCode;
}

/** Resolver 결과를 line에 채움 */
function applyResolvedProductPriceToLine(
  line: ConstructionEstimateLine,
  product: ResolvedMaterialProduct,
  price: ResolvedMaterialPrice,
) {
  // product
  line.materialProductId = product.materialProductId;
  line.brand = product.brand ?? line.brand;
  line.manufacturer = product.manufacturer;
  line.supplierName = product.supplierName;
  line.vendorName = product.vendorName;
  line.productName = product.productName;
  line.sku = product.sku ?? line.sku;
  line.modelNo = product.modelNo;
  line.productSpec = product.spec ?? line.spec;
  line.productUnit = product.unit;
  line.materialCategoryCode = product.categoryCode;
  line.materialCategoryName = product.categoryName;
  line.productMatchStatus = product.matchStatus;
  line.productMatchConfidence = product.matchConfidence;
  // price — 새 단가가 의미있게 잡혔으면 갱신
  if (price.unitPrice > 0) {
    line.materialUnitPrice = price.unitPrice;
    line.materialAmount = Math.round(price.unitPrice * line.quantity);
    line.totalAmount = line.materialAmount + line.laborAmount + line.expenseAmount;
  }
  line.materialPriceSource = price.priceSource;
  line.materialPriceSourceId = price.priceSourceId;
  line.materialPriceAppliedAt = price.appliedAt;
  line.priceConfidence = price.confidence;
  // fallbackReason — product 우선, 없으면 price
  line.fallbackReason = product.fallbackReason || price.fallbackReason;
  // itemNameKo 보강: brand가 있으면 "{brand} {productName}"
  if (product.brand && product.productName) {
    line.itemNameKo = `${product.brand} ${product.productName}`;
  } else if (product.productName) {
    line.itemNameKo = product.productName;
  }
  // assumptions에 source 명시
  if (product.matchStatus === "standard_fallback") {
    line.assumptions.push(`자재 매칭 미확정 — ${product.fallbackReason ?? "표준 카테고리 단가 적용"}`);
  }
  // P15-4: 고액 fallback 경고 — 500K+ standard_fallback이면 warning 추가
  const HIGH_VALUE_THRESHOLD = 500_000;
  if (
    (product.matchStatus === "standard_fallback" || product.matchStatus === "category_default") &&
    line.totalAmount >= HIGH_VALUE_THRESHOLD
  ) {
    line.warnings.push(
      `⚠️ 고액 품목(₩${line.totalAmount.toLocaleString()})이 DB 상품/단가 매칭 없이 ${
        product.matchStatus === "standard_fallback" ? "표준 fallback" : "카테고리 기본"
      }으로 산정됨 — 사업자 입찰 시 변동 가능.`,
    );
  }

  // P17-4: 단가 sanity check — band 벗어나면 warning
  if (line.materialUnitPrice > 0 && line.materialCategoryCode) {
    const sanity = validatePriceBand({
      categoryCode: line.materialCategoryCode,
      unitPrice: line.materialUnitPrice,
      unit: line.unit,
    });
    if (sanity.status === "below_min" || sanity.status === "above_max") {
      line.warnings.push(sanity.warning!);
    }
  }
}

export function buildConstructionEstimate(
  input: BuildConstructionEstimateInput,
): ConstructionEstimate {
  const rawLines: ConstructionEstimateLine[] = [];
  const kitchenPlansByRoom = new Map<string, KitchenPlan>();
  for (const sp of input.surfacePlans) {
    if (sp.roomType !== "kitchen" || kitchenPlansByRoom.has(sp.roomId)) continue;
    const basis = input.quantityBasisByRoom[sp.roomId];
    kitchenPlansByRoom.set(
      sp.roomId,
      buildKitchenPlan({
        projectId: input.projectId,
        roomName: sp.roomName,
        kitchenBasis: basis,
        floorplanRoom:
          basis?.widthM && basis?.depthM
            ? { widthMm: basis.widthM * 1000, depthMm: basis.depthM * 1000 }
            : undefined,
        userInput: input.kitchenPlanOverrides?.[sp.roomId],
      }),
    );
  }

  for (const surfacePlan of input.surfacePlans) {
    const basis = input.quantityBasisByRoom[surfacePlan.roomId];
    if (!basis) {
      rawLines.push(createWarningLine(surfacePlan));
      continue;
    }

    const matchedRules = findWorkPackageRules(surfacePlan);

    if (matchedRules.length === 0) {
      rawLines.push(createFallbackLine(surfacePlan, basis));
      continue;
    }

    const kitchenPlan = kitchenPlansByRoom.get(surfacePlan.roomId);
    for (const rule of matchedRules) {
      for (const template of rule.outputLines) {
        if (!shouldIncludeTemplate(template, surfacePlan, basis)) continue;
        const line = createEstimateLine(surfacePlan, basis, template);
        if (kitchenPlan) {
          const planQty = getKitchenLineQuantity(template.subTradeCode, kitchenPlan);
          if (planQty != null && planQty > 0) {
            const newQty = Math.round(planQty * (1 + (template.wasteFactor ?? 0)) * 10) / 10;
            line.quantity = newQty;
            line.materialAmount = Math.round(line.materialUnitPrice * newQty);
            line.laborAmount = Math.round(line.laborUnitPrice * newQty);
            line.expenseAmount = Math.round(line.expenseUnitPrice * newQty);
            line.totalAmount = line.materialAmount + line.laborAmount + line.expenseAmount;
            line.quantityFormulaKo = `KitchenPlan ${template.subTradeCode} · ${kitchenPlan.source}`;
            if (template.subTradeCode === "12-13" && kitchenPlan.tallCabinetLabels.length > 0) {
              const labels = kitchenPlan.tallCabinetLabels.join(" · ");
              line.itemNameKo = labels;
              line.assumptions.push(`사용자 요구 주방장 구성: ${labels}`);
            }
          }
        }
        rawLines.push(line);
      }
    }
  }

  rawLines.push(
    ...buildBaseSiteConditionAllowanceLines({
      projectId: input.projectId,
      projectMode: input.projectMode,
      quantityBasisByRoom: input.quantityBasisByRoom,
      existingLines: rawLines,
    }),
  );

  const adjustedLines = applySiteConditionAdjustments(rawLines, input.siteConditions);
  const deduped = mergeDuplicateLines(adjustedLines);
  const sorted = sortEstimateLines(deduped);

  const tradeSummaries = summarizeByTrade(sorted);
  const roomSummaries = summarizeByRoom(sorted);
  const materialSummary = summarizeMaterials(sorted);
  const totals = computeTotals(sorted, input.rateOverrides);
  const confidenceSummary = computeConfidenceSummary(sorted);

  return {
    id: randomId(),
    projectId: input.projectId,
    projectMode: input.projectMode,
    version: 1,
    lines: sorted,
    tradeSummaries,
    roomSummaries,
    materialSummary,
    totals,
    confidenceSummary,
    assumptions: collectUniqueStrings(sorted.flatMap((l) => l.assumptions)),
    warnings: collectUniqueStrings(sorted.flatMap((l) => l.warnings)),
  };
}

// ─── 매칭 ───────────────────────────────────────────────────

export function findWorkPackageRules(plan: SurfacePlan): WorkPackageRule[] {
  const matched: WorkPackageRule[] = [];
  for (const rule of ALL_WORK_PACKAGE_RULES) {
    if (!rule.match.surfaceTypes.includes(plan.surfaceType)) continue;
    if (rule.match.roomTypes && !rule.match.roomTypes.includes(plan.roomType))
      continue;
    if (!rule.match.actions.includes(plan.action)) continue;
    const materialCategoryLower = plan.materialCategory.toLowerCase();
    const matNameLower = (plan.materialNameKo ?? "").toLowerCase();
    const taxonomyAliases = workRuleAliasesForCategory(materialCategoryLower);
    const categoryMatch = rule.match.materialCategories.some((c) => {
      const cl = c.toLowerCase();
      return (
        materialCategoryLower.includes(cl) ||
        matNameLower.includes(cl) ||
        taxonomyAliases.some((alias) => alias.includes(cl) || cl.includes(alias))
      );
    });
    if (!categoryMatch) continue;
    matched.push(rule);
  }
  return matched;
}

function workRuleAliasesForCategory(category: string): string[] {
  if (category.includes("arch_floor_lvt")) return ["lvt", "deco_tile"];
  if (category.includes("arch_floor_tile") || category.includes("arch_tile")) {
    return ["porcelain_tile", "tile"];
  }
  if (category.includes("arch_floor")) return ["engineered_floor", "wood_floor"];
  if (category.includes("arch_wall_paint") || category.includes("arch_paint")) {
    return ["paint", "wall_paint"];
  }
  if (category.includes("arch_wall")) return ["wallpaper", "silk_wallpaper"];
  if (category.includes("arch_kitchen") || category.includes("arch_stone")) {
    return ["kitchen_standard", "kitchen_cabinet"];
  }
  if (category.includes("arch_bath") || category.includes("mech_sanitary")) {
    return ["bathroom_full", "bathroom"];
  }
  if (category.includes("elec_light")) return ["lighting", "led_recessed"];
  if (category.includes("arch_win")) return ["window", "창호"];
  if (category.includes("arch_door")) return ["door", "도어"];
  return [];
}

export function shouldIncludeTemplate(
  template: WorkPackageLineTemplate,
  plan: SurfacePlan,
  basis: RoomQuantityBasis,
): boolean {
  const cond = template.includeWhen;
  if (!cond) return true;
  if (cond.action && !cond.action.includes(plan.action)) return false;
  if (cond.roomTypes && !cond.roomTypes.includes(basis.roomType)) return false;
  if (cond.requiresDemolition && plan.action !== "demolish_and_new") return false;
  return true;
}

// ─── Line 생성 ──────────────────────────────────────────────

function createEstimateLine(
  plan: SurfacePlan,
  basis: RoomQuantityBasis,
  template: WorkPackageLineTemplate,
): ConstructionEstimateLine {
  const { quantity, formulaKo, assumptions: qtyAssumptions } = resolveQuantity(
    template,
    plan,
    basis,
  );

  const prices = resolveUnitPrices(template, plan);

  const materialAmount = Math.round(prices.materialUnitPrice * quantity);
  const laborAmount = Math.round(prices.laborUnitPrice * quantity);
  const expenseAmount = Math.round(prices.expenseUnitPrice * quantity);
  const totalAmount = materialAmount + laborAmount + expenseAmount;
  const siteMeta = getSiteConditionPricingMeta(template.tradeCode);
  const variationNotice = template.variationNotice ?? siteMeta?.variationNotice;
  const siteAdjustmentFactors =
    template.siteAdjustmentFactors ?? siteMeta?.siteAdjustmentFactors ?? [];
  const siteVerificationRequired =
    template.siteVerificationRequired ?? siteMeta?.siteVerificationRequired ?? false;
  const isSelectedProductLine = shouldUseSelectedMaterialForTemplate(template, plan);

  return {
    id: randomId(),
    sortNo: 0, // sortEstimateLines에서 재계산
    tradeCode: template.tradeCode,
    tradeNameKo: template.tradeNameKo,
    subTradeCode: template.subTradeCode,
    subTradeNameKo: template.subTradeNameKo,
    roomId: plan.roomId,
    roomName: plan.roomName,
    roomType: plan.roomType,
    surfaceType: plan.surfaceType,
    taskNameKo: template.taskNameKo,
    itemNameKo:
      (isSelectedProductLine ? plan.materialNameKo : undefined) ||
      template.defaultItemNameKo,
    brand: isSelectedProductLine ? plan.brand : undefined,
    sku: isSelectedProductLine ? plan.sku : undefined,
    spec: (isSelectedProductLine ? plan.spec : undefined) || template.defaultSpec,
    materialProductId: isSelectedProductLine ? plan.materialProductId : undefined,
    productName: isSelectedProductLine ? plan.materialNameKo : undefined,
    productMatchStatus:
      isSelectedProductLine && plan.materialProductId
        ? plan.source === "user_selected_material"
          ? "confirmed"
          : "recommended"
        : undefined,
    productMatchConfidence:
      isSelectedProductLine && plan.materialProductId
        ? plan.confidence
        : undefined,
    materialPriceSource: isSelectedProductLine
      ? plan.selectedMaterialPriceSource
      : undefined,
    priceConfidence:
      isSelectedProductLine && plan.selectedMaterialUnitPrice ? plan.confidence : undefined,
    unit: template.unit,
    quantityFormulaKo: formulaKo,
    quantity,
    materialUnitPrice: prices.materialUnitPrice,
    laborUnitPrice: prices.laborUnitPrice,
    expenseUnitPrice: prices.expenseUnitPrice,
    materialAmount,
    laborAmount,
    expenseAmount,
    totalAmount,
    included: true,
    source: plan.source,
    confidence: plan.confidence,
    pricingBasis:
      template.pricingBasis ?? siteMeta?.pricingBasis ?? "standard_unit",
    contractorEditable:
      template.contractorEditable ?? siteMeta?.contractorEditable ?? false,
    siteVerificationRequired,
    variationNotice,
    siteAdjustmentFactors,
    evidenceRefs: [
      { type: "surface_plan", id: plan.id },
      ...plan.evidenceRefs.map((r) => ({
        type: r.type as ConstructionEstimateLine["evidenceRefs"][number]["type"],
        id: r.id,
      })),
    ],
    assumptions: [
      ...(plan.assumptions ?? []),
      ...qtyAssumptions,
      ...template.assumptions,
      ...(variationNotice ? [variationNotice] : []),
      ...(siteAdjustmentFactors.length > 0
        ? [`현장확인 변수: ${siteAdjustmentFactors.join(" · ")}`]
        : []),
    ],
    warnings: [
      ...(plan.warnings ?? []),
      ...(siteVerificationRequired && variationNotice ? [variationNotice] : []),
    ],
  };
}

interface ResolvedPrices {
  materialUnitPrice: number;
  laborUnitPrice: number;
  expenseUnitPrice: number;
}

function resolveUnitPrices(
  template: WorkPackageLineTemplate,
  plan: SurfacePlan,
): ResolvedPrices {
  // 자재 단가: surfacePlan에 선택 자재 단가가 있으면 우선
  let materialUnitPrice = template.costModel.defaultMaterialUnitPrice ?? 0;
  if (
    shouldUseSelectedMaterialForTemplate(template, plan) &&
    plan.selectedMaterialUnitPrice &&
    plan.selectedMaterialUnitPrice > 0
  ) {
    materialUnitPrice = plan.selectedMaterialUnitPrice;
  }

  return {
    materialUnitPrice,
    laborUnitPrice: template.costModel.defaultLaborUnitPrice ?? 0,
    expenseUnitPrice: template.costModel.defaultExpenseUnitPrice ?? 0,
  };
}

function createWarningLine(plan: SurfacePlan): ConstructionEstimateLine {
  return {
    id: randomId(),
    sortNo: 0,
    tradeCode: "17",
    tradeNameKo: "간접비·관리비·이윤·VAT",
    subTradeCode: "17-99",
    subTradeNameKo: "수량 미산출",
    roomId: plan.roomId,
    roomName: plan.roomName,
    roomType: plan.roomType,
    surfaceType: plan.surfaceType,
    taskNameKo: `${surfaceLabel(plan.surfaceType)} 수량 산출 기준 없음`,
    itemNameKo: plan.materialNameKo || plan.materialCategory,
    unit: "set",
    quantityFormulaKo: "기준 누락",
    quantity: 1,
    materialUnitPrice: 0,
    laborUnitPrice: 0,
    expenseUnitPrice: 0,
    materialAmount: 0,
    laborAmount: 0,
    expenseAmount: 0,
    totalAmount: 0,
    included: false,
    source: plan.source,
    confidence: 0.2,
    evidenceRefs: [{ type: "surface_plan", id: plan.id }],
    assumptions: [],
    warnings: ["수량 산출 기준이 없어 견적에서 제외했습니다."],
  };
}

function createFallbackLine(
  plan: SurfacePlan,
  basis: RoomQuantityBasis,
): ConstructionEstimateLine {
  // WorkPackageRule 매칭 실패 — 단순 surface_area × 표준 단가로 1줄 fallback
  const area =
    plan.quantityHint?.m2 ??
    (plan.surfaceType === "floor"
      ? basis.floorM2
      : plan.surfaceType === "ceiling"
        ? basis.ceilingM2
        : plan.surfaceType === "wall"
          ? basis.wallM2
          : basis.floorM2);
  const materialUnitPrice = plan.selectedMaterialUnitPrice ?? 30000;
  const laborUnitPrice = 12000;
  const materialAmount = Math.round(area * materialUnitPrice);
  const laborAmount = Math.round(area * laborUnitPrice);
  const expenseAmount = Math.round((materialAmount + laborAmount) * 0.03);
  const totalAmount = materialAmount + laborAmount + expenseAmount;
  return {
    id: randomId(),
    sortNo: 0,
    tradeCode: tradeCodeFromSurface(plan.surfaceType),
    tradeNameKo: tradeNameKoFromSurface(plan.surfaceType),
    subTradeCode: `${tradeCodeFromSurface(plan.surfaceType)}-99`,
    subTradeNameKo: "표준 fallback",
    roomId: plan.roomId,
    roomName: plan.roomName,
    roomType: plan.roomType,
    surfaceType: plan.surfaceType,
    taskNameKo: `${surfaceLabel(plan.surfaceType)} ${plan.materialNameKo || "마감"} (표준)`,
    itemNameKo: plan.materialNameKo || plan.materialCategory,
    brand: plan.brand,
    sku: plan.sku,
    spec: plan.spec,
    unit: "m2",
    quantityFormulaKo: `${surfaceLabel(plan.surfaceType)} 면적`,
    quantity: Math.round(area * 10) / 10,
    materialUnitPrice,
    laborUnitPrice,
    expenseUnitPrice: 0,
    materialAmount,
    laborAmount,
    expenseAmount,
    totalAmount,
    included: true,
    source: "standard_fallback_material",
    confidence: 0.4,
    evidenceRefs: [{ type: "surface_plan", id: plan.id }],
    assumptions: [
      "매칭되는 공종 규칙이 없어 표준 단가로 1줄 산출했습니다.",
      ...plan.assumptions,
    ],
    warnings: [],
  };
}

function tradeCodeFromSurface(s: SurfacePlan["surfaceType"]): string {
  switch (s) {
    case "floor":
      return "10";
    case "wall":
    case "ceiling":
      return "09";
    case "door":
    case "window":
      return "11";
    case "counter":
    case "cabinet":
    case "sink":
      return "12";
    case "lighting":
      return "04";
    case "fixture":
      return "13";
    case "signage":
    case "facade":
      return "18";
    default:
      return "10";
  }
}

function tradeNameKoFromSurface(s: SurfacePlan["surfaceType"]): string {
  return {
    floor: "바닥재공사",
    wall: "도배공사",
    ceiling: "도배공사",
    baseboard: "바닥재공사",
    door: "창호·금속공사",
    window: "창호·금속공사",
    partition: "도장공사",
    counter: "가구·싱크공사",
    cabinet: "가구·싱크공사",
    sink: "가구·싱크공사",
    lighting: "전기공사",
    fixture: "욕실공사",
    signage: "간판·파사드공사",
    facade: "간판·파사드공사",
  }[s];
}

// ─── 병합 / 정렬 / 집계 ─────────────────────────────────────

export function mergeDuplicateLines(
  lines: ConstructionEstimateLine[],
): ConstructionEstimateLine[] {
  const map = new Map<string, ConstructionEstimateLine>();
  for (const line of lines) {
    const key = [
      line.tradeCode,
      line.subTradeCode,
      line.roomId,
      line.surfaceType ?? "",
      line.taskNameKo,
      line.itemNameKo,
      line.spec ?? "",
      line.unit,
    ].join("|");
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...line });
      continue;
    }
    prev.quantity += line.quantity;
    prev.materialAmount += line.materialAmount;
    prev.laborAmount += line.laborAmount;
    prev.expenseAmount += line.expenseAmount;
    prev.totalAmount += line.totalAmount;
    prev.evidenceRefs.push(...line.evidenceRefs);
    prev.assumptions.push(...line.assumptions);
    prev.warnings.push(...line.warnings);
    prev.confidence = Math.min(prev.confidence, line.confidence);
  }
  return Array.from(map.values()).map((line) => ({
    ...line,
    quantity: Math.round(line.quantity * 10) / 10,
    materialAmount: Math.round(line.materialAmount),
    laborAmount: Math.round(line.laborAmount),
    expenseAmount: Math.round(line.expenseAmount),
    totalAmount: Math.round(line.totalAmount),
    assumptions: Array.from(new Set(line.assumptions)),
    warnings: Array.from(new Set(line.warnings)),
  }));
}

export function sortEstimateLines(
  lines: ConstructionEstimateLine[],
): ConstructionEstimateLine[] {
  const sorted = [...lines].sort((a, b) => {
    const ta = getTradeSortOrder(a.tradeCode);
    const tb = getTradeSortOrder(b.tradeCode);
    if (ta !== tb) return ta - tb;
    if (a.subTradeCode !== b.subTradeCode)
      return a.subTradeCode.localeCompare(b.subTradeCode);
    return a.roomName.localeCompare(b.roomName);
  });
  // sortNo 재할당
  sorted.forEach((l, i) => {
    l.sortNo = i + 1;
  });
  return sorted;
}

export function summarizeByTrade(
  lines: ConstructionEstimateLine[],
): TradeSummary[] {
  const map = new Map<string, TradeSummary>();
  for (const l of lines) {
    if (!l.included) continue;
    let s = map.get(l.tradeCode);
    if (!s) {
      s = {
        tradeCode: l.tradeCode,
        tradeNameKo: l.tradeNameKo,
        materialAmount: 0,
        laborAmount: 0,
        expenseAmount: 0,
        totalAmount: 0,
        lineCount: 0,
      };
      map.set(l.tradeCode, s);
    }
    s.materialAmount += l.materialAmount;
    s.laborAmount += l.laborAmount;
    s.expenseAmount += l.expenseAmount;
    s.totalAmount += l.totalAmount;
    s.lineCount += 1;
  }
  return Array.from(map.values()).sort(
    (a, b) => getTradeSortOrder(a.tradeCode) - getTradeSortOrder(b.tradeCode),
  );
}

export function summarizeByRoom(
  lines: ConstructionEstimateLine[],
): RoomSummary[] {
  const map = new Map<string, RoomSummary>();
  for (const l of lines) {
    if (!l.included) continue;
    let s = map.get(l.roomId);
    if (!s) {
      s = {
        roomId: l.roomId,
        roomName: l.roomName,
        materialAmount: 0,
        laborAmount: 0,
        expenseAmount: 0,
        totalAmount: 0,
      };
      map.set(l.roomId, s);
    }
    s.materialAmount += l.materialAmount;
    s.laborAmount += l.laborAmount;
    s.expenseAmount += l.expenseAmount;
    s.totalAmount += l.totalAmount;
  }
  return Array.from(map.values());
}

export function summarizeMaterials(
  lines: ConstructionEstimateLine[],
): MaterialSummary[] {
  const map = new Map<string, MaterialSummary>();
  for (const l of lines) {
    if (!l.included || l.materialAmount <= 0) continue;
    const key = [l.itemNameKo, l.brand ?? "", l.sku ?? "", l.spec ?? "", l.unit].join("|");
    let s = map.get(key);
    if (!s) {
      s = {
        materialCategory: l.tradeNameKo,
        itemNameKo: l.itemNameKo,
        brand: l.brand,
        sku: l.sku,
        spec: l.spec,
        unit: l.unit,
        quantity: 0,
        amount: 0,
      };
      map.set(key, s);
    }
    s.quantity += l.quantity;
    s.amount += l.materialAmount;
  }
  return Array.from(map.values())
    .map((s) => ({ ...s, quantity: Math.round(s.quantity * 10) / 10, amount: Math.round(s.amount) }))
    .sort((a, b) => b.amount - a.amount);
}

export function computeTotals(
  lines: ConstructionEstimateLine[],
  overrides?: Partial<EstimateRateConfig>,
): EstimateTotals {
  const rates: EstimateRateConfig = { ...DEFAULT_RATE_CONFIG, ...overrides };
  let directMaterial = 0;
  let directLabor = 0;
  let directExpense = 0;
  for (const l of lines) {
    if (!l.included) continue;
    directMaterial += l.materialAmount;
    directLabor += l.laborAmount;
    directExpense += l.expenseAmount;
  }
  const directTotal = directMaterial + directLabor + directExpense;
  const indirectCost = Math.round(directTotal * rates.indirectRate);
  const generalManagement = Math.round(directTotal * rates.generalManagementRate);
  const profit = Math.round((directTotal + indirectCost + generalManagement) * rates.profitRate);
  const subtotal = directTotal + indirectCost + generalManagement + profit;
  const vat = Math.round(subtotal * rates.vatRate);
  const totalWithVat = subtotal + vat;
  return {
    directMaterial: Math.round(directMaterial),
    directLabor: Math.round(directLabor),
    directExpense: Math.round(directExpense),
    directTotal: Math.round(directTotal),
    indirectCost,
    generalManagement,
    profit,
    vat,
    totalWithVat,
  };
}

export function computeConfidenceSummary(
  lines: ConstructionEstimateLine[],
): ConfidenceSummary {
  if (lines.length === 0) {
    return {
      userSelectedRatio: 0,
      visionBasedRatio: 0,
      promptBasedRatio: 0,
      fallbackRatio: 0,
      averageConfidence: 0,
    };
  }
  let user = 0, vision = 0, prompt = 0, fallback = 0;
  let conf = 0;
  for (const l of lines) {
    conf += l.confidence;
    switch (l.source) {
      case "user_selected_material":
        user++;
        break;
      case "vision_confirmed_material":
      case "vision_recommended_material":
        vision++;
        break;
      case "prompt_extracted_material":
        prompt++;
        break;
      default:
        fallback++;
    }
  }
  const total = lines.length;
  return {
    userSelectedRatio: user / total,
    visionBasedRatio: vision / total,
    promptBasedRatio: prompt / total,
    fallbackRatio: fallback / total,
    averageConfidence: conf / total,
  };
}

// ─── 유틸 ───────────────────────────────────────────────────

function collectUniqueStrings(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}

function randomId(): string {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return "id-" + Math.random().toString(36).slice(2, 12);
}
