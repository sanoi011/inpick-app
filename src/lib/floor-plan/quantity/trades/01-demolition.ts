// src/lib/floor-plan/quantity/trades/01-demolition.ts

import type { FloorPlanProject } from '@/types/floor-plan';
import type { QuantityItem, DemolitionScope } from '../types';
import type { RoomSurfaces } from '../surface-calculator';
import { round } from '../types';
import { calcWallLength } from '../geometry';

export function calculateDemolitionQty(
  project: FloorPlanProject,
  surfaces: RoomSurfaces[],
  scope: DemolitionScope
): QuantityItem[] {
  const items: QuantityItem[] = [];

  // 1. 기존 벽지 철거
  if (scope.wallpaper) {
    const area = surfaces.reduce((s, r) => s + r.walls.grossArea, 0);
    items.push({
      tradeCode: '01_DEMOLITION', itemCode: '01.WALLPAPER',
      itemName: '기존 벽지 철거',
      specification: '벽면 벽지 제거 + 잔재 처리',
      unit: 'SQM', rawQuantity: round(area), surchargeRate: 0,
      finalQuantity: round(area),
      calculationBasis: `전체 벽면적 ${round(area)}㎡`,
    });
  }

  // 2. 기존 바닥재 철거
  if (scope.flooring) {
    for (const room of surfaces) {
      items.push({
        tradeCode: '01_DEMOLITION', itemCode: '01.FLOORING',
        itemName: '기존 바닥재 철거',
        specification: room.wetArea ? '타일 철거 (습식)' : '마루/장판 철거',
        unit: 'SQM', rawQuantity: round(room.floor.netArea), surchargeRate: 0,
        finalQuantity: round(room.floor.netArea),
        roomId: room.roomId, roomName: room.roomName,
        calculationBasis: `${room.roomName} ${round(room.floor.netArea)}㎡`,
      });
    }
  }

  // 3. 기존 천장재 철거
  if (scope.ceiling) {
    const area = surfaces.reduce((s, r) => s + r.ceiling.totalArea, 0);
    items.push({
      tradeCode: '01_DEMOLITION', itemCode: '01.CEILING',
      itemName: '기존 천장재 철거',
      specification: '텍스/석고보드 해체 + 잔재 처리',
      unit: 'SQM', rawQuantity: round(area), surchargeRate: 0,
      finalQuantity: round(area),
      calculationBasis: `전체 천장 ${round(area)}㎡`,
    });
  }

  // 4. 기존 벽타일 철거 (습식)
  if (scope.tile) {
    for (const room of surfaces) {
      if (!room.wetArea) continue;
      items.push({
        tradeCode: '01_DEMOLITION', itemCode: '01.WALL_TILE',
        itemName: '기존 벽타일 철거',
        specification: '벽타일 해체 + 잔재 처리',
        unit: 'SQM', rawQuantity: round(room.wetArea.wallTileArea), surchargeRate: 0,
        finalQuantity: round(room.wetArea.wallTileArea),
        roomId: room.roomId, roomName: room.roomName,
        calculationBasis: `${room.roomName} 벽타일 ${round(room.wetArea.wallTileArea)}㎡`,
      });
      items.push({
        tradeCode: '01_DEMOLITION', itemCode: '01.FLOOR_TILE',
        itemName: '기존 바닥타일 철거',
        specification: '바닥타일 해체 + 방수층 포함',
        unit: 'SQM', rawQuantity: round(room.wetArea.floorTileArea), surchargeRate: 0,
        finalQuantity: round(room.wetArea.floorTileArea),
        roomId: room.roomId, roomName: room.roomName,
        calculationBasis: `${room.roomName} 바닥타일 ${round(room.wetArea.floorTileArea)}㎡`,
      });
    }
  }

  // 5. 기존 문/문틀 철거
  if (scope.doors) {
    const demolishDoors = project.openings.filter(
      o => o.constructionStatus === 'DEMOLISH' || scope.allDoors
    );
    if (demolishDoors.length > 0) {
      items.push({
        tradeCode: '01_DEMOLITION', itemCode: '01.DOOR',
        itemName: '기존 문/문틀 철거',
        specification: '문짝 + 문틀 해체',
        unit: 'EA', rawQuantity: demolishDoors.length, surchargeRate: 0,
        finalQuantity: demolishDoors.length,
        calculationBasis: `철거 대상 문 ${demolishDoors.length}개소`,
      });
    }
  }

  // 6. 기존 위생도기 철거
  if (scope.sanitary) {
    const fixtures = project.fixtures.filter(f =>
      ['TOILET', 'BASIN', 'BASIN_CABINET', 'BATHTUB', 'SHOWER_BOOTH'].includes(f.type) &&
      (f.constructionStatus === 'DEMOLISH' || scope.allSanitary)
    );
    if (fixtures.length > 0) {
      items.push({
        tradeCode: '01_DEMOLITION', itemCode: '01.SANITARY',
        itemName: '기존 위생도기 철거',
        specification: '양변기/세면대/욕조 등 해체 + 배관 마감',
        unit: 'EA', rawQuantity: fixtures.length, surchargeRate: 0,
        finalQuantity: fixtures.length,
        calculationBasis: `위생도기 ${fixtures.length}개소`,
      });
    }
  }

  // 7. 기존 경량벽 철거
  if (scope.partitionWalls) {
    const demolishWalls = project.walls.filter(w => w.constructionStatus === 'DEMOLISH');
    for (const wall of demolishWalls) {
      const area = (calcWallLength(wall) / 1000) * (wall.height / 1000);
      items.push({
        tradeCode: '01_DEMOLITION', itemCode: '01.PARTITION',
        itemName: '경량벽 철거',
        specification: `${wall.material} ${wall.thickness}mm`,
        unit: 'SQM', rawQuantity: round(area), surchargeRate: 0,
        finalQuantity: round(area),
        calculationBasis: `길이 ${round(calcWallLength(wall) / 1000)}m × 높이 ${wall.height}mm`,
      });
    }
  }

  // 8. 기존 주방 철거
  if (scope.kitchen) {
    const kitchenFixtures = project.fixtures.filter(f =>
      ['KITCHEN_SINK', 'KITCHEN_UPPER_CABINET', 'KITCHEN_LOWER_CABINET',
        'KITCHEN_COUNTER', 'GAS_RANGE', 'INDUCTION', 'RANGE_HOOD'].includes(f.type)
    );
    if (kitchenFixtures.length > 0) {
      items.push({
        tradeCode: '01_DEMOLITION', itemCode: '01.KITCHEN',
        itemName: '기존 주방 철거',
        specification: '싱크대/상하부장/가스레인지/레인지후드 일체 철거',
        unit: 'LOT', rawQuantity: 1, surchargeRate: 0,
        finalQuantity: 1,
        calculationBasis: `주방 설비 ${kitchenFixtures.length}개 일체 철거`,
      });
    }
  }

  // 9. 폐기물 반출
  const totalDemoSqm = items
    .filter(i => i.unit === 'SQM')
    .reduce((s, i) => s + i.finalQuantity, 0);
  const wasteM3 = round(totalDemoSqm * 0.03, 1);
  const tonBags = Math.ceil(wasteM3 / 2);
  items.push({
    tradeCode: '01_DEMOLITION', itemCode: '01.WASTE',
    itemName: '폐기물 반출 및 처리',
    specification: `폐기물 ${wasteM3}㎥ (${tonBags}톤백)`,
    unit: 'LOT', rawQuantity: 1, surchargeRate: 0, finalQuantity: 1,
    calculationBasis: `철거면적 ${round(totalDemoSqm)}㎡ × 0.03㎥/㎡ = ${wasteM3}㎥`,
  });

  return items;
}
