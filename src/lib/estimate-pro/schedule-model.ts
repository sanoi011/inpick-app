// src/lib/estimate-pro/schedule-model.ts
//
// 견적 수량 → 인테리어 예정 공정표.
// 공사비 비중이나 임의의 30일을 사용하지 않고, 견적 라인의 단위별 작업량과
// 표준품셈 일당 시공량 및 KCS 품질 대기시간을 조합해 예비 공기를 계산한다.

import type { DetailGroup, DetailLine } from "./detail-model";

export interface PhaseBar {
  key: string;
  name: string;
  trades: string[];
  cost: number;
  startDay: number;
  durationDays: number;
  workDays: number;
  qualityHoldDays: number;
  quantityLabel: string;
  basis: string;
  standardRef: string;
  gradient: string;
}

export interface ScheduleResult {
  phases: PhaseBar[];
  totalDays: number;
  totalCost: number;
  calculationBasis: "quantity_productivity";
}

type UnitKind = "m2" | "m" | "ea" | "set" | "lot";

interface PhaseDef {
  key: string;
  name: string;
  matches: (line: DetailLine) => boolean;
  productivity: Record<UnitKind, number>;
  minWorkDays?: number;
  /** 작업 완료 뒤 후속공정을 막는 검사·양생 기간 */
  qualityHoldDays?: number;
  /** 작업과 보양을 합친 최소 달력일. 타일처럼 작업일과 보양이 일부 겹칠 때 사용 */
  minCalendarDays?: number;
  standardRef: string;
  gradient: string;
}

const hasTrade = (line: DetailLine, ...keywords: string[]) =>
  keywords.some((keyword) => line.trade.includes(keyword));
const hasItem = (line: DetailLine, ...keywords: string[]) =>
  keywords.some((keyword) => `${line.itemName} ${line.spec}`.includes(keyword));

const DEFAULT_PRODUCTIVITY: Record<UnitKind, number> = {
  m2: 35,
  m: 25,
  ea: 8,
  set: 2,
  lot: 1,
};

