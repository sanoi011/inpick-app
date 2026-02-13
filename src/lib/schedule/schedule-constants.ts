import type { TradeCode } from "@/lib/floor-plan/quantity/types";

// ─── 17개 공종 → 7개 기본 공정 매핑 ───

export const TRADE_PHASE_MAP: Record<TradeCode, number> = {
  "01_DEMOLITION": 1,           // 철거
  "02_MASONRY": 2,              // 기초/설비 배관
  "03_PLASTER": 2,
  "12_PLUMBING": 2,
  "13_SANITARY": 2,
  "14_ELECTRICAL": 3,           // 전기 배선
  "06_WOODWORK": 4,             // 목공
  "09_CEILING": 4,
  "10_DOOR_WINDOW": 4,
  "04_WATERPROOF": 5,           // 타일/방수
  "05_TILE": 5,
  "07_FLOORING": 5,
  "08_WALLPAPER_PAINT": 6,      // 도배/도장
  "16_BASEBOARD_MOLDING": 6,
  "11_HARDWARE": 7,             // 마무리/검수
  "15_FIXTURE": 7,
  "17_CLEANUP": 7,
};

// ─── 7개 공정 기본 비중 (건설업 표준 + 인테리어 경험치) ───

export const BASE_PHASE_WEIGHTS = [
  0.10, // 1. 철거
  0.15, // 2. 기초/설비 배관
  0.10, // 3. 전기 배선
  0.25, // 4. 목공
  0.15, // 5. 타일/방수
  0.15, // 6. 도배/도장
  0.10, // 7. 마무리/검수
];

// ─── 7개 공정 이름 ───

export const PHASE_NAMES = [
  "철거",
  "기초/설비 배관",
  "전기 배선",
  "목공",
  "타일/방수",
  "도배/도장",
  "마무리/검수",
];

// ─── 공정별 색상 ───

export const PHASE_COLORS: Record<number, string> = {
  1: "#EF4444",
  2: "#F59E0B",
  3: "#3B82F6",
  4: "#8B5CF6",
  5: "#06B6D4",
  6: "#10B981",
  7: "#6B7280",
};

// ─── 공정별 매핑 공종 목록 (역매핑) ───

export function getTradesForPhase(phaseOrder: number): TradeCode[] {
  return (Object.entries(TRADE_PHASE_MAP) as [TradeCode, number][])
    .filter(([, p]) => p === phaseOrder)
    .map(([t]) => t);
}

// ─── 최소 공정 일수 ───

export const MIN_PHASE_DAYS = 1;

// ─── 비용 비중 블렌딩 비율 ───

export const BASE_WEIGHT_RATIO = 0.6;
export const COST_WEIGHT_RATIO = 0.4;
