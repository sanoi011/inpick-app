// src/lib/floor-plan/quantity/trades/05-tile.ts

import type { QuantityItem } from '../types';
import type { RoomSurfaces } from '../surface-calculator';
import { round, applyRate, SURCHARGE_RATES } from '../types';

export function calculateTileQty(
  surfaces: RoomSurfaces[]
): QuantityItem[] {
  const items: QuantityItem[] = [];
  const tileRate = SURCHARGE_RATES.TILE_STRAIGHT;

  for (const room of surfaces) {
    if (!room.wetArea) continue;

    // 바닥 타일
    items.push({
      tradeCode: '05_TILE', itemCode: '05.FLOOR',
      itemName: '바닥 타일',
      specification: '포세린타일 300×300 (논슬립) + 접착제 + 줄눈',
      unit: 'SQM',
      rawQuantity: round(room.wetArea.floorTileArea),
      surchargeRate: tileRate,
      finalQuantity: applyRate(room.wetArea.floorTileArea, tileRate),
      roomId: room.roomId, roomName: room.roomName,
      calculationBasis: `${room.roomName} 바닥 ${round(room.wetArea.floorTileArea)}㎡ × 할증 ${tileRate}%`,
    });

    // 벽 타일
    items.push({
      tradeCode: '05_TILE', itemCode: '05.WALL',
      itemName: '벽 타일',
      specification: `포세린타일 300×600 + 접착제 + 줄눈 (H=${room.wetArea.wallTileHeight}mm)`,
      unit: 'SQM',
      rawQuantity: round(room.wetArea.wallTileArea),
      surchargeRate: tileRate,
      finalQuantity: applyRate(room.wetArea.wallTileArea, tileRate),
      roomId: room.roomId, roomName: room.roomName,
      calculationBasis: `${room.roomName} 벽타일 ${round(room.wetArea.wallTileArea)}㎡ (전타일)`,
    });

    // 타일 접착제 (약 5kg/㎡)
    const totalTile = room.wetArea.floorTileArea + room.wetArea.wallTileArea;
    const adhesiveKg = totalTile * 5;
    items.push({
      tradeCode: '05_TILE', itemCode: '05.ADHESIVE',
      itemName: '타일 접착제',
      specification: '플렉스 타일 접착제 (약 5kg/㎡)',
      unit: 'KG',
      rawQuantity: round(adhesiveKg, 1),
      surchargeRate: SURCHARGE_RATES.TILE_ADHESIVE,
      finalQuantity: applyRate(adhesiveKg, SURCHARGE_RATES.TILE_ADHESIVE),
      roomId: room.roomId, roomName: room.roomName,
      calculationBasis: `타일면적 ${round(totalTile)}㎡ × 5kg/㎡`,
    });

    // 줄눈재 (약 0.5kg/㎡)
    const groutKg = totalTile * 0.5;
    items.push({
      tradeCode: '05_TILE', itemCode: '05.GROUT',
      itemName: '줄눈재',
      specification: '에폭시 줄눈재',
      unit: 'KG',
      rawQuantity: round(groutKg, 1),
      surchargeRate: SURCHARGE_RATES.TILE_GROUT,
      finalQuantity: applyRate(groutKg, SURCHARGE_RATES.TILE_GROUT),
      roomId: room.roomId, roomName: room.roomName,
      calculationBasis: `타일면적 × 0.5kg/㎡`,
    });
  }

  return items;
}
