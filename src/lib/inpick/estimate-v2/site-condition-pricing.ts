/**
 * 철거·전기·설비 기본공사 및 현장 변동 메타.
 *
 * 이미지/도면만으로 확인할 수 없는 매립 배선·배관·바탕 상태를 임의 확정하지 않는다.
 * 견적에는 기본 단가를 넣되, 현장 확인 후 사업자가 수정·확정하는 allowance로 표시한다.
 */
import type {
  ConstructionEstimateLine,
  PricingBasis,
  RoomQuantityBasis,
} from "./types";

export interface SiteConditionPricingMeta {
  pricingBasis: PricingBasis;
  contractorEditable: boolean;
  siteVerificationRequired: boolean;
  variationNotice: string;
  siteAdjustmentFactors: string[];
}

const DEMOLITION_NOTICE =
  "철거 공사 금액은 기본 철거 단가로 산정한 가견적이며, 기존 마감 상태·폐기물량·양중 조건 등에 따라 변동될 수 있습니다. 현장 확인 후 사업자가 수정·확정합니다.";
const ELECTRICAL_NOTICE =
  "전기 공사 금액은 기본 회로·배선 상태를 가정한 가견적입니다. 분전반 용량, 노후 배선, 전용회로와 매립 배선 범위 확인 후 사업자가 수정·확정합니다.";
const PLUMBING_NOTICE =
  "설비 공사 금액은 기존 급수·배수 위치를 유지하는 기본 보수 기준입니다. 배관 노후도, 누수, 위치 이동, 방수·바닥 상태 확인 후 사업자가 수정·확정합니다.";
const WASTE_NOTICE =
  "폐기물·운반 금액은 기본 물량과 일반적인 엘리베이터 사용 조건을 가정한 가견적입니다. 폐기물 종류·물량·층수·주차 및 반출 조건에 따라 변동될 수 있습니다.";

const META_BY_TRADE: Record<string, SiteConditionPricingMeta> = {
  "02": {
    pricingBasis: "site_allowance",
    contractorEditable: true,
    siteVerificationRequired: true,
    variationNotice: DEMOLITION_NOTICE,
    siteAdjustmentFactors: [
      "기존 마감재 종류·겹수와 접착 강도",
      "내력벽·석면 등 특수 철거 여부",
      "폐기물 종류·물량과 반출 동선",
      "층수·엘리베이터·주차·작업시간 제한",
    ],
  },
  "04": {
    pricingBasis: "site_allowance",
    contractorEditable: true,
    siteVerificationRequired: true,
    variationNotice: ELECTRICAL_NOTICE,
    siteAdjustmentFactors: [
      "기존 배선과 절연 상태",
      "분전반 용량과 차단기 증설",
      "인덕션·에어컨 등 전용회로 수",
      "매립·노출 배선 및 타공 범위",
    ],
  },
  "05": {
    pricingBasis: "site_allowance",
    contractorEditable: true,
    siteVerificationRequired: true,
    variationNotice: PLUMBING_NOTICE,
    siteAdjustmentFactors: [
      "기존 배관 재질과 노후도",
      "급수·배수 위치 이동 거리",
      "누수·구배·바닥 단차와 방수 상태",
      "가스·난방 배관 포함 여부",
    ],
  },
  "15": {
    pricingBasis: "site_allowance",
    contractorEditable: true,
    siteVerificationRequired: true,
    variationNotice: WASTE_NOTICE,
    siteAdjustmentFactors: [
      "혼합·불연·특수 폐기물 구분",
      "실제 폐기물 부피와 차량 횟수",
      "엘리베이터·사다리차·소운반 조건",
      "관리사무소 반출 시간 제한",
    ],
  },
};

export const SITE_CONDITION_NOTICES = {
  demolition: DEMOLITION_NOTICE,
  electrical: ELECTRICAL_NOTICE,
  plumbing: PLUMBING_NOTICE,
  waste: WASTE_NOTICE,
} as const;

export function getSiteConditionPricingMeta(
  tradeCode: string,
): SiteConditionPricingMeta | undefined {
  return META_BY_TRADE[tradeCode];
}

interface BuildBaseSiteAllowancesInput {
  projectId: string;
  projectMode: "apartment" | "photo_only" | "commercial";
  quantityBasisByRoom: Record<string, RoomQuantityBasis>;
  existingLines: ConstructionEstimateLine[];
}

