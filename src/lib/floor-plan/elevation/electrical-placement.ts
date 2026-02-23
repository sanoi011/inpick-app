// src/lib/floor-plan/elevation/electrical-placement.ts
// 한국 주거 전기 배치 규칙 엔진

import type { FloorPlanProject, Room } from '@/types/floor-plan';
import type { ElectricalPlacement, ElectricalType, WallElevation } from '@/types/construction-drawing';

// ─── 한국 주거 전기 표준 ───

interface ElectricalRule {
  type: ElectricalType;
  heightMm: number;
  label: string;
  specification?: string;
}

/** 거실 전기 규칙 */
const LIVING_ROOM_RULES: ElectricalRule[] = [
  { type: 'switch_double', heightMm: 1200, label: '거실 조명 2로 스위치' },
  { type: 'tv_outlet', heightMm: 300, label: 'TV 단자' },
  { type: 'data_outlet', heightMm: 300, label: 'LAN 단자' },
  { type: 'ac_outlet', heightMm: 1800, label: '에어컨 전용 콘센트', specification: '220V 20A 접지' },
];

/** 주방 전기 규칙 */
const KITCHEN_RULES: ElectricalRule[] = [
  { type: 'switch_single', heightMm: 1200, label: '주방 조명 스위치' },
  { type: 'outlet_grounded', heightMm: 1050, label: '상부장 하 콘센트 1', specification: '220V 접지' },
  { type: 'outlet_grounded', heightMm: 1050, label: '상부장 하 콘센트 2', specification: '220V 접지' },
  { type: 'outlet_grounded', heightMm: 1050, label: '상부장 하 콘센트 3', specification: '220V 접지' },
  { type: 'outlet_grounded', heightMm: 1050, label: '상부장 하 콘센트 4', specification: '220V 접지' },
  { type: 'outlet_grounded', heightMm: 2000, label: '냉장고 콘센트', specification: '220V 16A 접지' },
  { type: 'gas_valve', heightMm: 450, label: '가스 밸브' },
  { type: 'exhaust_fan', heightMm: 1600, label: '레인지후드 콘센트' },
];

/** 안방 전기 규칙 */
const MASTER_BEDROOM_RULES: ElectricalRule[] = [
  { type: 'switch_double', heightMm: 1200, label: '안방 조명 스위치' },
  { type: 'ac_outlet', heightMm: 1800, label: '에어컨 전용 콘센트', specification: '220V 20A 접지' },
  { type: 'outlet_double', heightMm: 600, label: '침대 좌측 콘센트' },
  { type: 'outlet_double', heightMm: 600, label: '침대 우측 콘센트' },
];

/** 침실 전기 규칙 */
const BEDROOM_RULES: ElectricalRule[] = [
  { type: 'switch_single', heightMm: 1200, label: '조명 스위치' },
  { type: 'ac_outlet', heightMm: 1800, label: '에어컨 전용 콘센트', specification: '220V 20A 접지' },
  { type: 'outlet_double', heightMm: 300, label: '침대 측 콘센트' },
];

/** 욕실 전기 규칙 */
const BATHROOM_RULES: ElectricalRule[] = [
  { type: 'switch_double', heightMm: 1200, label: '조명+환풍기 스위치' },
  { type: 'outlet_grounded', heightMm: 1200, label: '욕실 콘센트', specification: '220V 접지 방수' },
  { type: 'exhaust_fan', heightMm: 2200, label: '환풍기' },
];

/** 현관 전기 규칙 */
const ENTRANCE_RULES: ElectricalRule[] = [
  { type: 'switch_single', heightMm: 1200, label: '현관 조명 스위치' },
  { type: 'outlet', heightMm: 300, label: '현관 콘센트' },
  { type: 'intercom', heightMm: 1200, label: '인터폰' },
  { type: 'doorbell', heightMm: 1200, label: '초인종' },
];

/** 다용도실 전기 규칙 */
const UTILITY_RULES: ElectricalRule[] = [
  { type: 'switch_single', heightMm: 1200, label: '다용도실 스위치' },
  { type: 'outlet_grounded', heightMm: 300, label: '세탁기 콘센트', specification: '220V 16A 접지' },
  { type: 'outlet_grounded', heightMm: 1200, label: '건조기 콘센트', specification: '220V 16A 접지' },
];

