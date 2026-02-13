import type { TradeCode } from "@/lib/floor-plan/quantity/types";
import { TRADE_NAMES } from "@/lib/floor-plan/quantity/types";
import type { ConstructionSchedule, PhaseSchedule, ScheduleTask } from "@/types/construction-schedule";
import { PHASE_GANTT_COLORS } from "@/types/construction-schedule";
import {
  TRADE_PHASE_MAP,
  BASE_PHASE_WEIGHTS,
  PHASE_NAMES,
  MIN_PHASE_DAYS,
  BASE_WEIGHT_RATIO,
  COST_WEIGHT_RATIO,
  getTradesForPhase,
} from "./schedule-constants";
import { addDays, diffDays } from "./date-utils";

// ─── 입력 타입 ───

export interface ScheduleGeneratorInput {
  projectId: string;
  projectName?: string;
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD
  /** 공종별 비용 (estimate-calculator의 byTrade 결과) */
  tradeCosts?: Partial<Record<TradeCode, number>>;
  /** 기존 phase ID 목록 (DB에 이미 생성된 경우) */
  existingPhaseIds?: string[];
}

// ─── 메인 생성 함수 ───

export function generateSchedule(input: ScheduleGeneratorInput): ConstructionSchedule {
  const { projectId, projectName, startDate, endDate, tradeCosts, existingPhaseIds } = input;
  const totalDays = diffDays(startDate, endDate) + 1; // inclusive

  // 1) 비중 계산
  const weights = calculateWeights(tradeCosts);

  // 2) 공정별 일수 배분
  const durations = allocateDays(totalDays, weights);

  // 3) 순차 날짜 배분 + sub-task 생성
  const phases: PhaseSchedule[] = [];
  let cursor = startDate;

  for (let i = 0; i < 7; i++) {
    const phaseOrder = i + 1;
    const duration = durations[i];
    const phaseStart = cursor;
    const phaseEnd = addDays(phaseStart, duration - 1);
    const tradeCodes = getTradesForPhase(phaseOrder);

    // sub-task 생성 (공종별)
    const tasks = generateSubTasks(
      existingPhaseIds?.[i] || `phase-${phaseOrder}`,
      projectId,
      tradeCodes,
      phaseStart,
      phaseEnd,
      duration,
      tradeCosts,
    );

    phases.push({
      id: existingPhaseIds?.[i] || `phase-${phaseOrder}`,
      name: PHASE_NAMES[i],
      phaseOrder,
      status: "PENDING",
      startDate: phaseStart,
      endDate: phaseEnd,
      durationDays: duration,
      weight: weights[i],
      tradeCodes,
      color: PHASE_GANTT_COLORS[phaseOrder] || "#6B7280",
      tasks,
    });

    cursor = addDays(phaseEnd, 1);
  }

  return {
    projectId,
    projectName: projectName || "인테리어 공사",
    startDate,
    endDate,
    totalDays,
    phases,
    generatedAt: new Date().toISOString(),
  };
}

// ─── 비중 계산 (기본 + 비용 블렌딩) ───

function calculateWeights(tradeCosts?: Partial<Record<TradeCode, number>>): number[] {
  if (!tradeCosts || Object.keys(tradeCosts).length === 0) {
    return [...BASE_PHASE_WEIGHTS];
  }

  // 공종별 비용을 7개 공정으로 합산
  const phaseCosts = new Array(7).fill(0);
  let totalCost = 0;

  for (const [trade, cost] of Object.entries(tradeCosts) as [TradeCode, number][]) {
    if (cost > 0 && TRADE_PHASE_MAP[trade]) {
      const phaseIdx = TRADE_PHASE_MAP[trade] - 1;
      phaseCosts[phaseIdx] += cost;
      totalCost += cost;
    }
  }

  if (totalCost === 0) {
    return [...BASE_PHASE_WEIGHTS];
  }

  // 비용 비중
  const costWeights = phaseCosts.map((c) => c / totalCost);

  // 60:40 블렌딩
  const blended = BASE_PHASE_WEIGHTS.map((base, i) =>
    BASE_WEIGHT_RATIO * base + COST_WEIGHT_RATIO * costWeights[i]
  );

  // 정규화 (합=1)
  const sum = blended.reduce((a, b) => a + b, 0);
  return blended.map((w) => w / sum);
}

// ─── 일수 배분 ───

function allocateDays(totalDays: number, weights: number[]): number[] {
  // 원시 배분
  const raw = weights.map((w) => Math.max(MIN_PHASE_DAYS, Math.round(totalDays * w)));

  // 반올림 보정: 합이 totalDays와 맞도록
  const allocated = raw.reduce((a, b) => a + b, 0);
  const diff = totalDays - allocated;

  if (diff !== 0) {
    // 가장 큰 공정에 잔여 배분
    const maxIdx = raw.indexOf(Math.max(...raw));
    raw[maxIdx] = Math.max(MIN_PHASE_DAYS, raw[maxIdx] + diff);
  }

  return raw;
}

// ─── 공종별 sub-task 생성 ───

function generateSubTasks(
  phaseId: string,
  projectId: string,
  tradeCodes: TradeCode[],
  phaseStart: string,
  phaseEnd: string,
  phaseDuration: number,
  tradeCosts?: Partial<Record<TradeCode, number>>,
): ScheduleTask[] {
  if (tradeCodes.length === 0) return [];
  if (tradeCodes.length === 1) {
    return [{
      id: `task-${phaseId}-${tradeCodes[0]}`,
      phaseId,
      projectId,
      tradeCode: tradeCodes[0],
      name: TRADE_NAMES[tradeCodes[0]],
      startDate: phaseStart,
      endDate: phaseEnd,
      durationDays: phaseDuration,
      sortOrder: 0,
      status: "PENDING",
    }];
  }

  // 여러 공종: 비용 비중으로 비례 배분 (비용 없으면 균등)
  const costs = tradeCodes.map((tc) => tradeCosts?.[tc] || 1);
  const totalCost = costs.reduce((a, b) => a + b, 0);

  const tasks: ScheduleTask[] = [];
  let cursor = phaseStart;

  for (let i = 0; i < tradeCodes.length; i++) {
    const ratio = costs[i] / totalCost;
    const taskDays = Math.max(1, Math.round(phaseDuration * ratio));
    const taskEnd = addDays(cursor, taskDays - 1);

    // 마지막 task는 공정 끝 날짜까지
    const actualEnd = i === tradeCodes.length - 1 ? phaseEnd : taskEnd;
    const actualDays = diffDays(cursor, actualEnd) + 1;

    tasks.push({
      id: `task-${phaseId}-${tradeCodes[i]}`,
      phaseId,
      projectId,
      tradeCode: tradeCodes[i],
      name: TRADE_NAMES[tradeCodes[i]],
      startDate: cursor,
      endDate: actualEnd,
      durationDays: actualDays,
      sortOrder: i,
      status: "PENDING",
    });

    cursor = addDays(actualEnd, 1);
  }

  return tasks;
}
