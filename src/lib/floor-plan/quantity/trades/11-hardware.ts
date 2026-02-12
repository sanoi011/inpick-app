// src/lib/floor-plan/quantity/trades/11-hardware.ts

import type { QuantityItem } from '../types';
import type { RoomSurfaces } from '../surface-calculator';
import { round, applyRate } from '../types';

export function calculateHardwareQty(
  surfaces: RoomSurfaces[]
): QuantityItem[] {
  const items: QuantityItem[] = [];

  // 화장실 악세서리 세트
  const wetRooms = surfaces.filter(r => r.wetArea);
  if (wetRooms.length > 0) {
    items.push({
      tradeCode: '11_HARDWARE', itemCode: '11.BATH_ACC',
      itemName: '화장실 악세서리 세트',
      specification: '수건걸이 + 휴지걸이 + 선반 + 거울 (실당 1세트)',
      unit: 'SET',
      rawQuantity: wetRooms.length, surchargeRate: 0,
      finalQuantity: wetRooms.length,
      calculationBasis: `습식 공간 ${wetRooms.length}실`,
    });
  }

  // 실리콘 코킹
  const totalPerimeter = surfaces.reduce((s, r) => s + r.floor.perimeter, 0);
  items.push({
    tradeCode: '11_HARDWARE', itemCode: '11.CAULKING',
    itemName: '실리콘 코킹',
    specification: '바닥/벽 접합부 + 설비 주변',
    unit: 'LM',
    rawQuantity: round(totalPerimeter),
    surchargeRate: 10,
    finalQuantity: applyRate(totalPerimeter, 10),
    calculationBasis: `전체 바닥둘레 합 ${round(totalPerimeter)}m`,
  });

  // 커튼박스 (거실/침실)
  const curtainRooms = surfaces.filter(r =>
    ['LIVING_ROOM', 'BEDROOM', 'MASTER_BEDROOM', 'STUDY'].includes(r.roomType)
  );
  if (curtainRooms.length > 0) {
    const curtainLength = curtainRooms.length * 2.0; // 실당 평균 2m
    items.push({
      tradeCode: '11_HARDWARE', itemCode: '11.CURTAIN_BOX',
      itemName: '커튼박스',
      specification: '석고보드 커튼박스 (창문 상부)',
      unit: 'LM',
      rawQuantity: round(curtainLength),
      surchargeRate: 0,
      finalQuantity: round(curtainLength),
      calculationBasis: `커튼 필요 실 ${curtainRooms.length}개 × 평균 2m`,
    });
  }

  return items;
}