/** 드레스룸 전기 규칙 */
const DRESSROOM_RULES: ElectricalRule[] = [
  { type: 'switch_single', heightMm: 1200, label: '드레스룸 스위치' },
  { type: 'outlet', heightMm: 300, label: '콘센트' },
];

/** 복도 전기 규칙 */
const CORRIDOR_RULES: ElectricalRule[] = [
  { type: 'switch_three_way', heightMm: 1200, label: '복도 3로 스위치' },
];

/** 발코니 전기 규칙 */
const BALCONY_RULES: ElectricalRule[] = [
  { type: 'switch_single', heightMm: 1200, label: '발코니 스위치' },
  { type: 'outlet', heightMm: 300, label: '발코니 콘센트' },
];

// 방 타입 → 전기 규칙 매핑
const ROOM_ELECTRICAL_RULES: Record<string, ElectricalRule[]> = {
  LIVING_ROOM: LIVING_ROOM_RULES,
  KITCHEN: KITCHEN_RULES,
  MASTER_BEDROOM: MASTER_BEDROOM_RULES,
  BEDROOM: BEDROOM_RULES,
  BATHROOM: BATHROOM_RULES,
  ENTRANCE: ENTRANCE_RULES,
  UTILITY: UTILITY_RULES,
  DRESSROOM: DRESSROOM_RULES,
  CORRIDOR: CORRIDOR_RULES,
  BALCONY: BALCONY_RULES,
};

// ─── 벽면 자동 배치 규칙 ───

/**
 * 벽 길이 기준으로 추가 콘센트 수 계산
 * 한국 주거 기준: 벽면 2m당 최소 1개
 */
function calcAdditionalOutlets(wallLengthMm: number, existingOutletCount: number): number {
  const requiredCount = Math.max(1, Math.floor(wallLengthMm / 2000));
  return Math.max(0, requiredCount - existingOutletCount);
}

// ─── 배치 위치 계산 ───

/**
 * 규칙 기반 전기 배치를 벽면에 분배
 *
 * 배치 전략:
 * 1. 스위치: 입구 벽면 (문이 있는 벽)
 * 2. 콘센트: 가장 긴 벽면에 우선 배치
 * 3. 특수 (TV/AC/가스): 해당 설비 근처 벽면
 */
