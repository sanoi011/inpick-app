// src/lib/floor-plan/quantity/trades/17-cleanup.ts

import type { QuantityItem } from '../types';
import type { RoomSurfaces } from '../surface-calculator';
import { round } from '../types';

export function calculateCleanupQty(
  surfaces: RoomSurfaces[]
): QuantityItem[] {
  const totalFloor = surfaces.reduce((s, r) => s + r.floor.netArea, 0);

  return [
    {
      tradeCode: '17_CLEANUP', itemCode: '17.FINAL_CLEAN',
      itemName: '준공 청소',
      specification: '입주 전 전문 청소 (바닥면적 기준)',
      unit: 'SQM',
      rawQuantity: round(totalFloor), surchargeRate: 0,
      finalQuantity: round(totalFloor),
      calculationBasis: `전체 바닥 ${round(totalFloor)}㎡`,
    },
    {
      tradeCode: '17_CLEANUP', itemCode: '17.PROTECT',
      itemName: '양생 및 보양',
      specification: '시공 중 기존 부위 보양 (현관/엘리베이터 등)',
      unit: 'LOT',
      rawQuantity: 1, surchargeRate: 0, finalQuantity: 1,
      calculationBasis: '일식',
    },
  ];
}