/**
 * 마감재 SurfacePlan이 전기·설비 힌트를 만들지 못해도 기본 공사가 빠지지 않도록 보강한다.
 * 기존에 같은 방/공종 라인이 있으면 추가하지 않아 중복 산정을 방지한다.
 */
export function buildBaseSiteConditionAllowanceLines(
  input: BuildBaseSiteAllowancesInput,
): ConstructionEstimateLine[] {
  if (input.projectMode === "commercial") return [];

  const bases = Object.values(input.quantityBasisByRoom);
  if (bases.length === 0) return [];

  const lines: ConstructionEstimateLine[] = [];
  const common = bases[0];
  const totalArea = bases.reduce((sum, basis) => sum + basis.floorM2, 0);
  const existing = input.existingLines;

  // 철거 라인이 전혀 없는 프로젝트만 면적 기준 기본 선택철거를 보강한다.
  if (!existing.some((line) => line.tradeCode === "02")) {
    lines.push(
      allowanceLine({
        projectId: input.projectId,
        basis: common,
        tradeCode: "02",
        tradeNameKo: "철거공사",
        subTradeCode: "02-90",
        subTradeNameKo: "기본 선택철거",
        taskNameKo: "기존 마감 기본 선택철거",
        itemNameKo: "기본 철거 (현장확인 전)",
        unit: "m2",
        quantity: Math.round(totalArea * 10) / 10,
        quantityFormulaKo: "프로젝트 바닥면적 기준 기본 철거",
        laborUnitPrice: 12_000,
        expenseUnitPrice: 1_200,
      }),
    );
  }

  // 전기: 이미지에 조명이 없어도 안전점검 + 방별 기본 배선/콘센트 수량을 보장한다.
  if (!existing.some((line) => line.subTradeCode === "04-90")) {
    lines.push(
      allowanceLine({
        projectId: input.projectId,
        basis: common,
        tradeCode: "04",
        tradeNameKo: "전기공사",
        subTradeCode: "04-90",
        subTradeNameKo: "기존 전기 점검",
        taskNameKo: "분전반·절연·기존 회로 기본 점검",
        itemNameKo: "전기 안전점검 및 기본 보강",
        unit: "lot",
        quantity: 1,
        quantityFormulaKo: "세대 1식",
        materialUnitPrice: 20_000,
        laborUnitPrice: 80_000,
        expenseUnitPrice: 20_000,
      }),
    );
  }

  const targetElectricalRooms = Math.max(1, bases.length);
  const existingCircuitPoints = existing
    .filter((line) => line.tradeCode === "04" && line.subTradeCode === "04-01")
    .reduce((sum, line) => sum + line.quantity, 0);
  const missingCircuitPoints = Math.max(0, targetElectricalRooms - existingCircuitPoints);
  if (missingCircuitPoints > 0) {
    lines.push(
      allowanceLine({
        projectId: input.projectId,
        basis: common,
        tradeCode: "04",
        tradeNameKo: "전기공사",
        subTradeCode: "04-01",
        subTradeNameKo: "기본 배선",
        taskNameKo: "방별 조명 회로 점검·기본 보강",
        itemNameKo: "전선 + 분기",
        unit: "ea",
        quantity: missingCircuitPoints,
        quantityFormulaKo: `방 ${targetElectricalRooms}개 - 기존 산출 ${existingCircuitPoints}개`,
        materialUnitPrice: 12_000,
        laborUnitPrice: 25_000,
        expenseUnitPrice: 2_000,
      }),
    );
  }

  const targetSwitchOutlets = Math.max(2, bases.length * 2);
  const existingSwitchOutlets = existing
    .filter((line) => line.tradeCode === "04" && line.subTradeCode === "04-03")
    .reduce((sum, line) => sum + line.quantity, 0);
  const missingSwitchOutlets = Math.max(0, targetSwitchOutlets - existingSwitchOutlets);
  if (missingSwitchOutlets > 0) {
    lines.push(
      allowanceLine({
        projectId: input.projectId,
        basis: common,
        tradeCode: "04",
        tradeNameKo: "전기공사",
        subTradeCode: "04-03",
        subTradeNameKo: "스위치·콘센트",
        taskNameKo: "스위치·콘센트 기본 교체",
        itemNameKo: "표준 스위치/콘센트",
        unit: "ea",
        quantity: missingSwitchOutlets,
        quantityFormulaKo: `방당 2개 기본 - 기존 산출 ${existingSwitchOutlets}개`,
        materialUnitPrice: 8_000,
        laborUnitPrice: 12_000,
        expenseUnitPrice: 1_000,
      }),
    );
  }

  // 설비: 욕실·주방·다용도실별로 기존 05 공종이 없을 때만 기본 연결/보수를 보강한다.
  for (const basis of bases) {
    if (!["bathroom", "kitchen", "utility"].includes(basis.roomType)) continue;
    if (existing.some((line) => line.tradeCode === "05" && line.roomId === basis.roomId)) continue;

    const bathroom = basis.roomType === "bathroom";
    const kitchen = basis.roomType === "kitchen";
    lines.push(
      allowanceLine({
        projectId: input.projectId,
        basis,
        tradeCode: "05",
        tradeNameKo: "설비공사",
        subTradeCode: bathroom ? "05-10" : kitchen ? "05-21" : "05-90",
        subTradeNameKo: bathroom ? "욕실 배관" : kitchen ? "주방 급배수" : "다용도실 급배수",
        taskNameKo: `${basis.roomName} 급수·배수 기본 연결 및 보수`,
        itemNameKo: "급배수 배관 기본 보수",
        unit: "set",
        quantity: 1,
        quantityFormulaKo: `${basis.roomName} 1식`,
        materialUnitPrice: bathroom ? 180_000 : kitchen ? 80_000 : 60_000,
        laborUnitPrice: bathroom ? 280_000 : kitchen ? 160_000 : 120_000,
        expenseUnitPrice: bathroom ? 40_000 : 20_000,
      }),
    );
  }

  return lines;
}

