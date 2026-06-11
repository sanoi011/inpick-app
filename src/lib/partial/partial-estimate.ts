/**
 * 부분 인테리어 간이 적산 v2 — 선택 자재(상품가) + 부위 + 시공규모(면적/수량) 기준으로
 * 자재비/철거/설치노무/부자재/폐기물/간접비/이윤/VAT를 분해한다.
 *
 * v1 대비 변경 (적산 단가 현실화):
 *  - 부위별 단위기준(basis): 마감재(바닥/벽/천정) = 면적(㎡), 그 외 설비/도기 = 수량(EA)
 *  - 노무·철거·폐기물이 시공규모(면적/수량)에 비례 (v1은 항상 1식 고정)
 *  - 지역 노무 할증(수도권/광역시/도서) 반영
 *  - 면적 자재 로스율 반영
 *  - 최소 출장 노무비(min) 바닥 적용
 *  - 관리자 단가DB에서 주입 가능한 rates 오버라이드 시그니처 (미주입 시 기본 상수)
 *
 * 전체 인테리어 17공종 엔진(src/lib/floor-plan/quantity)과 분리된 "부분 시공" 전용 간이 산출.
 * 상품 참고가 기반이므로 "현장 조건/실측에 따라 달라지는 예상치"로 표시한다.
 */

export type PartialSurface = "floor" | "wall" | "ceiling" | "etc";
export type UnitBasis = "area" | "count";

/** 부위별 적산 단가 (관리자 단가DB로 주입 가능). 면적기준은 ㎡당, 수량기준은 EA당. */
export interface PartialRates {
  basis: UnitBasis;
  trade: string;
  installPerUnit: number; // 설치/시공 노무 (㎡ 또는 EA 당)
  demoPerUnit: number; // 기존 철거 노무 (단위당)
  disposalPerUnit: number; // 폐기물 처리 (단위당)
  auxRate: number; // 부자재 = 자재비 × 비율
  loss: number; // 면적 자재 로스율 (수량기준은 0)
  minLabor: number; // 최소 설치 노무비(출장 최소). 0이면 미적용
}

export interface PartialEstimateInput {
  surface: PartialSurface;
  materialName: string;
  unitPrice: number; // 자재 단가 — 면적기준=㎡당 추정가, 수량기준=1개 참고가
  quantity?: number; // 면적(㎡) 또는 수량(EA). 기본: 면적 10 / 수량 1
  region?: string;
  /** 관리자 단가DB 오버라이드 (부위별 부분 주입 가능) */
  rates?: Partial<Record<PartialSurface, Partial<PartialRates>>>;
}

export interface EstimateLine {
  trade: string; // 공종
  item: string; // 품명
  unit: string;
  qty: number;
  unitPrice: number;
  amount: number;
  source: "product" | "standard"; // product=상품참고가, standard=표준 추정
}

export interface PartialEstimate {
  lines: EstimateLine[];
  materialAmount: number;
  laborAmount: number;
  expenseAmount: number;
  subtotal: number;
  overhead: number; // 간접비 6%
  profit: number; // 이윤 5%
  vat: number; // 부가세 10%
  total: number;
  precisionLevel: "P1";
  // v2 메타 (UI 표기용)
  basis: UnitBasis;
  unitLabel: string; // "㎡" | "개"
  effectiveQty: number;
  regionMultiplier: number;
  warnings: string[];
}

// 부위별 표준 추정 단가 — 실거래 평균 기반 러프값 (관리자 단가DB로 격상 가능)
export const DEFAULT_PARTIAL_RATES: Record<PartialSurface, PartialRates> = {
  floor: { basis: "area", trade: "바닥공사", installPerUnit: 28_000, demoPerUnit: 9_000, disposalPerUnit: 4_000, auxRate: 0.12, loss: 0.08, minLabor: 160_000 },
  wall: { basis: "area", trade: "벽체·도배공사", installPerUnit: 18_000, demoPerUnit: 5_000, disposalPerUnit: 2_500, auxRate: 0.1, loss: 0.1, minLabor: 120_000 },
  ceiling: { basis: "area", trade: "천정공사", installPerUnit: 22_000, demoPerUnit: 6_000, disposalPerUnit: 3_000, auxRate: 0.1, loss: 0.1, minLabor: 130_000 },
  etc: { basis: "count", trade: "부분공사", installPerUnit: 120_000, demoPerUnit: 45_000, disposalPerUnit: 20_000, auxRate: 0.1, loss: 0, minLabor: 0 },
};

const round = (n: number) => Math.round(n / 100) * 100;

/** 지역 노무 할증 배수 (자재명·지역 텍스트 기반 간이 추정) */
export function regionLaborMultiplier(region?: string): number {
  const r = region ?? "";
  if (/제주|도서|섬|울릉/.test(r)) return 1.25;
  if (/서울|경기|인천|수도권/.test(r)) return 1.15;
  if (/부산|대구|광주|대전|울산|세종|광역시|특별시|특별자치/.test(r)) return 1.05;
  return 1.0;
}

