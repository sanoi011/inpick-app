/**
 * 소비자 현장조건 답변과 견적 조정 규칙.
 *
 * 목적:
 * - 이미지로 볼 수 없는 철거 난이도·배선 범위·배관 이동·반출 조건을 질문으로 확보
 * - 현장 확인 전에는 정책 계수로 기본단가를 조정
 * - 최종 계약 전 사업자가 수량/단가를 다시 확인하고 확정
 */
import type { ConstructionEstimateLine } from "./types";

export type DemolitionScope = "finish_only" | "standard" | "heavy" | "unknown";
export type ElectricalScope = "fixtures_only" | "add_points" | "full_rewire" | "unknown";
export type PlumbingScope = "keep_positions" | "partial_relocation" | "major_relocation" | "unknown";
export type SiteAccess = "standard" | "restricted" | "stairs" | "unknown";

export interface SiteConditionAnswers {
  demolitionScope: DemolitionScope;
  electricalScope: ElectricalScope;
  plumbingScope: PlumbingScope;
  siteAccess: SiteAccess;
}

export const DEFAULT_SITE_CONDITION_ANSWERS: SiteConditionAnswers = {
  demolitionScope: "unknown",
  electricalScope: "unknown",
  plumbingScope: "unknown",
  siteAccess: "unknown",
};

export const SITE_CONDITION_OPTIONS = {
  demolitionScope: [
    { value: "finish_only", label: "마감재 위주", description: "벽지·바닥재·가구 등 가벼운 선택철거" },
    { value: "standard", label: "일반 전체철거", description: "바닥·타일·욕실·주방 철거 포함" },
    { value: "heavy", label: "고난도 철거", description: "벽체·두꺼운 몰탈·특수재 가능성 있음" },
    { value: "unknown", label: "잘 모르겠어요", description: "기본단가로 산정 후 현장에서 확인" },
  ],
  electricalScope: [
    { value: "fixtures_only", label: "기구만 교체", description: "조명·스위치·콘센트 위주" },
    { value: "add_points", label: "회로 일부 증설", description: "콘센트와 전용회로를 일부 추가" },
    { value: "full_rewire", label: "전체 재배선", description: "노후 배선·분전반까지 전면 교체" },
    { value: "unknown", label: "잘 모르겠어요", description: "기본단가로 산정 후 현장에서 확인" },
  ],
  plumbingScope: [
    { value: "keep_positions", label: "위치 유지", description: "기존 급수·배수 위치에 연결" },
    { value: "partial_relocation", label: "일부 이동", description: "싱크·세면대 등 일부 위치 변경" },
    { value: "major_relocation", label: "큰 폭 이동", description: "욕실·주방 배치 변경 또는 바닥 배관" },
    { value: "unknown", label: "잘 모르겠어요", description: "기본단가로 산정 후 현장에서 확인" },
  ],
  siteAccess: [
    { value: "standard", label: "일반 반출", description: "엘리베이터·주차·주간작업 가능" },
    { value: "restricted", label: "반출 제한", description: "주차·시간·엘리베이터 사용 제한" },
    { value: "stairs", label: "계단 소운반", description: "엘리베이터 없이 계단 운반 필요" },
    { value: "unknown", label: "잘 모르겠어요", description: "기본 조건으로 산정 후 확인" },
  ],
} as const;

const VALID = {
  demolitionScope: new Set<DemolitionScope>(["finish_only", "standard", "heavy", "unknown"]),
  electricalScope: new Set<ElectricalScope>(["fixtures_only", "add_points", "full_rewire", "unknown"]),
  plumbingScope: new Set<PlumbingScope>(["keep_positions", "partial_relocation", "major_relocation", "unknown"]),
  siteAccess: new Set<SiteAccess>(["standard", "restricted", "stairs", "unknown"]),
};

export function normalizeSiteConditionAnswers(value: unknown): SiteConditionAnswers {
  if (!value || typeof value !== "object") return { ...DEFAULT_SITE_CONDITION_ANSWERS };
  const raw = value as Partial<Record<keyof SiteConditionAnswers, unknown>>;
  return {
    demolitionScope: VALID.demolitionScope.has(raw.demolitionScope as DemolitionScope)
      ? (raw.demolitionScope as DemolitionScope)
      : "unknown",
    electricalScope: VALID.electricalScope.has(raw.electricalScope as ElectricalScope)
      ? (raw.electricalScope as ElectricalScope)
      : "unknown",
    plumbingScope: VALID.plumbingScope.has(raw.plumbingScope as PlumbingScope)
      ? (raw.plumbingScope as PlumbingScope)
      : "unknown",
    siteAccess: VALID.siteAccess.has(raw.siteAccess as SiteAccess)
      ? (raw.siteAccess as SiteAccess)
      : "unknown",
  };
}

