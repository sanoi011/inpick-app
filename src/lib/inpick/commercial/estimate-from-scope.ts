/**
 * CommercialScopeSpec → line item 견적 산출.
 *
 * 가이드: c:\Users\user\Desktop\inpick-commercial-scope-admin-analytics-dev-plan-20260512.md §3-7
 *
 * 산출 18개 항목:
 *   1.철거 2.바닥 3.벽 4.천장 5.전기 6.조명 7.급수 8.배수
 *   9.냉난방 10.환기/후드 11.소방 12.간판/파사드
 *   13.붙박이/카운터 14.네트워크/파티션/방음 15.폐기/청소
 *   16.관리비(6%) 17.이윤(5%) 18.VAT(10%)
 */
import type {
  CommercialScopeSpec,
  CommercialSurfacePlan,
  CommercialSystemPlan,
  CommercialZoneScope,
  FinishGrade,
  CommercialSurfaceType,
  CommercialSystemType,
} from "./scope-spec";

const GRADE_MULTIPLIER: Record<FinishGrade, number> = {
  basic: 0.8,
  standard: 1.0,
  premium: 1.5,
};

// 단가 원/m² (또는 원/m / 원/식). 표준등급 기준. KPA/조달청 기반 임시값 — P3에서 실증.
const SURFACE_UNIT_PRICE_KRW: Record<CommercialSurfaceType, { unit: "m2" | "m" | "ea"; price: number }> = {
  floor: { unit: "m2", price: 95_000 },
  wall: { unit: "m2", price: 55_000 },
  ceiling: { unit: "m2", price: 65_000 },
  baseboard: { unit: "m", price: 18_000 },
  door: { unit: "ea", price: 420_000 },
  window: { unit: "ea", price: 380_000 },
  partition: { unit: "m2", price: 140_000 },
  counter: { unit: "m", price: 850_000 },
  built_in_furniture: { unit: "m", price: 950_000 },
  lighting: { unit: "ea", price: 180_000 },
  signage: { unit: "ea", price: 1_200_000 },
  facade: { unit: "m2", price: 220_000 },
};

// 설비 1식 정액 (zone 또는 global). 표준등급 기준.
const SYSTEM_LUMPSUM_KRW: Record<CommercialSystemType, number> = {
  electrical: 1_800_000,
  lighting: 1_200_000,
  plumbing: 1_500_000,
  drainage: 1_400_000,
  hvac: 3_500_000,
  ventilation: 1_800_000,
  exhaust_hood: 4_500_000,
  fire_safety: 2_500_000,
  gas: 1_600_000,
  network: 1_400_000,
  cctv: 900_000,
  access_control: 700_000,
  soundproofing: 2_200_000,
};

export interface EstimateLineItem {
  zoneId: string | null;
  zoneName: string | null;
  workCategory: string;
  surfaceType?: CommercialSurfaceType;
  systemType?: CommercialSystemType;
  materialCategory?: string;
  materialNameKo?: string;
  grade: FinishGrade;
  quantity: number;
  unit: "m2" | "m" | "ea" | "식";
  unitPriceWon: number;
  amountWon: number;
  source: string;
  confidence: number;
  assumptions: string[];
}

export interface CommercialEstimateResult {
  mode: "commercial";
  quotationType: "scope_based";
  businessType: string;
  totalAreaM2: number;
  totalPyung: number;
  budgetTier: FinishGrade;
  lineItems: EstimateLineItem[];
  breakdown: {
    demolitionWon: number;
    surfaceFinishesWon: number;
    systemsWon: number;
    fixturesWon: number;
    cleanupWon: number;
    directCostWon: number;
    indirectCostWon: number;
    profitWon: number;
    vatWon: number;
  };
  grandTotalWon: number;
  disclaimerKo: string;
  readinessScore: number;
}

