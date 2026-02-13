import type { TradeCode } from "@/lib/floor-plan/quantity/types";
import type { PhaseStatus } from "./project";

// ─── 공종별 세부 작업 ───

export interface ScheduleTask {
  id: string;
  phaseId: string;
  projectId: string;
  tradeCode: TradeCode;
  name: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  sortOrder: number;
  status: PhaseStatus;
}

// ─── 공정 스케줄 (ProjectPhase 확장) ───

export interface PhaseSchedule {
  id: string;
  name: string;
  phaseOrder: number;
  status: PhaseStatus;
  startDate: string;
  endDate: string;
  durationDays: number;
  weight: number;
  tradeCodes: TradeCode[];
  color: string;
  tasks: ScheduleTask[];
}

// ─── 전체 공정표 ───

export interface ConstructionSchedule {
  projectId: string;
  projectName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  phases: PhaseSchedule[];
  generatedAt: string;
}

// ─── Gantt 차트 뷰 모드 ───

export type GanttViewMode = "day" | "week" | "month";

// ─── 공정별 Gantt 바 색상 ───

export const PHASE_GANTT_COLORS: Record<number, string> = {
  1: "#EF4444", // 철거 - red
  2: "#F59E0B", // 기초/배관 - amber
  3: "#3B82F6", // 전기 - blue
  4: "#8B5CF6", // 목공 - violet
  5: "#06B6D4", // 타일/방수 - cyan
  6: "#10B981", // 도배/도장 - emerald
  7: "#6B7280", // 마무리 - gray
};

// ─── DB 매핑 ───

export function mapDbScheduleTask(db: Record<string, unknown>): ScheduleTask {
  return {
    id: db.id as string,
    phaseId: db.phase_id as string,
    projectId: db.project_id as string,
    tradeCode: db.trade_code as TradeCode,
    name: (db.name as string) || "",
    startDate: db.start_date as string,
    endDate: db.end_date as string,
    durationDays: (db.duration_days as number) || 1,
    sortOrder: (db.sort_order as number) || 0,
    status: mapTaskStatus(db.status as string),
  };
}

function mapTaskStatus(s: string): PhaseStatus {
  switch (s) {
    case "in_progress": return "IN_PROGRESS";
    case "completed": return "COMPLETED";
    case "skipped": return "SKIPPED";
    default: return "PENDING";
  }
}
