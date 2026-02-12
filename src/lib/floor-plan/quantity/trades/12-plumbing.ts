// src/lib/floor-plan/quantity/trades/12-plumbing.ts

import type { FloorPlanProject } from '@/types/floor-plan';
import type { QuantityItem } from '../types';

export function calculatePlumbingQty(
  project: FloorPlanProject
): QuantityItem[] {
  const items: QuantityItem[] = [];

  // 급수 포인트
  const waterFixtures = project.fixtures.filter(f => f.requiresWaterSupply);
  if (waterFixtures.length > 0) {
    items.push({
      tradeCode: '12_PLUMBING', itemCode: '12.WATER_POINT',
      itemName: '급수 포인트',
      specification: 'PEX 급수관 + 밸브 (냉온수 각 1)',
      unit: 'EA',
      rawQuantity: waterFixtures.length, surchargeRate: 0,
      finalQuantity: waterFixtures.length,
      calculationBasis: `급수 필요 설비 ${waterFixtures.length}개소`,
    });
  }

  // 배수 포인트
  const drainFixtures = project.fixtures.filter(f => f.requiresDrain);
  if (drainFixtures.length > 0) {
    items.push({
      tradeCode: '12_PLUMBING', itemCode: '12.DRAIN_POINT',
      itemName: '배수 포인트',
      specification: 'PVC 배수관 + 트랩',
      unit: 'EA',
      rawQuantity: drainFixtures.length, surchargeRate: 0,
      finalQuantity: drainFixtures.length,
      calculationBasis: `배수 필요 설비 ${drainFixtures.length}개소`,
    });
  }

  // 가스 배관
  const gasFixtures = project.fixtures.filter(f => f.requiresGas);
  if (gasFixtures.length > 0) {
    items.push({
      tradeCode: '12_PLUMBING', itemCode: '12.GAS',
      itemName: '가스 배관',
      specification: '가스 배관 연결 + 밸브',
      unit: 'EA',
      rawQuantity: gasFixtures.length, surchargeRate: 0,
      finalQuantity: gasFixtures.length,
      calculationBasis: `가스 연결 ${gasFixtures.length}개소`,
    });
  }

  // 보일러
  const boilers = project.fixtures.filter(f => f.type === 'BOILER');
  if (boilers.length > 0) {
    items.push({
      tradeCode: '12_PLUMBING', itemCode: '12.BOILER',
      itemName: '보일러 설치/이설',
      specification: '보일러 설치 (제품비 별도)',
      unit: 'EA',
      rawQuantity: boilers.length, surchargeRate: 0,
      finalQuantity: boilers.length,
      calculationBasis: `보일러 ${boilers.length}대`,
    });
  }

  // 난방 배관 (바닥 난방)
  const ondolRooms = project.rooms.filter(r => r.heatingType === 'ONDOL');
  if (ondolRooms.length > 0) {
    items.push({
      tradeCode: '12_PLUMBING', itemCode: '12.ONDOL',
      itemName: '바닥 난방 배관',
      specification: 'XL파이프 바닥 난방 배관 (전실)',
      unit: 'LOT',
      rawQuantity: 1, surchargeRate: 0, finalQuantity: 1,
      calculationBasis: `온돌 난방 ${ondolRooms.length}실`,
    });
  }

  return items;
}
