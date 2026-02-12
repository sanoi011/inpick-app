// src/lib/floor-plan/quantity/trades/02-masonry.ts

import type { FloorPlanProject } from '@/types/floor-plan';
import type { QuantityItem } from '../types';
import { round, applyRate, SURCHARGE_RATES } from '../types';
import { calcWallLength } from '../geometry';

export function calculateMasonryQty(
  project: FloorPlanProject
): QuantityItem[] {
  const items: QuantityItem[] = [];

  const newBlockWalls = project.walls.filter(
    w => w.constructionStatus === 'NEW' && w.material === 'BLOCK'
  );

  for (const wall of newBlockWalls) {
    const lengthM = calcWallLength(wall) / 1000;
    const heightM = wall.height / 1000;
    const area = lengthM * heightM;
    const rate = SURCHARGE_RATES.MASONRY_BLOCK;

    items.push({
      tradeCode: '02_MASONRY',
      itemCode: '02.BLOCK',
      itemName: `조적 (${wall.thickness}mm)`,
      specification: `시멘트 벽돌 ${wall.thickness <= 100 ? '0.5B' : '1.0B'} 쌓기`,
      unit: 'SQM',
      rawQuantity: round(area),
      surchargeRate: rate,
      finalQuantity: applyRate(area, rate),
      calculationBasis: `길이 ${round(lengthM)}m × 높이 ${round(heightM)}m`,
    });
  }

  // 조적 벽체용 모르타르
  if (newBlockWalls.length > 0) {
    const totalArea = newBlockWalls.reduce((s, w) => {
      return s + (calcWallLength(w) / 1000) * (w.height / 1000);
    }, 0);
    const mortarM3 = totalArea * 0.02;
    items.push({
      tradeCode: '02_MASONRY',
      itemCode: '02.MORTAR',
      itemName: '조적 모르타르',
      specification: '시멘트 모르타르 1:3',
      unit: 'M3',
      rawQuantity: round(mortarM3, 3),
      surchargeRate: SURCHARGE_RATES.MASONRY_MORTAR,
      finalQuantity: applyRate(mortarM3, SURCHARGE_RATES.MASONRY_MORTAR),
      calculationBasis: `조적 면적 ${round(totalArea)}㎡ × 0.02㎥/㎡`,
    });
  }

  return items;
}
