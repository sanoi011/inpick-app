// src/lib/floor-plan/quantity/adapter.ts
// ParsedFloorPlan (기존) → FloorPlanProject (QTY 엔진) 변환 어댑터

import type { ParsedFloorPlan, RoomData, WallData } from '@/types/floorplan';
import type { FloorPlanProject, Room, Wall, Opening, Fixture, Polygon2D } from '@/types/floor-plan';

// 좌표 변환: meter → mm
function toMm(meters: number): number {
  return Math.round(meters * 1000);
}

// RoomType → QTY 엔진 타입 매핑
const ROOM_TYPE_MAP: Record<string, string> = {
  LIVING: 'LIVING_ROOM',
  KITCHEN: 'KITCHEN',
  MASTER_BED: 'MASTER_BEDROOM',
  BED: 'BEDROOM',
  BATHROOM: 'BATHROOM',
  ENTRANCE: 'ENTRANCE',
  BALCONY: 'BALCONY',
  UTILITY: 'UTILITY',
  CORRIDOR: 'CORRIDOR',
  DRESSROOM: 'DRESSROOM',
};

// RoomType → 이름 매핑
const ROOM_TYPE_NAMES: Record<string, string> = {
  LIVING: '거실',
  KITCHEN: '주방',
  MASTER_BED: '안방',
  BED: '침실',
  BATHROOM: '욕실',
  ENTRANCE: '현관',
  BALCONY: '발코니',
  UTILITY: '다용도실',
  CORRIDOR: '복도',
  DRESSROOM: '드레스룸',
};

// 습식 공간 판별
const WET_AREA_TYPES = new Set(['BATHROOM']);

// 폴리곤 생성 (polygon이 있으면 변환, 없으면 position에서 사각형 생성)
function toPolygonMm(room: RoomData): Polygon2D {
  if (room.polygon && room.polygon.length >= 3) {
    return room.polygon.map(p => ({ x: toMm(p.x), y: toMm(p.y) }));
  }
  // position 기반 사각형 폴리곤
  const { x, y, width, height } = room.position;
  return [
    { x: toMm(x), y: toMm(y) },
    { x: toMm(x + width), y: toMm(y) },
    { x: toMm(x + width), y: toMm(y + height) },
    { x: toMm(x), y: toMm(y + height) },
  ];
}

// 벽체-공간 인접 판별: 벽체의 중점이 공간 영역 근처인지
function isWallNearRoom(wall: WallData, room: RoomData, thresholdM: number = 0.5): boolean {
  const wallMidX = (wall.start.x + wall.end.x) / 2;
  const wallMidY = (wall.start.y + wall.end.y) / 2;

  // 공간 경계 확장
  const { x, y, width, height } = room.position;
  const expand = thresholdM;

  return (
    wallMidX >= x - expand &&
    wallMidX <= x + width + expand &&
    wallMidY >= y - expand &&
    wallMidY <= y + height + expand
  );
}

// 문/창문 → 벽체 매핑 (가장 가까운 벽체 찾기)
function findNearestWallId(
  position: { x: number; y: number },
  walls: WallData[]
): string {
  let minDist = Infinity;
  let nearestId = walls[0]?.id || '';

  for (const wall of walls) {
    // 벽체 선분의 중점까지 거리
    const mx = (wall.start.x + wall.end.x) / 2;
    const my = (wall.start.y + wall.end.y) / 2;
    const dist = Math.sqrt(
      (position.x - mx) ** 2 + (position.y - my) ** 2
    );
    if (dist < minDist) {
      minDist = dist;
      nearestId = wall.id;
    }
  }

  return nearestId;
}

// 문 타입 매핑
function mapDoorType(type: string): string {
  switch (type) {
    case 'swing': return 'SINGLE_DOOR';
    case 'sliding': return 'SLIDING_DOOR';
    case 'folding': return 'FOLDING_DOOR';
    default: return 'SINGLE_DOOR';
  }
}

// fixture 타입 매핑
function mapFixtureType(type: string): string {
  switch (type) {
    case 'toilet': return 'TOILET';
    case 'sink': return 'BASIN';
    case 'kitchen_sink': return 'KITCHEN_SINK';
    case 'bathtub': return 'BATHTUB';
    case 'stove': return 'GAS_RANGE';
    default: return type.toUpperCase();
  }
}

// fixture 설비 속성 판별
function getFixtureUtilities(type: string): {
  requiresWaterSupply: boolean;
  requiresDrain: boolean;
  requiresGas: boolean;
  requiresElectrical: boolean;
} {
  const waterTypes = new Set(['TOILET', 'BASIN', 'BATHTUB', 'KITCHEN_SINK', 'SHOWER_BOOTH', 'SHOWER_HEAD', 'BIDET', 'BASIN_CABINET']);
  const drainTypes = new Set(['TOILET', 'BASIN', 'BATHTUB', 'KITCHEN_SINK', 'SHOWER_BOOTH', 'BIDET', 'BASIN_CABINET']);
  const gasTypes = new Set(['GAS_RANGE', 'BOILER']);
  const elecTypes = new Set(['INDUCTION', 'RANGE_HOOD', 'AC_INDOOR', 'BOILER']);

  return {
    requiresWaterSupply: waterTypes.has(type),
    requiresDrain: drainTypes.has(type),
    requiresGas: gasTypes.has(type),
    requiresElectrical: elecTypes.has(type),
  };
}