function distributeOnWalls(
  rules: ElectricalRule[],
  wallElevations: WallElevation[],
  _room: Room
): ElectricalPlacement[] {
  if (wallElevations.length === 0) return [];

  const placements: ElectricalPlacement[] = [];
  let idCounter = 0;

  // 문이 있는 벽면 찾기 (스위치 배치용)
  const doorWallIdx = wallElevations.findIndex(
    we => we.openings.some(o => o.type === 'door' || o.type === 'entrance_door' || o.type === 'sliding_door')
  );
  const switchWallIdx = doorWallIdx >= 0 ? doorWallIdx : 0;

  // 가장 긴 벽면 찾기 (메인 콘센트 배치)
  let longestWallIdx = 0;
  let maxLength = 0;
  wallElevations.forEach((we, idx) => {
    if (we.wallLengthMm > maxLength) {
      maxLength = we.wallLengthMm;
      longestWallIdx = idx;
    }
  });

  // 각 규칙을 적절한 벽면에 배치
  for (const rule of rules) {
    let targetWallIdx: number;
    let positionFromLeft: number;

    // 스위치 → 문 옆 벽면
    if (rule.type.startsWith('switch') || rule.type === 'light_switch') {
      targetWallIdx = switchWallIdx;
      const doorWall = wallElevations[switchWallIdx];
      const doorOpening = doorWall.openings.find(
        o => o.type === 'door' || o.type === 'entrance_door' || o.type === 'sliding_door'
      );
      if (doorOpening) {
        // 문 옆 200mm 위치
        positionFromLeft = doorOpening.positionFromLeftMm + doorOpening.widthMm / 2 + 200;
      } else {
        positionFromLeft = 200;
      }
    }
    // TV/데이터 → 가장 긴 벽면
    else if (rule.type === 'tv_outlet' || rule.type === 'data_outlet') {
      targetWallIdx = longestWallIdx;
      positionFromLeft = Math.round(wallElevations[longestWallIdx].wallLengthMm / 2);
    }
    // AC → 긴 벽면 끝부분
    else if (rule.type === 'ac_outlet') {
      targetWallIdx = longestWallIdx;
      positionFromLeft = wallElevations[longestWallIdx].wallLengthMm - 300;
    }
    // 인터폰/초인종 → 스위치 옆
    else if (rule.type === 'intercom' || rule.type === 'doorbell') {
      targetWallIdx = switchWallIdx;
      positionFromLeft = 400;
    }
    // 환풍기 → 첫 번째 벽면
    else if (rule.type === 'exhaust_fan') {
      targetWallIdx = 0;
      positionFromLeft = Math.round(wallElevations[0].wallLengthMm / 2);
    }
    // 가스밸브 → 주방 두 번째 벽면 (싱크대 근처)
    else if (rule.type === 'gas_valve') {
      targetWallIdx = wallElevations.length > 1 ? 1 : 0;
      positionFromLeft = Math.round(wallElevations[targetWallIdx].wallLengthMm * 0.3);
    }
    // 일반 콘센트 → 순환 분배
    else {
      const outletOnlyPlacements = placements.filter(
        p => p.type.startsWith('outlet')
      );
      targetWallIdx = outletOnlyPlacements.length % wallElevations.length;
      const wallLen = wallElevations[targetWallIdx].wallLengthMm;
      const existingOnWall = placements.filter(
        p => p.wallId === wallElevations[targetWallIdx].wallId
      ).length;
      positionFromLeft = Math.round(wallLen * (existingOnWall + 1) / (existingOnWall + 2));
    }

    const targetWall = wallElevations[targetWallIdx];

    placements.push({
      id: `elec-${_room.id}-${idCounter++}`,
      type: rule.type,
      wallId: targetWall.wallId,
      positionFromLeftMm: Math.round(
        Math.max(100, Math.min(targetWall.wallLengthMm - 100, positionFromLeft))
      ),
      heightFromFloorMm: rule.heightMm,
      label: rule.label,
      specification: rule.specification,
    });
  }

  // 추가 콘센트 (벽면 2m당 1개 미달 시)
  for (let wi = 0; wi < wallElevations.length; wi++) {
    const we = wallElevations[wi];
    const existingOutlets = placements.filter(
      p => p.wallId === we.wallId && p.type.startsWith('outlet')
    ).length;
    const additional = calcAdditionalOutlets(we.wallLengthMm, existingOutlets);

    for (let j = 0; j < additional; j++) {
      const spacing = we.wallLengthMm / (additional + existingOutlets + 1);
      placements.push({
        id: `elec-${_room.id}-${idCounter++}`,
        type: 'outlet_double',
        wallId: we.wallId,
        positionFromLeftMm: Math.round(spacing * (existingOutlets + j + 1)),
        heightFromFloorMm: 300,
        label: `벽면 콘센트`,
      });
    }
  }

  // 화재감지기 (모든 방)
  placements.push({
    id: `elec-${_room.id}-${idCounter++}`,
    type: 'fire_detector',
    wallId: wallElevations[0].wallId,
    positionFromLeftMm: Math.round(wallElevations[0].wallLengthMm / 2),
    heightFromFloorMm: 2400,
    label: '화재감지기',
  });

  return placements;
}

// ─── 메인 함수 ───

/**
 * 방별 전기 배치 생성
 *
 * @param project - BIM 프로젝트 데이터 (mm 좌표)
 * @param roomId - 대상 방 ID
 * @param wallElevations - 입면도 벽면 데이터 (elevation-calculator 결과)
 * @returns 전기 배치 목록
 */
export function generateElectricalPlacements(
  project: FloorPlanProject,
  roomId: string,
  wallElevations: WallElevation[]
): ElectricalPlacement[] {
  const room = project.rooms.find(r => r.id === roomId);
  if (!room) return [];

  // 방 타입에 맞는 규칙 선택
  const rules = ROOM_ELECTRICAL_RULES[room.type] || [];
  if (rules.length === 0) return [];

  return distributeOnWalls(rules, wallElevations, room);
}

/**
 * 전체 프로젝트 전기 배치 생성 (평면도 전기배선도용)
 */
export function generateAllElectricalPlacements(
  project: FloorPlanProject,
  elevationDataMap: Map<string, WallElevation[]>
): Map<string, ElectricalPlacement[]> {
  const result = new Map<string, ElectricalPlacement[]>();

  for (const room of project.rooms) {
    const wallElevations = elevationDataMap.get(room.id) || [];
    if (wallElevations.length === 0) continue;

    const placements = generateElectricalPlacements(project, room.id, wallElevations);
    result.set(room.id, placements);
  }

  return result;
}
