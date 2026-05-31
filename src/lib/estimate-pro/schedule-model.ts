// src/lib/estimate-pro/schedule-model.ts
//
// 견적(공종별 금액) → 인테리어 공정표(막대그래프) 생성.
// 공종을 시공 순서대로 공정(phase)에 매핑하고, 비용 비중으로 공기를 배분한다.
// 주택/상가 공종 모두 매핑(상가 공종은 해당 phase에 합류 + 간판/소방 phase 추가).

import type { DetailGroup } from './detail-model';

export interface PhaseBar {
  key: string;
  name: string;
  trades: string[];
  cost: number;
  startDay: number;
  durationDays: number;
  color: string;
}

export interface ScheduleResult {
  phases: PhaseBar[];
  totalDays: number;
  totalCost: number;
}

interface PhaseDef {
  key: string;
  name: string;
  trades: string[];
  color: string;
  minDays: number;
}

// 시공 순서대로 정의. trades에는 우리 마스터 공종명 + build-estimate(v2) tradeNameKo를 함께 매핑.
const PHASE_DEFS: PhaseDef[] = [
  { key: 'prep',  name: '가설·보양',            trades: ['가설', '가설·보양공사'], color: '#94a3b8', minDays: 1 },
  { key: 'demo',  name: '철거·폐기물',          trades: ['철거', '철거공사', '폐기물·운반·양중'], color: '#ef4444', minDays: 2 },
  { key: 'win',   name: '샷시·창호·중문',       trades: ['샷시', '창호/문', '중문', '창호·금속공사'], color: '#6366f1', minDays: 1 },
  { key: 'mep',   name: '설비·전기·공조 배관배선', trades: ['기계설비(배관)', '전기', '설비공사', '전기공사', '냉난방공사', '환기·후드공사', '네트워크·통신공사'], color: '#06b6d4', minDays: 3 },
  { key: 'fire',  name: '소방',                 trades: ['소방공사'], color: '#dc2626', minDays: 1 },
  { key: 'frame', name: '조적·미장·단열·방수',  trades: ['조적', '미장', '단열', '방수', '방수공사'], color: '#0ea5e9', minDays: 2 },
  { key: 'tile',  name: '타일·욕실',            trades: ['타일', '타일공사', '욕실공사'], color: '#14b8a6', minDays: 2 },
  { key: 'wood',  name: '목공·천장',            trades: ['목공', '천장'], color: '#f59e0b', minDays: 3 },
  { key: 'paint', name: '필름·도배·도장',       trades: ['필름', '도배/페인트', '도배공사', '도장공사'], color: '#a855f7', minDays: 2 },
  { key: 'floor', name: '바닥재·걸레받이',      trades: ['바닥재', '걸레받이/몰딩', '바닥재공사'], color: '#d97706', minDays: 1 },
  { key: 'inst',  name: '주방·위생·조명·설치',  trades: ['고정설비', '위생도기', '조명', '잡철/하드웨어', '상업주방', '가구·싱크공사'], color: '#ec4899', minDays: 2 },
  { key: 'sign',  name: '간판·사인',            trades: ['간판·파사드공사'], color: '#8b5cf6', minDays: 1 },
  { key: 'clean', name: '준공청소·검수',        trades: ['정리/청소', '준공청소'], color: '#64748b', minDays: 1 },
];

/**
 * 공종별 금액 → 공정표.
 * @param targetDays 목표 총 공사일(작업일). 비용 비중으로 배분, 각 공정 최소일수 보장.
 */
export function buildSchedule(groups: DetailGroup[], targetDays = 30): ScheduleResult {
  const costByTrade = new Map<string, number>();
  for (const g of groups) costByTrade.set(g.trade, g.sum);

  // 비용 있는 공정만
  const active = PHASE_DEFS
    .map((p) => ({ ...p, cost: p.trades.reduce((s, t) => s + (costByTrade.get(t) || 0), 0) }))
    .filter((p) => p.cost > 0);

  const totalCost = active.reduce((s, p) => s + p.cost, 0) || 1;

  // 비용 비중으로 공기 배분 (최소일수 보장), 순차 배치(계단형)
  let cursor = 0;
  const phases: PhaseBar[] = active.map((p) => {
    const byCost = Math.round((p.cost / totalCost) * targetDays);
    const durationDays = Math.max(p.minDays, byCost);
    const bar: PhaseBar = {
      key: p.key, name: p.name, trades: p.trades, cost: p.cost,
      startDay: cursor, durationDays, color: p.color,
    };
    cursor += durationDays;
    return bar;
  });

  return { phases, totalDays: cursor, totalCost };
}
