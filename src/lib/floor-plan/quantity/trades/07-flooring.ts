// src/lib/floor-plan/quantity/trades/07-flooring.ts

import type { FloorPlanProject } from '@/types/floor-plan';
import type { QuantityItem } from '../types';
import type { RoomSurfaces } from '../surface-calculator';
import { round, applyRate, SURCHARGE_RATES } from '../types';

export function calculateFlooringQty(
  project: FloorPlanProject,
  surfaces: RoomSurfaces[]
): QuantityItem[] {
  const items: QuantityItem[] = [];

  for (const room of surfaces) {
    if (room.wetArea) continue; // 습식 공간은 타일에서 처리

    const roomData = project.rooms.find(r => r.id === room.roomId);
    const finishId = roomData?.floorFinishId;
    const finish = finishId
      ? (project.finishSpecs || []).find(f => f.id === finishId)
      : null;

    const finishName = finish?.name || '강마루';
    const category = finish?.category || 'LAMINATE_FLOORING';

    let rate = SURCHARGE_RATES.FLOORING_LAMINATE;
    if (category === 'WOOD_FLOORING') rate = SURCHARGE_RATES.FLOORING_WOOD;
    if (category === 'VINYL_FLOORING') rate = SURCHARGE_RATES.FLOORING_VINYL;
    if (category.includes('TILE')) rate = SURCHARGE_RATES.FLOORING_TILE;

    // 바닥재 본체
    items.push({
      tradeCode: '07_FLOORING', itemCode: '07.MAIN',
      itemName: `바닥재 (${finishName})`,
      specification: `${finishName} 시공`,
      unit: 'SQM',
      rawQuantity: round(room.floor.netArea),
      surchargeRate: rate,
      finalQuantity: applyRate(room.floor.netArea, rate),
      roomId: room.roomId, roomName: room.roomName,
      calculationBasis: `${room.roomName} 순면적 ${round(room.floor.netArea)}㎡`,
    });

    // 바닥 밑작업 (방음매트 + 합판)
    items.push({
      tradeCode: '07_FLOORING', itemCode: '07.UNDERLAY',
      itemName: '바닥 하지 작업',
      specification: '방음매트 + 합판 깔기',
      unit: 'SQM',
      rawQuantity: round(room.floor.netArea),
      surchargeRate: 3,
      finalQuantity: applyRate(room.floor.netArea, 3),
      roomId: room.roomId, roomName: room.roomName,
      calculationBasis: `${room.roomName} 바닥 면적과 동일`,
    });
  }

  return items;
}
