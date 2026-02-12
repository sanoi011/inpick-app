// src/lib/floor-plan/quantity/trades/14-electrical.ts

import type { FloorPlanProject } from '@/types/floor-plan';
import type { QuantityItem } from '../types';
import type { RoomSurfaces } from '../surface-calculator';

export function calculateElectricalQty(
  project: FloorPlanProject,
  surfaces: RoomSurfaces[]
): QuantityItem[] {
  const items: QuantityItem[] = [];
  const roomCount = surfaces.length;

  // 조명 포인트 (실당 기본 1~2개소)
  const lightPoints = surfaces.reduce((sum, room) => {
    if (['LIVING_ROOM', 'KITCHEN', 'DINING'].includes(room.roomType)) return sum + 2;
    return sum + 1;
  }, 0);

  items.push({
    tradeCode: '14_ELECTRICAL', itemCode: '14.LIGHT',
    itemName: '조명 포인트',
    specification: '조명 배선 + 스위치',
    unit: 'EA',
    rawQuantity: lightPoints, surchargeRate: 0, finalQuantity: lightPoints,
    calculationBasis: `${roomCount}실 (거실/주방 2pt, 기타 1pt)`,
  });

  // 콘센트 포인트
  const elecFixtures = project.fixtures.filter(f => f.requiresElectrical);
  const outletCount = Math.max(elecFixtures.length, roomCount * 2);

  items.push({
    tradeCode: '14_ELECTRICAL', itemCode: '14.OUTLET',
    itemName: '콘센트 포인트',
    specification: '매립형 콘센트 (2구) + 배선',
    unit: 'EA',
    rawQuantity: outletCount, surchargeRate: 0, finalQuantity: outletCount,
    calculationBasis: `전기설비 ${elecFixtures.length}개 + 일반 (실당 최소 2개)`,
  });

  // 스위치
  items.push({
    tradeCode: '14_ELECTRICAL', itemCode: '14.SWITCH',
    itemName: '스위치',
    specification: '매립형 스위치 (조명 제어)',
    unit: 'EA',
    rawQuantity: roomCount, surchargeRate: 0, finalQuantity: roomCount,
    calculationBasis: `실당 1개 × ${roomCount}실`,
  });

  // 분전반 교체
  items.push({
    tradeCode: '14_ELECTRICAL', itemCode: '14.PANEL',
    itemName: '분전반 교체',
    specification: '분전반 교체 (ELB + 차단기)',
    unit: 'EA',
    rawQuantity: 1, surchargeRate: 0, finalQuantity: 1,
    calculationBasis: '분전반 1면',
  });

  // 인터폰/통신
  items.push({
    tradeCode: '14_ELECTRICAL', itemCode: '14.INTERCOM',
    itemName: '인터폰/통신',
    specification: '인터폰 교체 + 통신 단자',
    unit: 'EA',
    rawQuantity: 1, surchargeRate: 0, finalQuantity: 1,
    calculationBasis: '세대당 1세트',
  });

  return items;
}
