// src/lib/floor-plan/quantity/trades/04-waterproof.ts

import type { QuantityItem } from '../types';
import type { RoomSurfaces } from '../surface-calculator';
import { round, applyRate, SURCHARGE_RATES } from '../types';

export function calculateWaterproofQty(
  surfaces: RoomSurfaces[]
): QuantityItem[] {
  const items: QuantityItem[] = [];
  const rate = SURCHARGE_RATES.WATERPROOF_LIQUID;

  for (const room of surfaces) {
    if (!room.wetArea) continue;

    // 바닥 방수
    items.push({
      tradeCode: '04_WATERPROOF', itemCode: '04.FLOOR',
      itemName: '바닥 방수',
      specification: '우레탄 방수 2회 도포 (1차+2차)',
      unit: 'SQM',
      rawQuantity: round(room.wetArea.floorWaterproofArea),
      surchargeRate: rate,
      finalQuantity: applyRate(room.wetArea.floorWaterproofArea, rate),
      roomId: room.roomId, roomName: room.roomName,
      calculationBasis: `${room.roomName} 바닥 ${round(room.wetArea.floorWaterproofArea)}㎡`,
    });

    // 벽체 방수 (바닥+1800mm)
    items.push({
      tradeCode: '04_WATERPROOF', itemCode: '04.WALL',
      itemName: '벽체 방수',
      specification: '우레탄 방수 바닥면+1800mm',
      unit: 'SQM',
      rawQuantity: round(room.wetArea.wallWaterproofArea),
      surchargeRate: rate,
      finalQuantity: applyRate(room.wetArea.wallWaterproofArea, rate),
      roomId: room.roomId, roomName: room.roomName,
      calculationBasis: `${room.roomName} 벽둘레 × 1.8m`,
    });

    // 턱(단차) 방수
    if (room.wetArea.curbArea > 0) {
      items.push({
        tradeCode: '04_WATERPROOF', itemCode: '04.CURB',
        itemName: '턱 방수',
        specification: '바닥 단차 부위 방수',
        unit: 'SQM',
        rawQuantity: round(room.wetArea.curbArea),
        surchargeRate: rate,
        finalQuantity: applyRate(room.wetArea.curbArea, rate),
        roomId: room.roomId, roomName: room.roomName,
        calculationBasis: `${room.roomName} 턱 ${round(room.wetArea.curbArea)}㎡`,
      });
    }
  }

  return items;
}
