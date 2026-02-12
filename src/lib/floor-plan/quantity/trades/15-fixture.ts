// src/lib/floor-plan/quantity/trades/15-fixture.ts

import type { FloorPlanProject } from '@/types/floor-plan';
import type { QuantityItem } from '../types';
import { round } from '../types';

export function calculateFixtureQty(
  project: FloorPlanProject
): QuantityItem[] {
  const items: QuantityItem[] = [];

  // 주방 설비 (개소 단위)
  const eaFixtures: Record<string, string> = {
    KITCHEN_SINK: '주방 싱크대', GAS_RANGE: '가스레인지',
    INDUCTION: '인덕션', RANGE_HOOD: '레인지후드',
  };
  for (const [type, name] of Object.entries(eaFixtures)) {
    const found = project.fixtures.filter(f => f.type === type);
    if (found.length === 0) continue;
    items.push({
      tradeCode: '15_FIXTURE', itemCode: `15.${type}`,
      itemName: name,
      specification: `${name} 설치`,
      unit: 'EA',
      rawQuantity: found.length, surchargeRate: 0, finalQuantity: found.length,
      calculationBasis: `${name} ${found.length}개소`,
    });
  }

  // 주방 캐비닛/카운터 (길이 단위)
  const lmFixtures: Record<string, string> = {
    KITCHEN_UPPER_CABINET: '주방 상부장',
    KITCHEN_LOWER_CABINET: '주방 하부장',
    KITCHEN_COUNTER: '주방 상판',
  };
  for (const [type, name] of Object.entries(lmFixtures)) {
    const found = project.fixtures.filter(f => f.type === type);
    if (found.length === 0) continue;
    const totalWidthM = found.reduce((s, f) => s + f.boundingBox.width, 0) / 1000;
    items.push({
      tradeCode: '15_FIXTURE', itemCode: `15.${type}`,
      itemName: name,
      specification: `${name} 제작 + 설치`,
      unit: 'LM',
      rawQuantity: round(totalWidthM), surchargeRate: 0,
      finalQuantity: round(totalWidthM),
      calculationBasis: `총 길이 ${round(totalWidthM)}m`,
    });
  }

  // 수납 (신발장/붙박이장)
  const storageFixtures: Record<string, string> = {
    SHOE_CABINET: '신발장 (빌트인)',
    WARDROBE: '붙박이장',
  };
  for (const [type, name] of Object.entries(storageFixtures)) {
    const found = project.fixtures.filter(f => f.type === type);
    if (found.length === 0) continue;
    const totalWidthM = found.reduce((s, f) => s + f.boundingBox.width, 0) / 1000;
    items.push({
      tradeCode: '15_FIXTURE', itemCode: `15.${type}`,
      itemName: name,
      specification: `${name} 제작 + 설치`,
      unit: 'LM',
      rawQuantity: round(totalWidthM), surchargeRate: 0,
      finalQuantity: round(totalWidthM),
      calculationBasis: `총 폭 ${round(totalWidthM)}m`,
    });
  }

  // 에어컨
  const acUnits = project.fixtures.filter(f => f.type === 'AC_INDOOR');
  if (acUnits.length > 0) {
    items.push({
      tradeCode: '15_FIXTURE', itemCode: '15.AC',
      itemName: '에어컨 설치',
      specification: '에어컨 실내기 설치 (배관 연결, 제품비 별도)',
      unit: 'EA',
      rawQuantity: acUnits.length, surchargeRate: 0,
      finalQuantity: acUnits.length,
      calculationBasis: `에어컨 ${acUnits.length}대`,
    });
  }

  return items;
}