function surfaceLineItem(
  zone: CommercialZoneScope,
  surface: CommercialSurfacePlan,
  tier: FinishGrade,
  category: string,
): EstimateLineItem {
  const config = SURFACE_UNIT_PRICE_KRW[surface.surfaceType];
  const multiplier = GRADE_MULTIPLIER[surface.grade || tier];
  const unitPrice = Math.round(config.price * multiplier);
  let quantity = 0;
  let unit: "m2" | "m" | "ea" | "식" = config.unit as "m2" | "m" | "ea";
  if (config.unit === "m2") {
    quantity = surface.quantityM2 ?? 0;
  } else if (config.unit === "m") {
    quantity = surface.quantityM ?? 0;
  } else {
    quantity = surface.quantityEa ?? 1;
  }
  return {
    zoneId: zone.id,
    zoneName: zone.nameKo,
    workCategory: category,
    surfaceType: surface.surfaceType,
    materialCategory: surface.materialCategory,
    materialNameKo: surface.materialNameKo,
    grade: surface.grade,
    quantity: Math.round(quantity * 100) / 100,
    unit,
    unitPriceWon: unitPrice,
    amountWon: Math.round(quantity * unitPrice),
    source: surface.source,
    confidence: surface.confidence,
    assumptions: surface.assumptions,
  };
}

function systemLineItem(
  system: CommercialSystemPlan,
  zone: CommercialZoneScope | null,
): EstimateLineItem {
  const base = SYSTEM_LUMPSUM_KRW[system.type] ?? 1_000_000;
  const multiplier = GRADE_MULTIPLIER[system.grade];
  const amount = Math.round(base * multiplier);
  const categoryMap: Record<string, string> = {
    electrical: "전기",
    lighting: "조명",
    plumbing: "급수",
    drainage: "배수",
    hvac: "냉난방",
    ventilation: "환기",
    exhaust_hood: "환기/후드",
    fire_safety: "소방",
    gas: "가스",
    network: "네트워크/통신",
    cctv: "CCTV/보안",
    access_control: "출입통제",
    soundproofing: "방음/흡음",
  };
  return {
    zoneId: zone?.id ?? null,
    zoneName: zone?.nameKo ?? null,
    workCategory: categoryMap[system.type] || system.type,
    systemType: system.type,
    grade: system.grade,
    quantity: 1,
    unit: "식",
    unitPriceWon: amount,
    amountWon: amount,
    source: system.source,
    confidence: system.confidence,
    assumptions: system.assumptions,
  };
}

