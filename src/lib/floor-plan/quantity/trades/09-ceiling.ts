// src/lib/floor-plan/quantity/trades/09-ceiling.ts

import type { QuantityItem } from '../types';
import type { RoomSurfaces } from '../surface-calculator';
import { round, applyRate, SURCHARGE_RATES } from '../types';

export function calculateCeilingQty(
  surfaces: RoomSurfaces[]
): QuantityItem[] {
  const items: QuantityItem[] = [];

  const totalCeilArea = surfaces.reduce((s, r) => s + r.ceiling.totalArea, 0);

  // 천장 석고보드
  items.push({
    tradeCode: '09_CEILING', itemCode: '09.GYPSUM',
    itemName: '천장 석고보드',
    specification: '석고보드 9.5T 시공 (경량 철물 틀)',
    unit: 'SQM',
    rawQuantity: round(totalCeilArea),
    surchargeRate: SURCHARGE_RATES.CEILING_GYPSUM,
    finalQuantity: applyRate(totalCeilArea, SURCHARGE_RATES.CEILING_GYPSUM),
    calculationBasis: `전체 천장 ${round(totalCeilArea)}㎡ (우물천장 측면 포함)`,
  });

  // 천장 도장
  items.push({
    tradeCode: '09_CEILING', itemCode: '09.PAINT',
    itemName: '천장 도장',
    specification: '수성 페인트 2회 (프라이머 + 상도)',
    unit: 'SQM',
    rawQuantity: round(totalCeilArea),
    surchargeRate: SURCHARGE_RATES.PAINT,
    finalQuantity: applyRate(totalCeilArea, SURCHARGE_RATES.PAINT),
    calculationBasis: `천장 석고보드 면적과 동일`,
  });

  // 천장 경량틀 (M-bar)
  items.push({
    tradeCode: '09_CEILING', itemCode: '09.FRAME',
    itemName: '천장 경량틀',
    specification: 'M-bar + 행거볼트 (석고보드 하지)',
    unit: 'SQM',
    rawQuantity: round(totalCeilArea),
    surchargeRate: SURCHARGE_RATES.DRYWALL_STUD,
    finalQuantity: applyRate(totalCeilArea, SURCHARGE_RATES.DRYWALL_STUD),
    calculationBasis: `천장 면적과 동일`,
  });

  return items;
}