/**
 * ParsedFloorPlan → FloorPlanProject 변환
 * 올수리 가정: constructionStatus = 'DEMOLISH' (기존 항목) / 'NEW' (신규 항목)
 */
export function adaptParsedFloorPlan(
  plan: ParsedFloorPlan,
  projectId: string,
  projectName: string = '인테리어 공사'
): FloorPlanProject {
  const DEFAULT_CEILING_HEIGHT = 2700; // mm
  const DEFAULT_WALL_HEIGHT = 2700; // mm
  const DEFAULT_DOOR_HEIGHT = 2100; // mm
  const DEFAULT_WINDOW_HEIGHT = 1200; // mm
  const DEFAULT_WINDOW_SILL = 900; // mm

  // 1. 벽체 변환
  const walls: Wall[] = plan.walls.map(w => ({
    id: w.id,
    start: { x: toMm(w.start.x), y: toMm(w.start.y) },
    end: { x: toMm(w.end.x), y: toMm(w.end.y) },
    thickness: toMm(w.thickness || 0.2),
    height: DEFAULT_WALL_HEIGHT,
    material: w.isExterior ? 'CONCRETE' as const : 'BLOCK' as const,
    isExterior: w.isExterior,
    wallType: w.wallType || (w.isExterior ? 'exterior' as const : 'interior' as const),
    constructionStatus: 'EXISTING' as const,
  }));

  // 2. 공간 변환
  const rooms: Room[] = plan.rooms.map(r => {
    const roomType = ROOM_TYPE_MAP[r.type] || r.type;
    const isWetArea = WET_AREA_TYPES.has(r.type);

    // 인접 벽체 판별
    const boundaryWallIds = plan.walls
      .filter(w => isWallNearRoom(w, r))
      .map(w => w.id);

    return {
      id: r.id,
      name: r.name || ROOM_TYPE_NAMES[r.type] || r.type,
      type: roomType,
      polygon: toPolygonMm(r),
      holes: r.holes?.map(hole => hole.map(p => ({ x: toMm(p.x), y: toMm(p.y) }))),
      center: r.center ? { x: toMm(r.center.x), y: toMm(r.center.y) } : undefined,
      floorMaterial: r.material,
      ceilingHeight: DEFAULT_CEILING_HEIGHT,
      isWetArea,
      floorLevelOffset: isWetArea ? -50 : 0, // 욕실 50mm 단차
      boundaryWallIds,
      heatingType: 'ONDOL' as const,
      baseboard: {
        height: isWetArea ? 100 : 80,
        material: isWetArea ? 'TILE' : 'PVC',
      },
    };
  });

  // 3. 개구부 (문) 변환
  const doorOpenings: Opening[] = (plan.doors || []).map(d => ({
    id: d.id,
    wallId: findNearestWallId(d.position, plan.walls),
    type: mapDoorType(d.type),
    width: toMm(d.width || 0.9),
    height: DEFAULT_DOOR_HEIGHT,
    sillHeight: 0,
    spec: { kind: 'DOOR' as const },
    constructionStatus: 'NEW' as const, // 올수리 → 문 전부 교체
  }));

  // 4. 개구부 (창문) 변환
  const windowOpenings: Opening[] = (plan.windows || []).map(w => ({
    id: w.id,
    wallId: w.wallId || findNearestWallId(w.position, plan.walls),
    type: 'WINDOW',
    width: toMm(w.width || 1.8),
    height: toMm(w.height || DEFAULT_WINDOW_HEIGHT / 1000),
    sillHeight: DEFAULT_WINDOW_SILL,
    spec: { kind: 'WINDOW' as const },
    constructionStatus: 'EXISTING' as const, // 창문은 기존 유지 (올수리에서도 보통 교체 안 함)
  }));

  // 5. 설비 변환
  const fixtures: Fixture[] = (plan.fixtures || []).map(f => {
    const mappedType = mapFixtureType(f.type);
    const utilities = getFixtureUtilities(mappedType);
    return {
      id: f.id,
      type: mappedType,
      roomId: f.roomId || '',
      boundingBox: {
        x: toMm(f.position.x),
        y: toMm(f.position.y),
        width: toMm(f.position.width),
        height: toMm(f.position.height),
      },
      constructionStatus: 'NEW' as const, // 올수리 → 설비 교체
      ...utilities,
    };
  });

  return {
    id: projectId,
    name: projectName,
    totalArea: plan.totalArea,
    rooms,
    walls,
    openings: [...doorOpenings, ...windowOpenings],
    fixtures,
  };
}