// 작업 순서와 생산성은 소규모 주거 인테리어의 예비 공정표 기준이다.
// 계약 전 사업자가 현장 인원·동시작업·자재 납기에 맞게 수정하는 것을 전제로 한다.
const PHASE_DEFS: PhaseDef[] = [
  {
    key: "prep",
    name: "가설·보양",
    matches: (line) => hasTrade(line, "가설", "보양"),
    productivity: { m2: 120, m: 80, ea: 20, set: 4, lot: 2 },
    minWorkDays: 1,
    standardRef: "견적 수량 기반 소규모 현장 준비 작업",
    gradient: "linear-gradient(90deg, #1d4ed8 0%, #3b82f6 55%, #60a5fa 100%)",
  },
  {
    key: "demo",
    name: "철거·폐기물",
    matches: (line) => hasTrade(line, "철거", "폐기물", "운반", "양중"),
    productivity: { m2: 60, m: 35, ea: 10, set: 3, lot: 1 },
    minWorkDays: 1,
    standardRef: "2026 표준품셈 유지관리 작업량과 소규모 현장 보정",
    gradient: "linear-gradient(90deg, #1e40af 0%, #2563eb 50%, #38bdf8 100%)",
  },
  {
    key: "window",
    name: "창호·문·중문",
    matches: (line) => hasTrade(line, "샷시", "창호", "중문"),
    productivity: { m2: 18, m: 15, ea: 4, set: 2, lot: 1 },
    minWorkDays: 1,
    standardRef: "견적 개소·세트 수량 기반",
    gradient: "linear-gradient(90deg, #1e3a8a 0%, #2563eb 52%, #0ea5e9 100%)",
  },
  {
    key: "rough_mep",
    name: "설비·전기·공조 배관배선",
    matches: (line) =>
      hasTrade(
        line,
        "기계설비",
        "설비공사",
        "전기",
        "전기공사",
        "냉난방",
        "환기",
        "네트워크",
        "통신",
      ),
    productivity: { m2: 40, m: 35, ea: 12, set: 4, lot: 1 },
    minWorkDays: 1,
    standardRef: "견적 배관 길이·기구 개소·회로 수 기반",
    gradient: "linear-gradient(90deg, #075985 0%, #0284c7 52%, #22d3ee 100%)",
  },
  {
    key: "fire",
    name: "소방",
    matches: (line) => hasTrade(line, "소방"),
    productivity: { m2: 50, m: 40, ea: 12, set: 4, lot: 1 },
    minWorkDays: 1,
    standardRef: "견적 기구·회로·배관 수량 기반",
    gradient: "linear-gradient(90deg, #1e40af 0%, #3b82f6 60%, #67e8f9 100%)",
  },
  {
    key: "substrate",
    name: "조적·미장·단열·바탕",
    matches: (line) => hasTrade(line, "조적", "미장", "단열"),
    productivity: { m2: 30, m: 25, ea: 8, set: 2, lot: 1 },
    minWorkDays: 1,
    standardRef: "2026 표준품셈 공종별 일당 작업량 준용",
    gradient: "linear-gradient(90deg, #1d4ed8 0%, #2563eb 45%, #06b6d4 100%)",
  },
  {
    key: "waterproof",
    name: "방수·담수시험",
    matches: (line) => hasTrade(line, "방수") || hasItem(line, "방수"),
    productivity: { m2: 35, m: 25, ea: 8, set: 2, lot: 1 },
    minWorkDays: 1,
    qualityHoldDays: 2,
    standardRef: "KCS 41 40 01 · 담수 후 약 48시간 누수 확인",
    gradient: "linear-gradient(90deg, #0c4a6e 0%, #0284c7 48%, #38bdf8 100%)",
  },
  {
    key: "tile",
    name: "타일·줄눈·보양",
    matches: (line) =>
      hasTrade(line, "타일") ||
      (hasTrade(line, "욕실공사") && hasItem(line, "타일", "줄눈")),
    productivity: { m2: 25, m: 20, ea: 8, set: 2, lot: 1 },
    minWorkDays: 1,
    minCalendarDays: 3,
    standardRef: "2026 표준품셈 타일 작업량 · KCS 41 48 01 시공 후 3일 보양",
    gradient: "linear-gradient(90deg, #164e63 0%, #0891b2 52%, #22d3ee 100%)",
  },
  {
    key: "wood",
    name: "목공·천장",
    matches: (line) => hasTrade(line, "목공", "천장"),
    productivity: { m2: 35, m: 30, ea: 8, set: 2, lot: 1 },
    minWorkDays: 1,
    standardRef: "2026 표준품셈 수장·목공 일당 작업량 준용",
    gradient: "linear-gradient(90deg, #1e3a8a 0%, #3b82f6 52%, #7dd3fc 100%)",
  },
  {
    key: "finish",
    name: "필름·도배·도장",
    matches: (line) => hasTrade(line, "필름", "도배", "페인트", "도장"),
    productivity: { m2: 85, m: 30, ea: 6, set: 2, lot: 1 },
    minWorkDays: 1,
    standardRef: "2026 표준품셈 도배 85㎡/일 기준 · 천장·현장조건 보정",
    gradient: "linear-gradient(90deg, #312e81 0%, #4f46e5 48%, #38bdf8 100%)",
  },
  {
    key: "floor",
    name: "바닥재·걸레받이",
    matches: (line) => hasTrade(line, "바닥재", "걸레받이", "몰딩"),
    productivity: { m2: 50, m: 45, ea: 10, set: 3, lot: 1 },
    minWorkDays: 1,
    standardRef: "2026 표준품셈 플로어링 마루 50㎡/일 기준",
    gradient: "linear-gradient(90deg, #1e40af 0%, #2563eb 45%, #60a5fa 100%)",
  },
  {
    key: "furniture",
    name: "맞춤형 가구·주방 설치",
    matches: (line) =>
      hasTrade(line, "가구", "싱크", "고정설비", "상업주방") &&
      !hasItem(line, "양변기", "세면대", "위생도기"),
    productivity: { m2: 15, m: 6, ea: 6, set: 1, lot: 1 },
    minWorkDays: 1,
    standardRef: "견적 가구 길이·개소 기준 현장 조립 및 설치",
    gradient: "linear-gradient(90deg, #172554 0%, #1d4ed8 48%, #0ea5e9 100%)",
  },
  {
    key: "fixtures",
    name: "위생도기·조명·기구 설치",
    matches: (line) =>
      hasTrade(line, "위생도기", "조명", "잡철", "하드웨어") ||
      hasItem(line, "양변기", "세면대", "수전", "도기 설치"),
    productivity: { m2: 30, m: 25, ea: 8, set: 2, lot: 1 },
    minWorkDays: 1,
    standardRef: "견적 위생·조명·부속기구 개소 기준",
    gradient: "linear-gradient(90deg, #1e40af 0%, #0ea5e9 55%, #67e8f9 100%)",
  },
  {
    key: "sign",
    name: "간판·사인",
    matches: (line) => hasTrade(line, "간판", "파사드"),
    productivity: { m2: 15, m: 15, ea: 5, set: 2, lot: 1 },
    minWorkDays: 1,
    standardRef: "견적 면적·개소 기준",
    gradient: "linear-gradient(90deg, #312e81 0%, #2563eb 52%, #06b6d4 100%)",
  },
  {
    key: "clean",
    name: "준공청소·검수",
    matches: (line) => hasTrade(line, "정리", "청소"),
    productivity: { m2: 100, m: 80, ea: 20, set: 4, lot: 1 },
    minWorkDays: 1,
    standardRef: "견적 면적·세대 수량 기준",
    gradient: "linear-gradient(90deg, #1e3a8a 0%, #0284c7 55%, #38bdf8 100%)",
  },
];