interface AllowanceLineInput {
  projectId: string;
  basis: RoomQuantityBasis;
  tradeCode: "02" | "04" | "05";
  tradeNameKo: string;
  subTradeCode: string;
  subTradeNameKo: string;
  taskNameKo: string;
  itemNameKo: string;
  unit: "m2" | "ea" | "set" | "lot";
  quantity: number;
  quantityFormulaKo: string;
  materialUnitPrice?: number;
  laborUnitPrice?: number;
  expenseUnitPrice?: number;
}

function allowanceLine(input: AllowanceLineInput): ConstructionEstimateLine {
  const materialUnitPrice = input.materialUnitPrice ?? 0;
  const laborUnitPrice = input.laborUnitPrice ?? 0;
  const expenseUnitPrice = input.expenseUnitPrice ?? 0;
  const materialAmount = Math.round(materialUnitPrice * input.quantity);
  const laborAmount = Math.round(laborUnitPrice * input.quantity);
  const expenseAmount = Math.round(expenseUnitPrice * input.quantity);
  const meta = getSiteConditionPricingMeta(input.tradeCode)!;

  return {
    id: randomId(),
    sortNo: 0,
    tradeCode: input.tradeCode,
    tradeNameKo: input.tradeNameKo,
    subTradeCode: input.subTradeCode,
    subTradeNameKo: input.subTradeNameKo,
    roomId: input.basis.roomId,
    roomName: input.tradeCode === "05" ? input.basis.roomName : "전체",
    roomType: input.tradeCode === "05" ? input.basis.roomType : "unknown",
    surfaceType: input.tradeCode === "04" ? "lighting" : input.tradeCode === "05" ? "fixture" : "floor",
    taskNameKo: input.taskNameKo,
    itemNameKo: input.itemNameKo,
    unit: input.unit,
    quantityFormulaKo: input.quantityFormulaKo,
    quantity: input.quantity,
    materialUnitPrice,
    laborUnitPrice,
    expenseUnitPrice,
    materialAmount,
    laborAmount,
    expenseAmount,
    totalAmount: materialAmount + laborAmount + expenseAmount,
    included: true,
    source: "standard_fallback_material",
    confidence: 0.45,
    pricingBasis: meta.pricingBasis,
    contractorEditable: meta.contractorEditable,
    siteVerificationRequired: meta.siteVerificationRequired,
    variationNotice: meta.variationNotice,
    siteAdjustmentFactors: meta.siteAdjustmentFactors,
    evidenceRefs: [],
    assumptions: [
      "이미지·도면에서 확인할 수 없는 기본공사를 INPICK 기본 단가로 보강했습니다.",
      meta.variationNotice,
      `현장확인 변수: ${meta.siteAdjustmentFactors.join(" · ")}`,
    ],
    warnings: [meta.variationNotice],
  };
}

function randomId(): string {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return `site-${Math.random().toString(36).slice(2, 12)}`;
}
