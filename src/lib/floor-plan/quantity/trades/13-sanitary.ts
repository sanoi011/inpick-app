// src/lib/floor-plan/quantity/trades/13-sanitary.ts

import type { FloorPlanProject } from '@/types/floor-plan';
import type { QuantityItem } from '../types';

const SANITARY_NAMES: Record<string, string> = {
  TOILET: '양변기', BIDET: '비데', BASIN: '세면대',
  BASIN_CABINET: '세면대(하부장)', BATHTUB: '욕조',
  SHOWER_BOOTH: '샤워부스', SHOWER_HEAD: '샤워기(벽부착)',
};

export function calculateSanitaryQty(
  project: FloorPlanProject
): QuantityItem[] {
  const items: QuantityItem[] = [];

  for (const [type, name] of Object.entries(SANITARY_NAMES)) {
    const fixtures = project.fixtures.filter(
      f => f.type === type && f.constructionStatus !== 'EXISTING'
    );
    if (fixtures.length === 0) continue;

    items.push({
      tradeCode: '13_SANITARY', itemCode: `13.${type}`,
      itemName: name,
      specification: `${name} 설치 (제품 + 설치비)`,
      unit: 'EA',
      rawQuantity: fixtures.length, surchargeRate: 0,
      finalQuantity: fixtures.length,
      calculationBasis: `${name} ${fixtures.length}개소`,
    });
  }

  return items;
}
