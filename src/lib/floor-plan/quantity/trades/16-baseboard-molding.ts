// src/lib/floor-plan/quantity/trades/16-baseboard-molding.ts

import type { QuantityItem } from '../types';
import type { RoomSurfaces } from '../surface-calculator';
import { round, applyRate, SURCHARGE_RATES } from '../types';

export function calculateBaseboardMoldingQty(
  surfaces: RoomSurfaces[]
): QuantityItem[] {
  const items: QuantityItem[] = [];

  // 걸레받이 — 건식 공간만 (습식은 타일 걸레받이)
  const dryRooms = surfaces.filter(r => !r.wetArea);
  const totalBB = dryRooms.reduce((s, r) => s + r.baseboard.netLength, 0);

  if (totalBB > 0) {
    items.push({
      tradeCode: '16_BASEBOARD_MOLDING', itemCode: '16.BASEBOARD',
      itemName: '걸레받이',
      specification: 'PVC 또는 목재 걸레받이 (H=80mm)',
      unit: 'LM',
      rawQuantity: round(totalBB),
      surchargeRate: SURCHARGE_RATES.BASEBOARD,
      finalQuantity: applyRate(totalBB, SURCHARGE_RATES.BASEBOARD),
      calculationBasis: `건식 공간 걸레받이 (문 구간 공제 후) ${round(totalBB)}m`,
    });
  }

  // 습식 공간 타일 걸레받이
  const wetRooms = surfaces.filter(r => r.wetArea);
  const totalWetBB = wetRooms.reduce((s, r) => s + r.baseboard.netLength, 0);
  if (totalWetBB > 0) {
    items.push({
      tradeCode: '16_BASEBOARD_MOLDING', itemCode: '16.TILE_BASEBOARD',
      itemName: '타일 걸레받이 (습식)',
      specification: '타일 걸레받이 (H=100mm)',
      unit: 'LM',
      rawQuantity: round(totalWetBB),
      surchargeRate: SURCHARGE_RATES.BASEBOARD,
      finalQuantity: applyRate(totalWetBB, SURCHARGE_RATES.BASEBOARD),
      calculationBasis: `습식 공간 걸레받이 ${round(totalWetBB)}m`,
    });
  }

  // 크라운 몰딩
  const totalMolding = surfaces.reduce((s, r) => s + r.molding.netLength, 0);
  if (totalMolding > 0) {
    items.push({
      tradeCode: '16_BASEBOARD_MOLDING', itemCode: '16.CROWN',
      itemName: '크라운 몰딩',
      specification: '석고 또는 PU 몰딩',
      unit: 'LM',
      rawQuantity: round(totalMolding),
      surchargeRate: SURCHARGE_RATES.MOLDING,
      finalQuantity: applyRate(totalMolding, SURCHARGE_RATES.MOLDING),
      calculationBasis: `전실 천장 둘레 ${round(totalMolding)}m`,
    });
  }

  return items;
}
