// src/lib/floor-plan/elevation/elevation-calculator.ts
// 입면전개도 계산 엔진 — 방별 벽면 전개 데이터 산출

import type { FloorPlanProject, Room, Wall, Opening, Fixture, Point2D } from '@/types/floor-plan';
import type { WallElevation, ElevationOpening, ElevationFixture, ElevationMaterial, ElevationData } from '@/types/construction-drawing';
import { calcWallLength, calcCentroid } from '../quantity/geometry';

// ─── 유틸리티 ───

/** 두 점 사이 거리 */
function distance(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** 벡터 각도 (라디안, 0 = 오른쪽, 반시계방향 양수) */
function vectorAngle(from: Point2D, to: Point2D): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** 점에서 선분까지 투영 위치 (0~1 사이의 비율) */
function projectPointOnSegment(
  point: Point2D,
  segStart: Point2D,
  segEnd: Point2D
): number {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;
  const t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
  return Math.max(0, Math.min(1, t));
}

/** 점에서 선분까지의 최단 거리 */
function pointToSegmentDistance(point: Point2D, segStart: Point2D, segEnd: Point2D): number {
  const t = projectPointOnSegment(point, segStart, segEnd);
  const projX = segStart.x + t * (segEnd.x - segStart.x);
  const projY = segStart.y + t * (segEnd.y - segStart.y);
  return distance(point, { x: projX, y: projY });
}

// ─── 벽 → 방 매핑 ───

/** 방의 boundaryWallIds에서 벽을 가져와서 시계방향 정렬 */
function getOrderedWallsForRoom(
  room: Room,
  allWalls: Wall[]
): Wall[] {
  const roomWalls = allWalls.filter(w => room.boundaryWallIds.includes(w.id));
  if (roomWalls.length <= 1) return roomWalls;

  const center = room.center
    ? { x: room.center.x, y: room.center.y }
    : calcCentroid(room.polygon);

  // 각 벽의 중심점 기준으로 방 중심에서의 각도 계산 후 시계방향 정렬
  const wallsWithAngle = roomWalls.map(wall => {
    const wallMid: Point2D = {
      x: (wall.start.x + wall.end.x) / 2,
      y: (wall.start.y + wall.end.y) / 2,
    };
    const angle = vectorAngle(center, wallMid);
    return { wall, angle };
  });

  // 시계방향 정렬 (y 축 아래가 양수인 좌표계 → 반시계 = 시계)
  wallsWithAngle.sort((a, b) => a.angle - b.angle);

  return wallsWithAngle.map(wa => wa.wall);
}

// ─── 개구부 위치 계산 ───

/** 벽면 시작점으로부터의 개구부 중심 위치 (mm) */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function calcOpeningPositionOnWall(
  opening: Opening,
  wall: Wall,
  allWalls: Wall[],
  doors: { position: Point2D; width: number; type: string }[]
): { positionFromLeftMm: number; widthMm: number } | null {
  // Opening은 wallId로 벽에 매핑되어 있음
  // 위치 정보가 없으므로 동일 wallId의 문/창문 원본 데이터에서 위치 추정

  // 문의 경우: connectedRooms로 벽을 공유하는 문 찾기
  // 기본적으로 벽면을 균등 분할 배치
  const wallLength = calcWallLength(wall);

  // 같은 벽에 있는 개구부 목록
  const sameWallOpenings = doors.filter(d => {
    // 문/창문 위치가 이 벽 근처인지 확인
    return pointToSegmentDistance(d.position, wall.start, wall.end) < wall.thickness + 200;
  });

  // 해당 opening의 문/창문 원본 찾기
  const matchedDoor = sameWallOpenings.find(d =>
    Math.abs(d.width - opening.width) < 100 && d.type === opening.type
  );

  if (matchedDoor) {
    const t = projectPointOnSegment(matchedDoor.position, wall.start, wall.end);
    return {
      positionFromLeftMm: Math.round(t * wallLength),
      widthMm: opening.width,
    };
  }

  // 매칭 실패 시 벽면 중앙 배치
  return {
    positionFromLeftMm: Math.round(wallLength / 2),
    widthMm: opening.width,
  };
}

// ─── 개구부 → 입면도 변환 ───

function openingToElevation(
  opening: Opening,
  positionFromLeftMm: number
): ElevationOpening {
  let type: ElevationOpening['type'] = 'door';
  if (opening.spec.kind === 'WINDOW') {
    type = 'window';
  } else if (opening.type.includes('SLIDING')) {
    type = 'sliding_door';
  } else if (opening.type.includes('ENTRANCE')) {
    type = 'entrance_door';
  }

  return {
    type,
    positionFromLeftMm,
    widthMm: opening.width,
    heightMm: opening.height,
    sillHeightMm: opening.sillHeight,
    label: type === 'window'
      ? `창문 ${opening.width}×${opening.height}`
      : `문 ${opening.width}×${opening.height}`,
  };
}

// ─── 설비 → 벽면 배정 ───

interface FixtureOnWall {
  fixture: Fixture;
  positionFromLeftMm: number;
  heightFromFloorMm: number;
}

/** 방의 설비를 가장 가까운 벽면에 배정 */
function assignFixturesToWalls(
  fixtures: Fixture[],
  walls: Wall[]
): Map<string, FixtureOnWall[]> {
  const wallFixtures = new Map<string, FixtureOnWall[]>();
  for (const wall of walls) {
    wallFixtures.set(wall.id, []);
  }

  for (const fixture of fixtures) {
    const fixtureCenter: Point2D = {
      x: fixture.boundingBox.x + fixture.boundingBox.width / 2,
      y: fixture.boundingBox.y + fixture.boundingBox.height / 2,
    };

    let nearestWallId = walls[0]?.id;
    let nearestDist = Infinity;
    let nearestT = 0.5;

    for (const wall of walls) {
      const dist = pointToSegmentDistance(fixtureCenter, wall.start, wall.end);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestWallId = wall.id;
        nearestT = projectPointOnSegment(fixtureCenter, wall.start, wall.end);
      }
    }

    if (nearestWallId) {
      const wall = walls.find(w => w.id === nearestWallId);
      if (wall) {
        const wallLength = calcWallLength(wall);
        const arr = wallFixtures.get(nearestWallId) || [];
        arr.push({
          fixture,
          positionFromLeftMm: Math.round(nearestT * wallLength),
          heightFromFloorMm: getFixtureElevationHeight(fixture.type),
        });
        wallFixtures.set(nearestWallId, arr);
      }
    }
  }

  return wallFixtures;
}

