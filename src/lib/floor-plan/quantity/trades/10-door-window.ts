// src/lib/floor-plan/quantity/trades/10-door-window.ts

import type { FloorPlanProject } from '@/types/floor-plan';
import type { QuantityItem } from '../types';
import { groupBy } from '../types';

const DOOR_TYPE_NAMES: Record<string, string> = {
  SINGLE_DOOR: '외여닫이문', DOUBLE_DOOR: '양여닫이문',
  SLIDING_DOOR: '미닫이문', POCKET_DOOR: '포켓도어',
  FOLDING_DOOR: '폴딩도어', ENTRANCE_DOOR: '현관문',
  FIRE_DOOR: '방화문',
};

const WINDOW_TYPE_NAMES: Record<string, string> = {
  WINDOW: '일반 창문', SLIDING_WINDOW: '미닫이 창문',
  FIXED_WINDOW: '고정 창문', BALCONY_WINDOW: '발코니 창호',
  BALCONY_DOOR: '발코니 출입문',
};

export function calculateDoorWindowQty(
  project: FloorPlanProject
): QuantityItem[] {
  const items: QuantityItem[] = [];

  // 문
  const newDoors = project.openings.filter(o =>
    o.spec.kind === 'DOOR' &&
    (o.constructionStatus === 'NEW' || !o.constructionStatus)
  );

  const doorGroups = groupBy(newDoors, d => `${d.type}_${d.width}x${d.height}`);
  for (const [key, doors] of Object.entries(doorGroups)) {
    const sample = doors[0];
    const typeName = DOOR_TYPE_NAMES[sample.type] || sample.type;
    items.push({
      tradeCode: '10_DOOR_WINDOW', itemCode: `10.DOOR_${key}`,
      itemName: `${typeName} (${sample.width}×${sample.height})`,
      specification: '문틀 + 문짝 + 하드웨어 세트',
      unit: 'SET',
      rawQuantity: doors.length, surchargeRate: 0, finalQuantity: doors.length,
      calculationBasis: `${typeName} ${doors.length}개소`,
    });
  }

  // 창호 (신규 교체분만)
  const newWindows = project.openings.filter(o =>
    o.spec.kind === 'WINDOW' && o.constructionStatus === 'NEW'
  );

  const winGroups = groupBy(newWindows, w => `${w.type}_${w.width}x${w.height}`);
  for (const [key, wins] of Object.entries(winGroups)) {
    const sample = wins[0];
    const typeName = WINDOW_TYPE_NAMES[sample.type] || sample.type;
    items.push({
      tradeCode: '10_DOOR_WINDOW', itemCode: `10.WIN_${key}`,
      itemName: `${typeName} (${sample.width}×${sample.height})`,
      specification: '프레임 + 유리 + 시공',
      unit: 'SET',
      rawQuantity: wins.length, surchargeRate: 0, finalQuantity: wins.length,
      calculationBasis: `${typeName} ${wins.length}개소`,
    });
  }

  return items;
}