export function buildCommercialEstimateFromScope(
  spec: CommercialScopeSpec,
): CommercialEstimateResult {
  const tier = spec.budgetTier;
  const lineItems: EstimateLineItem[] = [];

  // 철거
  let demolitionWon = 0;
  if (spec.demolitionPlan.required) {
    const demoAmount = Math.round(
      spec.totalAreaM2 * 35_000 * GRADE_MULTIPLIER[tier],
    );
    demolitionWon = demoAmount;
    lineItems.push({
      zoneId: null,
      zoneName: null,
      workCategory: "철거",
      grade: tier,
      quantity: spec.totalAreaM2,
      unit: "m2",
      unitPriceWon: Math.round(35_000 * GRADE_MULTIPLIER[tier]),
      amountWon: demoAmount,
      source: "default_inferred",
      confidence: spec.demolitionPlan.confidence,
      assumptions: [spec.demolitionPlan.scopeKo],
    });
  }

  // 마감 (zone × surface)
  let surfaceFinishesWon = 0;
  let fixturesWon = 0;
  for (const zone of spec.zones) {
    for (const surface of zone.surfacePlans) {
      let category = "마감";
      if (surface.surfaceType === "floor") category = "바닥 마감";
      else if (surface.surfaceType === "wall") category = "벽체 마감";
      else if (surface.surfaceType === "ceiling") category = "천장 마감";
      else if (surface.surfaceType === "baseboard") category = "걸레받이";
      else if (surface.surfaceType === "door" || surface.surfaceType === "window") category = "창호";
      else if (surface.surfaceType === "partition") category = "파티션";
      else if (surface.surfaceType === "counter" || surface.surfaceType === "built_in_furniture") {
        category = "붙박이 가구";
      } else if (surface.surfaceType === "lighting") category = "조명";
      else if (surface.surfaceType === "signage") category = "간판";
      else if (surface.surfaceType === "facade") category = "파사드";

      const item = surfaceLineItem(zone, surface, tier, category);
      lineItems.push(item);
      if (
        surface.surfaceType === "counter" ||
        surface.surfaceType === "built_in_furniture" ||
        surface.surfaceType === "partition"
      ) {
        fixturesWon += item.amountWon;
      } else {
        surfaceFinishesWon += item.amountWon;
      }
    }

    // zone-level fixturePlans
    for (const fix of zone.fixturePlans) {
      const grade = fix.grade || tier;
      const base = 1_200_000;
      const amount = Math.round(base * GRADE_MULTIPLIER[grade] * (fix.quantityEa ?? 1));
      lineItems.push({
        zoneId: zone.id,
        zoneName: zone.nameKo,
        workCategory: `${fix.type} 설치`,
        grade,
        quantity: fix.quantityEa ?? 1,
        unit: "식",
        unitPriceWon: Math.round(base * GRADE_MULTIPLIER[grade]),
        amountWon: amount,
        source: fix.source,
        confidence: fix.confidence,
        assumptions: [fix.descriptionKo],
      });
      fixturesWon += amount;
    }
  }

  // 설비
  let systemsWon = 0;
  for (const sys of spec.globalSystems) {
    const item = systemLineItem(sys, null);
    lineItems.push(item);
    systemsWon += item.amountWon;
  }
  for (const zone of spec.zones) {
    for (const sys of zone.systemPlans) {
      const item = systemLineItem(sys, zone);
      lineItems.push(item);
      systemsWon += item.amountWon;
    }
  }

  // 폐기/청소
  const cleanupWon = Math.round(
    spec.totalAreaM2 * 8_000 * GRADE_MULTIPLIER[tier],
  );
  lineItems.push({
    zoneId: null,
    zoneName: null,
    workCategory: "폐기물/청소",
    grade: tier,
    quantity: spec.totalAreaM2,
    unit: "m2",
    unitPriceWon: Math.round(8_000 * GRADE_MULTIPLIER[tier]),
    amountWon: cleanupWon,
    source: "default_inferred",
    confidence: 0.5,
    assumptions: ["철거 폐기물 처리 + 입주 청소 1식"],
  });

  const directCostWon = demolitionWon + surfaceFinishesWon + systemsWon + fixturesWon + cleanupWon;
  const indirectCostWon = Math.round(directCostWon * 0.06);
  const profitWon = Math.round((directCostWon + indirectCostWon) * 0.05);
  const subtotal = directCostWon + indirectCostWon + profitWon;
  const vatWon = Math.round(subtotal * 0.1);
  const grandTotalWon = subtotal + vatWon;

  return {
    mode: "commercial",
    quotationType: "scope_based",
    businessType: spec.businessType,
    totalAreaM2: spec.totalAreaM2,
    totalPyung: Math.round((spec.totalAreaM2 / 3.3058) * 10) / 10,
    budgetTier: tier,
    lineItems,
    breakdown: {
      demolitionWon,
      surfaceFinishesWon,
      systemsWon,
      fixturesWon,
      cleanupWon,
      directCostWon,
      indirectCostWon,
      profitWon,
      vatWon,
    },
    grandTotalWon,
    disclaimerKo:
      "CommercialScopeSpec 기반 가견적입니다. 정확한 견적은 현장 실측, 자재 등급 확정, 설비 사양 확정 후 산출됩니다.",
    readinessScore: spec.estimateReadiness.score,
  };
}
