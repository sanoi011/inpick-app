// src/lib/floor-plan/quantity/trades/16-baseboard-molding.ts

import type { Fixture } from '@/types/floor-plan';
import type { QuantityItem } from '../types';
import type { RoomSurfaces } from '../surface-calculator';
import { round, applyRate, SURCHARGE_RATES } from '../types';

// 걸레받이/천장몰딩 적용 공간 (거실, 주방, 침실, 복도만)
// 제외: 습식(욕실), 발코니, 현관, 드레스룸, 다용도실
const MOLDING_ROOM_TYPES = new Set([
  'LIVING_ROOM', 'KITCHEN',
  'BEDROOM', 'MASTER_BEDROOM',
  'CORRIDOR',
]);

// 주방 싱크대/하부장 — 이 설비가 있는 벽면은 걸레받이 불필요
const KITCHEN_FIXTURE_TYPES = new Set([
  'KITCHEN_SINK', 'KITCHEN_LOWER_CABINET', 'KITCHEN_COUNTER',
]);

/**
 * 주방 싱크대 벽면 공제 길이 (m)
 * 하부장/싱크대 중 가장 긴 폭을 공제 (동일 벽면에 겹치므로 max)
 */
function getKitchenFixtureDeduction(roomId: string, fixtures: Fixture[]): number {
  const kitchenFixtures = fixtures.filter(
    f => f.roomId === roomId && KITCHEN_FIXTURE_TYPES.has(f.type)
  );
  if (kitchenFixtures.length === 0) return 0;
  // 가장 긴 설비의 폭(mm→m)을 공제
  const maxWidthMm = Math.max(...kitchenFixtures.map(f => f.boundingBox.width));
  return maxWidthMm / 1000;
}

export function calculateBaseboardMoldingQty(
  surfaces: RoomSurfaces[],
  fixtures: Fixture[] = []
): QuantityItem[] {
  const items: QuantityItem[] = [];

  // 적용 대상 공간 필터
  const targetRooms = surfaces.filter(r => MOLDING_ROOM_TYPES.has(r.roomType));

  // ─── 1. PVC/MDF 걸레받이 ───
  let totalBB = 0;
  const roomDetails: string[] = [];

  for (const r of targetRooms) {
    let netLen = r.baseboard.netLength;

    // 주방: 싱크대/하부장 벽면 공제
    if (r.roomType === 'KITCHEN') {
      const deduct = getKitchenFixtureDeduction(r.roomId, fixtures);
      if (deduct > 0) {
        netLen = Math.max(0, netLen - deduct);
        roomDetails.push(`${r.roomName} ${round(netLen)}m(싱크대 ${round(deduct)}m 공제)`);
      } else {
        roomDetails.push(`${r.roomName} ${round(netLen)}m`);
      }
    } else {
      roomDetails.push(`${r.roomName} ${round(netLen)}m`);
    }

    totalBB += netLen;
  }

  if (totalBB > 0) {
    items.push({
      tradeCode: '16_BASEBOARD_MOLDING', itemCode: '16.BASEBOARD',
      itemName: '걸레받이',
      specification: 'PVC 또는 MDF필름 걸레받이 (H=80mm)',
      unit: 'LM',
      rawQuantity: round(totalBB),
      surchargeRate: SURCHARGE_RATES.BASEBOARD,
      finalQuantity: applyRate(totalBB, SURCHARGE_RATES.BASEBOARD),
      calculationBasis: `걸레받이: ${roomDetails.join(', ')} = ${round(totalBB)}m`,
    });
  }

  // ─── 2. 천장 몰딩 (같은 공간) ───
  let totalMolding = 0;
  const moldingDetails: string[] = [];

  for (const r of targetRooms) {
    let moldingLen = r.molding.netLength;

    // 주방: 싱크대 벽면 상부는 보통 상부장이 있어 몰딩 불필요 → 같은 길이 공제
    if (r.roomType === 'KITCHEN') {
      const deduct = getKitchenFixtureDeduction(r.roomId, fixtures);
      if (deduct > 0) {
        moldingLen = Math.max(0, moldingLen - deduct);
        moldingDetails.push(`${r.roomName} ${round(moldingLen)}m(상부장 ${round(deduct)}m 공제)`);
      } else {
        moldingDetails.push(`${r.roomName} ${round(moldingLen)}m`);
      }
    } else {
      moldingDetails.push(`${r.roomName} ${round(moldingLen)}m`);
    }

    totalMolding += moldingLen;
  }

  if (totalMolding > 0) {
    items.push({
      tradeCode: '16_BASEBOARD_MOLDING', itemCode: '16.CROWN',
      itemName: '천장 몰딩',
      specification: 'PU 또는 PS 크라운 몰딩',
      unit: 'LM',
      rawQuantity: round(totalMolding),
      surchargeRate: SURCHARGE_RATES.MOLDING,
      finalQuantity: applyRate(totalMolding, SURCHARGE_RATES.MOLDING),
      calculationBasis: `천장몰딩: ${moldingDetails.join(', ')} = ${round(totalMolding)}m`,
    });
  }

  // 습식 공간 — 타일 걸레받이 별도 항목 불필요
  // (타일 벽체가 바닥까지 내려오므로 05_TILE 공종에 포함)

  return items;
}
