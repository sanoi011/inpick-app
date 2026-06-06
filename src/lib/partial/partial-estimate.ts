/**
 * 부분 인테리어 간이 적산 — 선택 자재(상품가) + 부위 기준으로
 * 자재비/철거/설치노무/부자재/폐기물/간접비/이윤/VAT를 분해한다.
 *
 * 전체 인테리어 17공종 엔진(src/lib/floor-plan/quantity)과 분리된 "부분 시공" 전용 간이 산출.
 * 네이버 참고가 기반이므로 "현장 조건/실측에 따라 달라질 수 있는 예상치"로 표시한다.
 */

export type PartialSurface = "floor" | "wall" | "ceiling" | "etc";

export interface PartialEstimateInput {
  surface: PartialSurface;
  materialName: string;
  unitPrice: number; // 상품 1단위(또는 1식) 참고가
  quantity?: number; // 기본 1
  region?: string;
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
  warnings: string[];
}

// 부위별 표준 추정 단가(원) — 실거래 평균 기반 러프값 (관리자 단가DB로 추후 격상)
const STD: Record<
  PartialSurface,
  { demolitionLabor: number; installLabor: number; auxRate: number; disposal: number; trade: string }
> = {
  floor: { demolitionLabor: 90_000, installLabor: 180_000, auxRate: 0.12, disposal: 40_000, trade: "바닥공사" },
  wall: { demolitionLabor: 60_000, installLabor: 150_000, auxRate: 0.1, disposal: 30_000, trade: "벽체·도배공사" },
  ceiling: { demolitionLabor: 70_000, installLabor: 160_000, auxRate: 0.1, disposal: 30_000, trade: "천정공사" },
  etc: { demolitionLabor: 50_000, installLabor: 120_000, auxRate: 0.1, disposal: 25_000, trade: "부분공사" },
};

const round = (n: number) => Math.round(n / 100) * 100;

export function calcPartialEstimate(input: PartialEstimateInput): PartialEstimate {
  const qty = Math.max(1, Math.floor(input.quantity ?? 1));
  const std = STD[input.surface] ?? STD.etc;
  const unitPrice = Math.max(0, Math.floor(input.unitPrice || 0));

  const lines: EstimateLine[] = [];

  // 1) 자재비 (상품 참고가)
  const materialAmount = round(unitPrice * qty);
  lines.push({
    trade: std.trade,
    item: `${input.materialName} (자재)`,
    unit: "EA",
    qty,
    unitPrice,
    amount: materialAmount,
    source: "product",
  });

  // 2) 기존 철거 노무
  lines.push({
    trade: "철거공사",
    item: "기존 마감/자재 철거",
    unit: "식",
    qty: 1,
    unitPrice: std.demolitionLabor,
    amount: std.demolitionLabor,
    source: "standard",
  });

  // 3) 설치 노무
  lines.push({
    trade: std.trade,
    item: "설치/시공 노무",
    unit: "식",
    qty: 1,
    unitPrice: std.installLabor,
    amount: std.installLabor,
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

  // 5) 폐기물 처리
  lines.push({
    trade: "폐기물",
    item: "폐자재 반출·처리",
    unit: "식",
    qty: 1,
    unitPrice: std.disposal,
    amount: std.disposal,
    source: "standard",
  });

  const laborAmount = std.demolitionLabor + std.installLabor;
  const expenseAmount = aux + std.disposal;
  const subtotal = materialAmount + laborAmount + expenseAmount;
  const overhead = round(subtotal * 0.06); // 간접비 6%
  const profit = round(subtotal * 0.05); // 이윤 5%
  const beforeVat = subtotal + overhead + profit;
  const vat = round(beforeVat * 0.1);
  const total = beforeVat + vat;

  const warnings = [
    "네이버 쇼핑 참고가 기반 예상치입니다. 실제 시공비는 현장 조건·실측·시공자 견적에 따라 달라집니다.",
  ];
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
    warnings,
  };
}