function unitKind(unit: string): UnitKind {
  const normalized = unit.trim().toLowerCase();
  if (["m²", "㎡", "m2", "sqm"].includes(normalized)) return "m2";
  if (["m", "lm"].includes(normalized)) return "m";
  if (["개", "ea"].includes(normalized)) return "ea";
  if (["세트", "set"].includes(normalized)) return "set";
  return "lot";
}

function uniqueLines(groups: DetailGroup[]): DetailLine[] {
  const lines = groups.flatMap((group) => group.lines);
  return Array.from(new Map(lines.map((line) => [line.id, line])).values());
}

function workload(lines: DetailLine[], def: PhaseDef) {
  const quantityByUnit: Record<UnitKind, number> = {
    m2: 0,
    m: 0,
    ea: 0,
    set: 0,
    lot: 0,
  };
  let rawDays = 0;

  for (const line of lines) {
    const kind = unitKind(line.unit);
    const quantity = Math.max(0, Number(line.quantity) || 0);
    quantityByUnit[kind] += quantity;
    const dailyOutput =
      def.productivity[kind] || DEFAULT_PRODUCTIVITY[kind];
    rawDays += quantity > 0 ? quantity / dailyOutput : 0;
  }

  const workDays = Math.max(def.minWorkDays || 1, Math.ceil(rawDays));
  const qualityHoldDays = def.qualityHoldDays || 0;
  const durationDays = Math.max(
    workDays + qualityHoldDays,
    def.minCalendarDays || 0,
  );

  const labels: string[] = [];
  if (quantityByUnit.m2 > 0) labels.push(`${roundQuantity(quantityByUnit.m2)}㎡`);
  if (quantityByUnit.m > 0) labels.push(`${roundQuantity(quantityByUnit.m)}m`);
  if (quantityByUnit.ea > 0) labels.push(`${roundQuantity(quantityByUnit.ea)}개`);
  if (quantityByUnit.set > 0) labels.push(`${roundQuantity(quantityByUnit.set)}세트`);
  if (quantityByUnit.lot > 0) labels.push(`${roundQuantity(quantityByUnit.lot)}식`);

  return {
    workDays,
    qualityHoldDays: Math.max(0, durationDays - workDays),
    durationDays,
    quantityLabel: labels.join(" · ") || "1식",
  };
}