/** 부위 → 단위기준 */
export function surfaceBasis(surface: PartialSurface): UnitBasis {
  return (DEFAULT_PARTIAL_RATES[surface] ?? DEFAULT_PARTIAL_RATES.etc).basis;
}

export function surfaceUnitLabel(surface: PartialSurface): string {
  return surfaceBasis(surface) === "area" ? "㎡" : "개";
}

export function calcPartialEstimate(input: PartialEstimateInput): PartialEstimate {
  const base = DEFAULT_PARTIAL_RATES[input.surface] ?? DEFAULT_PARTIAL_RATES.etc;
  // 관리자 단가DB 오버라이드 병합
  const std: PartialRates = { ...base, ...(input.rates?.[input.surface] ?? {}) };
  const isArea = std.basis === "area";
  const unitLabel = isArea ? "㎡" : "개";

  const rawQty = input.quantity ?? (isArea ? 10 : 1);
  const qty = isArea ? Math.max(1, Math.round(rawQty)) : Math.max(1, Math.floor(rawQty));
  const unitPrice = Math.max(0, Math.floor(input.unitPrice || 0));
  const mult = regionLaborMultiplier(input.region);

  const lines: EstimateLine[] = [];

  // 1) 자재비 (상품 참고가 × 규모, 면적은 로스 가산)
  const materialAmount = round(unitPrice * qty * (isArea ? 1 + std.loss : 1));
  lines.push({
    trade: std.trade,
    item: `${input.materialName} (자재${isArea && std.loss > 0 ? ` · 로스 ${Math.round(std.loss * 100)}%` : ""})`,
    unit: unitLabel,
    qty,
    unitPrice,
    amount: materialAmount,
    source: "product",
  });

  // 2) 기존 철거 노무 (규모 비례 × 지역)
  const demoLabor = round(std.demoPerUnit * qty * mult);
  lines.push({
    trade: "철거공사",
    item: "기존 마감/자재 철거",
    unit: unitLabel,
    qty,
    unitPrice: round(std.demoPerUnit * mult),
    amount: demoLabor,
    source: "standard",
  });

  // 3) 설치 노무 (규모 비례 × 지역, 최소 출장노무 바닥)
  const installLabor = round(Math.max(std.minLabor, std.installPerUnit * qty) * mult);
  lines.push({
    trade: std.trade,
    item: `설치/시공 노무${std.minLabor > 0 && std.installPerUnit * qty < std.minLabor ? " (최소 출장비 적용)" : ""}`,
    unit: unitLabel,
    qty,
    unitPrice: round((installLabor || 0) / qty),
    amount: installLabor,
    source: "standard",
  });

  // 4) 부자재 (자재비 비율)
  const aux = round(materialAmount * std.auxRate);
  lines.push({
    trade: std.trade,
    item: "부자재 (접착·실리콘·마감재 등)",
    unit: "식",
    qty: 1,
    unitPrice: aux,
    amount: aux,
    source: "standard",
  });

  // 5) 폐기물 처리 (규모 비례)
  const disposal = round(std.disposalPerUnit * qty);
  lines.push({
    trade: "폐기물",
    item: "폐자재 반출·처리",
    unit: unitLabel,
    qty,
    unitPrice: round(std.disposalPerUnit),
    amount: disposal,
    source: "standard",
  });

  const laborAmount = demoLabor + installLabor;
  const expenseAmount = aux + disposal;
  const subtotal = materialAmount + laborAmount + expenseAmount;
  const overhead = round(subtotal * 0.06); // 간접비 6%
  const profit = round(subtotal * 0.05); // 이윤 5%
  const beforeVat = subtotal + overhead + profit;
  const vat = round(beforeVat * 0.1);
  const total = beforeVat + vat;

  const warnings = [
    "상품 참고가 기반 예상치입니다. 실제 시공비는 현장 조건·실측·시공자 견적에 따라 달라집니다.",
  ];
  if (isArea) {
    warnings.push("면적 자재가는 ㎡당 기준 추정이며, 실제는 제품 규격·포장단위에 따라 달라질 수 있습니다.");
  }
  if (mult > 1) {
    warnings.push(`지역 노무 할증 ×${mult.toFixed(2)} 적용 (수도권/광역시/도서 기준).`);
  }
  if (input.surface === "etc" || /변기|배관|누수|전기|가스/.test(input.materialName)) {
    warnings.push("배관·전기·누수 등은 현장 진단이 필요할 수 있습니다.");
  }

  return {
    lines,
    materialAmount,
    laborAmount,
    expenseAmount,
    subtotal,
    overhead,
    profit,
    vat,
    total,
    precisionLevel: "P1",
    basis: std.basis,
    unitLabel,
    effectiveQty: qty,
    regionMultiplier: mult,
    warnings,
  };
}
