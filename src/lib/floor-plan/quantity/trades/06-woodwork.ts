// src/lib/floor-plan/quantity/trades/06-woodwork.ts

import type { FloorPlanProject } from '@/types/floor-plan';
import type { QuantityItem } from '../types';
import type { RoomSurfaces } from '../surface-calculator';
import { round, applyRate, SURCHARGE_RATES } from '../types';
import { calcWallLength, calcPolygonPerimeter } from '../geometry';

export function calculateWoodworkQty(
  project: FloorPlanProject,
  surfaces: RoomSurfaces[]
): QuantityItem[] {
  const items: QuantityItem[] = [];

  // 1. 우물천장 목공 틀
  for (const room of surfaces) {
    if (!room.ceiling.hasRecess) continue;
    const roomData = project.rooms.find(r => r.id === room.roomId);
    if (!roomData?.ceilingRecess) continue;

    const perimeterM = calcPolygonPerimeter(roomData.ceilingRecess.polygon) / 1000;
    items.push({
      tradeCode: '06_WOODWORK', itemCode: '06.CEILING_FRAME',
      itemName: '우물천장 목공 틀',
      specification: `경량 철물 틀 + 석고보드 (깊이 ${roomData.ceilingRecess.depth}mm)`,
      unit: 'LM',
      rawQuantity: round(perimeterM),
      surchargeRate: SURCHARGE_RATES.DRYWALL_STUD,
      finalQuantity: applyRate(perimeterM, SURCHARGE_RATES.DRYWALL_STUD),
      roomId: room.roomId, roomName: room.roomName,
      calculationBasis: `우물천장 둘레 ${round(perimeterM)}m`,
    });

    if (roomData.ceilingRecess.hasIndirectLighting) {
      items.push({
        tradeCode: '06_WOODWORK', itemCode: '06.LIGHT_BOX',
        itemName: '간접조명 박스',
        specification: '간접조명용 코브(cove) 시공',
        unit: 'LM',
        rawQuantity: round(perimeterM),
        surchargeRate: SURCHARGE_RATES.WOOD_TRIM,
        finalQuantity: applyRate(perimeterM, SURCHARGE_RATES.WOOD_TRIM),
        roomId: room.roomId, roomName: room.roomName,
        calculationBasis: `간접조명 둘레 = 우물천장 둘레`,
      });
    }
  }

  // 2. 신규 경량벽체 (석고보드)
  const newDrywalls = project.walls.filter(
    w => w.constructionStatus === 'NEW' && w.material === 'DRYWALL'
  );
  for (const wall of newDrywalls) {
    const lengthM = calcWallLength(wall) / 1000;
    const heightM = wall.height / 1000;
    const area = lengthM * heightM * 2; // 양면

    const studLM = lengthM * Math.ceil(heightM / 0.3);
    items.push({
      tradeCode: '06_WOODWORK', itemCode: '06.STUD',
      itemName: '경량 스터드',
      specification: `경량 철물 스터드 (${wall.thickness}mm 벽체)`,
      unit: 'LM',
      rawQuantity: round(studLM),
      surchargeRate: SURCHARGE_RATES.DRYWALL_STUD,
      finalQuantity: applyRate(studLM, SURCHARGE_RATES.DRYWALL_STUD),
      calculationBasis: `벽길이 ${round(lengthM)}m × 스터드 간격 300mm`,
    });

    items.push({
      tradeCode: '06_WOODWORK', itemCode: '06.DRYWALL',
      itemName: '석고보드 (경량벽)',
      specification: '석고보드 9.5T 양면 부착',
      unit: 'SQM',
      rawQuantity: round(area),
      surchargeRate: SURCHARGE_RATES.DRYWALL_BOARD,
      finalQuantity: applyRate(area, SURCHARGE_RATES.DRYWALL_BOARD),
      calculationBasis: `벽체 ${round(lengthM)}m × ${round(heightM)}m × 양면`,
    });
  }

  // 3. 문틀 하지 목공
  const newDoors = project.openings.filter(
    o => o.spec.kind === 'DOOR' && o.constructionStatus === 'NEW'
  );
  if (newDoors.length > 0) {
    items.push({
      tradeCode: '06_WOODWORK', itemCode: '06.DOOR_FRAME_SUB',
      itemName: '문틀 하지 목공',
      specification: '문틀 설치를 위한 하지 합판 + 각재',
      unit: 'EA',
      rawQuantity: newDoors.length,
      surchargeRate: 0,
      finalQuantity: newDoors.length,
      calculationBasis: `신규 문 ${newDoors.length}개소`,
    });
  }

  return items;
}