function roundQuantity(value: number): string {
  return (Math.round(value * 10) / 10).toLocaleString("ko-KR");
}

/**
 * 견적에 실제 포함된 공종과 수량만으로 예비 공정표를 만든다.
 * 병렬 투입, 주말 작업, 자재 제작·납기, 공동주택 작업시간 제한은 계약 전
 * 사업자가 공정표 편집에서 반영한다.
 */
export function buildSchedule(groups: DetailGroup[]): ScheduleResult {
  const allLines = uniqueLines(groups);
  const matched = new Set<string>();
  const active: Array<PhaseDef & { lines: DetailLine[] }> = [];

  for (const def of PHASE_DEFS) {
    const lines = allLines.filter(
      (line) => !matched.has(line.id) && def.matches(line),
    );
    if (lines.length === 0) continue;
    lines.forEach((line) => matched.add(line.id));
    active.push({ ...def, lines });
  }

  const unmatched = allLines.filter((line) => !matched.has(line.id));
  if (unmatched.length > 0) {
    active.push({
      key: "other",
      name: "기타 설치·마감",
      matches: () => false,
      productivity: DEFAULT_PRODUCTIVITY,
      minWorkDays: 1,
      standardRef: "견적 단위 수량 기반 예비 작업량",
      gradient:
        "linear-gradient(90deg, #1e3a8a 0%, #3b82f6 52%, #7dd3fc 100%)",
      lines: unmatched,
    });
  }

  let cursor = 0;
  const phases = active.map((phase) => {
    const calculated = workload(phase.lines, phase);
    const cost = phase.lines.reduce((sum, line) => sum + line.amount, 0);
    const bar: PhaseBar = {
      key: phase.key,
      name: phase.name,
      trades: Array.from(new Set(phase.lines.map((line) => line.trade))),
      cost,
      startDay: cursor,
      durationDays: calculated.durationDays,
      workDays: calculated.workDays,
      qualityHoldDays: calculated.qualityHoldDays,
      quantityLabel: calculated.quantityLabel,
      basis: `${calculated.quantityLabel} · 작업 ${calculated.workDays}일${
        calculated.qualityHoldDays > 0
          ? ` + 검사·양생 ${calculated.qualityHoldDays}일`
          : ""
      }`,
      standardRef: phase.standardRef,
      gradient: phase.gradient,
    };
    cursor += calculated.durationDays;
    return bar;
  });

  return {
    phases,
    totalDays: cursor,
    totalCost: phases.reduce((sum, phase) => sum + phase.cost, 0),
    calculationBasis: "quantity_productivity",
  };
}

/**
 * 발행 문서 스냅샷의 라인도 웹 공정표와 같은 수량·생산성 엔진을 사용한다.
 * PDF가 별도의 고정 공정 순서를 다시 계산하지 않도록 만드는 어댑터다.
 */
export function buildScheduleFromDocumentLines(
  lines: Array<{
    id: string;
    tradeName: string;
    itemName: string;
    spec?: string;
    unit: string;
    quantity: number;
    totalAmount: number;
    roomName?: string;
  }>,
): ScheduleResult {
  const detailLines = lines.map((line, index): DetailLine => ({
    id: line.id,
    trade: line.tradeName,
    order: index + 1,
    itemCode: "",
    itemName: line.itemName,
    part: "공통",
    spec: line.spec || "",
    brand: "",
    product: "",
    unit: line.unit,
    quantity: line.quantity,
    matUnit: 0,
    labUnit: 0,
    expenseUnit: 0,
    matAmount: 0,
    labAmount: 0,
    expenseAmount: 0,
    amount: line.totalAmount,
    room: line.roomName || "공통",
    source: "발행 견적 수량",
    optional: false,
    added: false,
  }));
  return buildSchedule([
    {
      trade: "발행 견적",
      order: 1,
      lines: detailLines,
      matSum: 0,
      labSum: 0,
      expenseSum: 0,
      sum: detailLines.reduce((sum, line) => sum + line.amount, 0),
    },
  ]);
}
