// src/lib/floor-plan/quantity/trades/08-wallpaper-paint.ts

import type { FloorPlanProject } from '@/types/floor-plan';
import type { QuantityItem } from '../types';
import type { RoomSurfaces } from '../surface-calculator';
import { round, applyRate, SURCHARGE_RATES } from '../types';

export function calculateWallpaperPaintQty(
  project: FloorPlanProject,
  surfaces: RoomSurfaces[]
): QuantityItem[] {
  const items: QuantityItem[] = [];

  for (const room of surfaces) {
    if (room.wetArea) continue; // 습식 공간은 타일

    const wallNetArea = room.walls.netArea;
    const jambArea = room.openingJambs.totalArea;
    const totalArea = wallNetArea + jambArea;

    const roomData = project.rooms.find(r => r.id === room.roomId);
    const wallFinishId = roomData?.wallFinishId;
    const finish = wallFinishId
      ? (project.finishSpecs || []).find(f => f.id === wallFinishId)
      : null;

    const isPaint = finish?.category === 'PAINT';

    if (!isPaint) {
      // 벽지 시공
      items.push({
        tradeCode: '08_WALLPAPER_PAINT', itemCode: '08.WALLPAPER',
        itemName: '벽지 시공',
        specification: '실크 벽지 (합지) — 벽면 + 개구부 잼',
        unit: 'SQM',
        rawQuantity: round(totalArea),
        surchargeRate: SURCHARGE_RATES.WALLPAPER,
        finalQuantity: applyRate(totalArea, SURCHARGE_RATES.WALLPAPER),
        roomId: room.roomId, roomName: room.roomName,
        calculationBasis: `${room.roomName}: 벽면 ${round(wallNetArea)}㎡ + 잼 ${round(jambArea)}㎡ = ${round(totalArea)}㎡`,
      });

      // 초배지 (벽지 하지)
      items.push({
        tradeCode: '08_WALLPAPER_PAINT', itemCode: '08.PRIMER_PAPER',
        itemName: '초배지',
        specification: '초배지 바르기 (벽지 하지)',
        unit: 'SQM',
        rawQuantity: round(totalArea),
        surchargeRate: SURCHARGE_RATES.PAINT_PRIMER,
        finalQuantity: applyRate(totalArea, SURCHARGE_RATES.PAINT_PRIMER),
        roomId: room.roomId, roomName: room.roomName,
        calculationBasis: `벽지 면적과 동일`,
      });
    } else {
      // 페인트 시공
      items.push({
        tradeCode: '08_WALLPAPER_PAINT', itemCode: '08.PAINT',
        itemName: '벽면 페인트',
        specification: '수성 페인트 2회 도장 (프라이머 + 상도 2회)',
        unit: 'SQM',
        rawQuantity: round(totalArea),
        surchargeRate: SURCHARGE_RATES.PAINT,
        finalQuantity: applyRate(totalArea, SURCHARGE_RATES.PAINT),
        roomId: room.roomId, roomName: room.roomName,
        calculationBasis: `${room.roomName}: 벽면 ${round(wallNetArea)}㎡ + 잼 ${round(jambArea)}㎡`,
      });

      // 프라이머
      items.push({
        tradeCode: '08_WALLPAPER_PAINT', itemCode: '08.PRIMER',
        itemName: '프라이머',
        specification: '수성 프라이머 1회 도장',
        unit: 'SQM',
        rawQuantity: round(totalArea),
        surchargeRate: SURCHARGE_RATES.PAINT_PRIMER,
        finalQuantity: applyRate(totalArea, SURCHARGE_RATES.PAINT_PRIMER),
        roomId: room.roomId, roomName: room.roomName,
        calculationBasis: `페인트 면적과 동일`,
      });
    }
  }

  return items;
}
