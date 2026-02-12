// src/lib/floor-plan/quantity/types.ts

import type { EntityId } from '@/types/floor-plan';

// ─── 물량산출 단위 ───

export type QtyUnit =
  | 'SQM'    // ㎡ (제곱미터)
  | 'LM'     // m (리니어미터)
  | 'EA'     // 개 (개소)
  | 'SET'    // 세트
  | 'LOT'    // 일식 (Lump Sum)
  | 'M3'     // ㎥ (입방미터)
  | 'KG'     // kg
  | 'ROLL'   // 롤
  | 'CAN'    // 캔
  | 'BAG';   // 포

// ─── 공종 코드 ───

export type TradeCode =
  | '01_DEMOLITION'
  | '02_MASONRY'
  | '03_PLASTER'
  | '04_WATERPROOF'
  | '05_TILE'
  | '06_WOODWORK'
  | '07_FLOORING'
  | '08_WALLPAPER_PAINT'
  | '09_CEILING'
  | '10_DOOR_WINDOW'
  | '11_HARDWARE'
  | '12_PLUMBING'
  | '13_SANITARY'
  | '14_ELECTRICAL'
  | '15_FIXTURE'
  | '16_BASEBOARD_MOLDING'
  | '17_CLEANUP';

export const TRADE_NAMES: Record<TradeCode, string> = {
  '01_DEMOLITION': '철거',
  '02_MASONRY': '조적',
  '03_PLASTER': '미장',
  '04_WATERPROOF': '방수',
  '05_TILE': '타일',
  '06_WOODWORK': '목공',
  '07_FLOORING': '바닥재',
  '08_WALLPAPER_PAINT': '도배/페인트',
  '09_CEILING': '천장',
  '10_DOOR_WINDOW': '창호/문',
  '11_HARDWARE': '잡철/하드웨어',
  '12_PLUMBING': '기계설비(배관)',
  '13_SANITARY': '위생도기',
  '14_ELECTRICAL': '전기',
  '15_FIXTURE': '고정설비',
  '16_BASEBOARD_MOLDING': '걸레받이/몰딩',
  '17_CLEANUP': '정리/청소',
};

// ─── 물량 항목 ───

export interface QuantityItem {
  tradeCode: TradeCode;
  itemCode: string;
  itemName: string;
  specification: string;
  unit: QtyUnit;
  rawQuantity: number;
  surchargeRate: number;
  finalQuantity: number;
  roomId?: EntityId;
  roomName?: string;
  calculationBasis: string;
}

// ─── 철거 범위 설정 ───

export interface DemolitionScope {
  wallpaper: boolean;
  flooring: boolean;
  ceiling: boolean;
  tile: boolean;
  doors: boolean;
  allDoors: boolean;
  sanitary: boolean;
  allSanitary: boolean;
  partitionWalls: boolean;
  kitchen: boolean;
}

// ─── 할증률 테이블 (시공기술사 경험치 기준) ───

export const SURCHARGE_RATES: Record<string, number> = {
  // 조적/미장
  MASONRY_BLOCK: 5,
  MASONRY_MORTAR: 10,
  PLASTER_MORTAR: 10,

  // 방수
  WATERPROOF_MEMBRANE: 10,
  WATERPROOF_LIQUID: 15,

  // 타일
  TILE_STRAIGHT: 5,
  TILE_DIAGONAL: 10,
  TILE_HERRINGBONE: 15,
  TILE_LARGE_FORMAT: 8,
  TILE_MOSAIC: 3,
  TILE_ADHESIVE: 10,
  TILE_GROUT: 15,

  // 목공
  DRYWALL_BOARD: 5,
  DRYWALL_STUD: 3,
  WOOD_TRIM: 8,

  // 바닥재
  FLOORING_WOOD: 5,
  FLOORING_LAMINATE: 5,
  FLOORING_VINYL: 10,
  FLOORING_TILE: 5,

  // 도배/페인트
  WALLPAPER: 10,
  PAINT: 10,
  PAINT_PRIMER: 5,

  // 천장
  CEILING_GYPSUM: 5,
  CEILING_TEX: 10,

  // 걸레받이/몰딩
  BASEBOARD: 5,
  MOLDING: 5,

  // 배관/전기
  PIPE: 10,
  FITTING: 5,
  CABLE: 10,
  CONDUIT: 5,
};

// ─── 유틸리티 ───

export function round(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function applyRate(raw: number, rate: number): number {
  return round(raw * (1 + rate / 100));
}

export function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
