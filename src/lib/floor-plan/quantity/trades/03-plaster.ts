// src/lib/floor-plan/quantity/trades/03-plaster.ts

import type { FloorPlanProject } from '@/types/floor-plan';
import type { QuantityItem } from '../types';
import type { RoomSurfaces } from '../surface-calculator';
import { round, applyRate, SURCHARGE_RATES } from '../types';
import { calcWallLength } from '../geometry';

export function calculatePlasterQty(
  project: FloorPlanProject,
  surfaces: RoomSurfaces[]
): QuantityItem[] {
  const items: QuantityItem[] = [];
  const rate = SURCHARGE_RATES.PLASTER_MORTAR;

  // 신규 조적벽 양면 미장
  const plasterWalls = project.walls.filter(
    w => w.constructionStatus === 'NEW' && w.material === 'BLOCK'
  );

  let totalPlasterArea = 0;
  for (const wall of plasterWalls) {
    const area = (calcWallLength(wall) / 1000) * (wall.height / 1000) * 2; // 양면
    totalPlasterArea += area;
  }

  if (totalPlasterArea > 0) {
    items.push({
      tradeCode: '03_PLASTER', itemCode: '03.WALL',
      itemName: '벽체 미장',
      specification: '시멘트 모르타르 미장 t=15mm (양면)',
      unit: 'SQM', rawQuantity: round(totalPlasterArea), surchargeRate: rate,
      finalQuantity: applyRate(totalPlasterArea, rate),
      calculationBasis: `신규 조적벽 양면 미장 ${round(totalPlasterArea)}㎡`,
    });
  }

  // 습식 공간 바닥 미장 (방수 전 평탄화)
  for (const room of surfaces) {
    if (!room.wetArea) continue;
    items.push({
      tradeCode: '03_PLASTER', itemCode: '03.FLOOR_WET',
      itemName: '바닥 미장 (습식)',
      specification: '시멘트 모르타르 바닥 미장 t=30mm (기울기 포함)',
      unit: 'SQM', rawQuantity: round(room.floor.netArea), surchargeRate: rate,
      finalQuantity: applyRate(room.floor.netArea, rate),
      roomId: room.roomId, roomName: room.roomName,
      calculationBasis: `${room.roomName} 바닥 ${round(room.floor.netArea)}㎡`,
    });
  }

  return items;
}