/** 설비 타입별 입면도 높이 (바닥에서 하단까지, mm) */
function getFixtureElevationHeight(type: string): number {
  switch (type) {
    case 'TOILET': return 0;
    case 'BASIN':
    case 'BASIN_CABINET': return 800;
    case 'BATHTUB': return 0;
    case 'SHOWER_BOOTH': return 0;
    case 'KITCHEN_SINK': return 850;
    case 'GAS_RANGE':
    case 'INDUCTION': return 850;
    case 'RANGE_HOOD': return 1600;
    case 'KITCHEN_UPPER_CABINET': return 1500;
    case 'KITCHEN_LOWER_CABINET': return 0;
    case 'KITCHEN_COUNTER': return 0;
    case 'SHOE_CABINET': return 0;
    case 'WARDROBE': return 0;
    case 'AC_INDOOR': return 2100;
    default: return 0;
  }
}

/** 설비 타입별 입면도 크기 (mm) */
function getFixtureElevationSize(type: string): { widthMm: number; heightMm: number } {
  switch (type) {
    case 'TOILET': return { widthMm: 400, heightMm: 700 };
    case 'BASIN':
    case 'BASIN_CABINET': return { widthMm: 600, heightMm: 500 };
    case 'BATHTUB': return { widthMm: 1500, heightMm: 500 };
    case 'SHOWER_BOOTH': return { widthMm: 900, heightMm: 2100 };
    case 'KITCHEN_SINK': return { widthMm: 800, heightMm: 200 };
    case 'GAS_RANGE':
    case 'INDUCTION': return { widthMm: 600, heightMm: 100 };
    case 'RANGE_HOOD': return { widthMm: 600, heightMm: 400 };
    case 'KITCHEN_UPPER_CABINET': return { widthMm: 2400, heightMm: 700 };
    case 'KITCHEN_LOWER_CABINET': return { widthMm: 2400, heightMm: 850 };
    case 'KITCHEN_COUNTER': return { widthMm: 2400, heightMm: 50 };
    case 'SHOE_CABINET': return { widthMm: 1200, heightMm: 1200 };
    case 'WARDROBE': return { widthMm: 1800, heightMm: 2200 };
    case 'AC_INDOOR': return { widthMm: 900, heightMm: 300 };
    default: return { widthMm: 500, heightMm: 500 };
  }
}

/** 설비 타입 한글 라벨 */
function getFixtureLabel(type: string): string {
  const labels: Record<string, string> = {
    TOILET: '양변기',
    BASIN: '세면대',
    BASIN_CABINET: '세면대',
    BATHTUB: '욕조',
    SHOWER_BOOTH: '샤워부스',
    KITCHEN_SINK: '싱크대',
    GAS_RANGE: '가스레인지',
    INDUCTION: '인덕션',
    RANGE_HOOD: '레인지후드',
    KITCHEN_UPPER_CABINET: '상부장',
    KITCHEN_LOWER_CABINET: '하부장',
    KITCHEN_COUNTER: '카운터',
    SHOE_CABINET: '신발장',
    WARDROBE: '붙박이장',
    AC_INDOOR: '에어컨',
    BOILER: '보일러',
  };
  return labels[type] || type;
}

// ─── 메인 함수 ───