const DEMOLITION_FACTOR: Record<DemolitionScope, number> = {
  finish_only: 0.85,
  standard: 1,
  heavy: 1.5,
  unknown: 1,
};
const ELECTRICAL_FACTOR: Record<ElectricalScope, number> = {
  fixtures_only: 0.7,
  add_points: 1,
  full_rewire: 2.2,
  unknown: 1,
};
const PLUMBING_FACTOR: Record<PlumbingScope, number> = {
  keep_positions: 1,
  partial_relocation: 1.4,
  major_relocation: 1.9,
  unknown: 1,
};
const ACCESS_FACTOR: Record<SiteAccess, number> = {
  standard: 1,
  restricted: 1.15,
  stairs: 1.3,
  unknown: 1,
};

const LABELS: Record<string, string> = {
  finish_only: "마감재 위주 철거",
  standard: "일반 전체철거",
  heavy: "고난도 철거",
  fixtures_only: "전기 기구만 교체",
  add_points: "전기 회로 일부 증설",
  full_rewire: "전기 전체 재배선",
  keep_positions: "급배수 위치 유지",
  partial_relocation: "급배수 일부 이동",
  major_relocation: "급배수 큰 폭 이동",
  restricted: "반출 조건 제한",
  stairs: "계단 소운반",
  unknown: "현장 미확인",
};

export function siteConditionAnswerSummary(answers: SiteConditionAnswers): string[] {
  const normalized = normalizeSiteConditionAnswers(answers);
  return [
    `철거: ${LABELS[normalized.demolitionScope]}`,
    `전기: ${LABELS[normalized.electricalScope]}`,
    `설비: ${LABELS[normalized.plumbingScope]}`,
    `반출: ${LABELS[normalized.siteAccess] || "일반 반출"}`,
  ];
}

/** 현장조건 답변을 site_allowance 라인의 단가에 적용한다. */
export function applySiteConditionAdjustments(
  lines: ConstructionEstimateLine[],
  rawAnswers: SiteConditionAnswers | undefined,
): ConstructionEstimateLine[] {
  const answers = normalizeSiteConditionAnswers(rawAnswers);
  const accessFactor = ACCESS_FACTOR[answers.siteAccess];

  return lines.map((line) => {
    if (line.pricingBasis !== "site_allowance") return line;

    let factor = 1;
    let reason = "";
    let answered = false;

    if (line.tradeCode === "02" || line.tradeCode === "15") {
      factor = DEMOLITION_FACTOR[answers.demolitionScope] * accessFactor;
      answered = answers.demolitionScope !== "unknown" || answers.siteAccess !== "unknown";
      reason = [
        LABELS[answers.demolitionScope],
        answers.siteAccess !== "unknown" ? LABELS[answers.siteAccess] || "일반 반출" : "",
      ].filter(Boolean).join(" · ");
    } else if (line.tradeCode === "04") {
      factor = ELECTRICAL_FACTOR[answers.electricalScope];
      answered = answers.electricalScope !== "unknown";
      reason = LABELS[answers.electricalScope];
    } else if (line.tradeCode === "05") {
      factor = PLUMBING_FACTOR[answers.plumbingScope];
      answered = answers.plumbingScope !== "unknown";
      reason = LABELS[answers.plumbingScope];
    } else {
      return line;
    }

    if (!answered) return line;
    // 복합 계수(예: 1.5 × 1.3)의 부동소수점 오차가 메타/PDF에 남지 않도록 정규화한다.
    factor = Math.round(factor * 100) / 100;

    const materialUnitPrice = Math.round(line.materialUnitPrice * factor);
    const laborUnitPrice = Math.round(line.laborUnitPrice * factor);
    const expenseUnitPrice = Math.round(line.expenseUnitPrice * factor);
    const materialAmount = Math.round(materialUnitPrice * line.quantity);
    const laborAmount = Math.round(laborUnitPrice * line.quantity);
    const expenseAmount = Math.round(expenseUnitPrice * line.quantity);
    const adjustmentText = `사용자 현장조건 반영: ${reason} (기본단가 ×${factor.toFixed(2)})`;

    return {
      ...line,
      materialUnitPrice,
      laborUnitPrice,
      expenseUnitPrice,
      materialAmount,
      laborAmount,
      expenseAmount,
      totalAmount: materialAmount + laborAmount + expenseAmount,
      siteConditionAdjustmentFactor: factor,
      siteConditionAdjustmentReason: reason,
      assumptions: Array.from(new Set([...line.assumptions, adjustmentText])),
    };
  });
}