/**
 * 방별 벽면 전개(입면도) 데이터 계산
 *
 * 1. room.boundaryWallIds로 해당 방의 벽체 목록 추출
 * 2. 각 벽체: calcWallLength → wallLengthMm, room.ceilingHeight → wallHeightMm
 * 3. project.openings에서 wallId 매칭 → 벽면 상의 위치 계산
 * 4. project.fixtures에서 roomId 매칭 → 가장 가까운 벽에 배정
 * 5. 벽체를 방 중심 기준 시계방향 정렬 → A/B/C/D 라벨 부여
 */
export function calculateRoomElevations(
  project: FloorPlanProject,
  roomId: string,
  materials?: { roomId: string; area: string; name: string; specification?: string }[]
): ElevationData {
  const room = project.rooms.find(r => r.id === roomId);
  if (!room) {
    throw new Error(`Room not found: ${roomId}`);
  }

  // 1. 벽체 시계방향 정렬
  const orderedWalls = getOrderedWallsForRoom(room, project.walls);

  // 2. 방에 속하는 설비
  const roomFixtures = project.fixtures.filter(f => f.roomId === roomId);

  // 3. 설비 → 벽면 배정
  const fixturesByWall = assignFixturesToWalls(roomFixtures, orderedWalls);

  // 4. 벽에 속하는 개구부
  const wallOpenings = new Map<string, Opening[]>();
  for (const wall of orderedWalls) {
    wallOpenings.set(
      wall.id,
      project.openings.filter(o => o.wallId === wall.id)
    );
  }

  // 5. 입면도 데이터 생성
  const WALL_LABELS: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
  const elevations: WallElevation[] = [];

  // 최대 4면 (A/B/C/D)
  const maxWalls = Math.min(orderedWalls.length, 4);

  for (let i = 0; i < maxWalls; i++) {
    const wall = orderedWalls[i];
    const wallLength = calcWallLength(wall);
    const label = WALL_LABELS[i];

    // 개구부 변환
    const openings = (wallOpenings.get(wall.id) || []).map(opening => {
      // 벽면 상 위치 추정
      const openingsOnWall = wallOpenings.get(wall.id) || [];
      const idx = openingsOnWall.indexOf(opening);
      const count = openingsOnWall.length;
      // 균등 분배
      const positionFromLeftMm = Math.round(
        wallLength * (idx + 1) / (count + 1)
      );
      return openingToElevation(opening, positionFromLeftMm);
    });

    // 설비 변환
    const fixtures: ElevationFixture[] = (fixturesByWall.get(wall.id) || []).map(fw => {
      const size = getFixtureElevationSize(fw.fixture.type);
      return {
        type: fw.fixture.type,
        positionFromLeftMm: fw.positionFromLeftMm,
        heightFromFloorMm: fw.heightFromFloorMm,
        widthMm: size.widthMm,
        heightMm: size.heightMm,
        label: getFixtureLabel(fw.fixture.type),
      };
    });

    // 자재 정보
    const elevMaterials: ElevationMaterial[] = [];
    if (materials) {
      const roomMats = materials.filter(m => m.roomId === roomId);
      for (const mat of roomMats) {
        elevMaterials.push({
          area: mat.area as 'floor' | 'wall' | 'ceiling',
          name: mat.name,
          specification: mat.specification,
        });
      }
    }

    elevations.push({
      wallId: wall.id,
      wallLabel: label,
      wallLengthMm: Math.round(wallLength),
      wallHeightMm: room.ceilingHeight,
      openings,
      fixtures,
      materials: elevMaterials,
      electricalPlacements: [], // electrical-placement.ts에서 생성
    });
  }

  // 방 타입 한글 이름
  const roomTypeNames: Record<string, string> = {
    LIVING_ROOM: '거실',
    KITCHEN: '주방',
    MASTER_BEDROOM: '안방',
    BEDROOM: '침실',
    BATHROOM: '욕실',
    ENTRANCE: '현관',
    BALCONY: '발코니',
    UTILITY: '다용도실',
    CORRIDOR: '복도',
    DRESSROOM: '드레스룸',
  };

  return {
    roomId: room.id,
    roomName: room.name || roomTypeNames[room.type] || room.type,
    roomType: room.type,
    elevations,
  };
}

/**
 * 전체 프로젝트의 주요 방들에 대해 입면도 계산
 * (거실, 주방, 안방, 욕실만 기본 대상)
 */
export function calculateAllElevations(
  project: FloorPlanProject,
  materials?: { roomId: string; area: string; name: string; specification?: string }[]
): ElevationData[] {
  const targetTypes = new Set([
    'LIVING_ROOM', 'KITCHEN', 'MASTER_BEDROOM', 'BATHROOM', 'BEDROOM',
  ]);

  return project.rooms
    .filter(room => targetTypes.has(room.type))
    .map(room => {
      try {
        return calculateRoomElevations(project, room.id, materials);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as ElevationData[];
}
