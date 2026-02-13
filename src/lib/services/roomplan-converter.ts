/**
 * Apple RoomPlan JSON → InPick ParsedFloorPlan 변환기
 */
import type { ParsedFloorPlan, RoomData, WallData, DoorData, WindowData, FixtureData, RoomType } from '@/types/floorplan';
import type { RoomPlanCapturedRoom, ScannedFurniture } from '@/types/roomplan';

/** 4x4 transform에서 position 추출 (column-major) */
function extractPosition(transform: number[]): { x: number; y: number; z: number } {
  // RoomPlan 4x4 행렬은 column-major: [m00,m10,m20,m30, m01,m11,m21,m31, m02,..., m03,m13,m23,m33]
  // position = [m03, m13, m23] = transform[12], transform[13], transform[14]
  return {
    x: transform[12] || 0,
    y: transform[13] || 0, // height
    z: transform[14] || 0,
  };
}

/** 4x4 transform에서 Y축 회전(yaw) 추출 (degrees) */
function extractRotationY(transform: number[]): number {
  // m00 = cos(theta), m02 = sin(theta) for Y-axis rotation
  const m00 = transform[0] || 1;
  const m02 = transform[8] || 0;
  return Math.atan2(m02, m00) * (180 / Math.PI);
}

/** RoomPlan 오브젝트 카테고리 → fixture type 매핑 */
function mapObjectToFixture(category: string): string | null {
  const map: Record<string, string | null> = {
    'toilet': 'toilet',
    'sink': 'sink',
    'bathtub': 'bathtub',
    'washer': 'toilet',    // 근사치
    'stove': 'stove',
    'oven': 'stove',
    'dishwasher': 'kitchen_sink',
    'refrigerator': null,  // 가구로 분류
    'sofa': null,
    'chair': null,
    'table': null,
    'bed': null,
    'storage': null,
    'television': null,
  };
  return map[category.toLowerCase()] ?? null;
}

/** 바닥 폴리곤으로부터 방 이름 추정 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function guessRoomType(area: number, floorIndex: number, totalFloors: number): { type: RoomType; name: string } {
  if (area > 15) return { type: 'LIVING', name: '거실' };
  if (area > 8) return { type: 'BED', name: `침실${floorIndex > 0 ? floorIndex : ''}` };
  if (area > 5) return { type: 'KITCHEN', name: '주방' };
  if (area > 3) return { type: 'BATHROOM', name: '욕실' };
  if (area > 2) return { type: 'ENTRANCE', name: '현관' };
  return { type: 'UTILITY', name: '다용도실' };
}

/** 폴리곤 면적 계산 (Shoelace formula) */
function polygonArea(corners: { x: number; z: number }[]): number {
  let area = 0;
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += corners[i].x * corners[j].z;
    area -= corners[j].x * corners[i].z;
  }
  return Math.abs(area) / 2;
}

/** 점에서 가장 가까운 벽 찾기 */
function findNearestWall(pos: { x: number; y: number }, walls: WallData[]): string {
  let minDist = Infinity;
  let nearestId = '';
  for (const wall of walls) {
    const mx = (wall.start.x + wall.end.x) / 2;
    const my = (wall.start.y + wall.end.y) / 2;
    const dist = Math.hypot(pos.x - mx, pos.y - my);
    if (dist < minDist) {
      minDist = dist;
      nearestId = wall.id;
    }
  }
  return nearestId;
}

/** 점이 어느 방 안에 있는지 찾기 */
function findContainingRoom(pos: { x: number; y: number }, rooms: RoomData[]): string {
  for (const room of rooms) {
    if (room.polygon && room.polygon.length > 2) {
      if (pointInPolygon(pos, room.polygon)) return room.id;
    } else {
      const p = room.position;
      if (pos.x >= p.x && pos.x <= p.x + p.width && pos.y >= p.y && pos.y <= p.y + p.height) {
        return room.id;
      }
    }
  }
  return rooms[0]?.id || '';
}

function pointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > point.y) !== (yj > point.y) && point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Apple RoomPlan CapturedRoom → InPick ParsedFloorPlan 변환
 */
export function convertRoomPlanToFloorPlan(
  captured: RoomPlanCapturedRoom
): { floorPlan: ParsedFloorPlan; furniture: ScannedFurniture[] } {
  // 1. Walls 변환 (RoomPlan XZ 평면 → InPick XY 평면)
  const walls: WallData[] = captured.walls.map((w, i) => {
    const pos = extractPosition(w.transform);
    const rot = extractRotationY(w.transform) * (Math.PI / 180);
    const halfLen = (w.dimensions.x || 1) / 2; // width = 벽 길이
    const thickness = w.dimensions.z || 0.12;   // depth = 두께

    return {
      id: `wall-${i}`,
      start: {
        x: pos.x - halfLen * Math.cos(rot),
        y: pos.z - halfLen * Math.sin(rot),  // RoomPlan Z → InPick Y
      },
      end: {
        x: pos.x + halfLen * Math.cos(rot),
        y: pos.z + halfLen * Math.sin(rot),
      },
      thickness,
      isExterior: false, // RoomPlan에서는 구분 불가 → 후처리 필요
    };
  });

  // 2. Rooms 변환 (floors → 방)
  let bedCount = 0;
  const rooms: RoomData[] = captured.floors.map((floor, i) => {
    const corners = floor.polygonCorners;
    const polygon = corners.map(c => ({ x: c.x, y: c.z }));
    const area = polygonArea(corners);
    const { type, name } = guessRoomType(area, i, captured.floors.length);

    if (type === 'BED') bedCount++;

    // bounding box
    const xs = polygon.map(p => p.x);
    const ys = polygon.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);

    return {
      id: `room-${i}`,
      type,
      name: type === 'BED' ? `침실${bedCount}` : name,
      area: Math.round(area * 100) / 100,
      position: {
        x: minX,
        y: minY,
        width: Math.max(...xs) - minX,
        height: Math.max(...ys) - minY,
      },
      polygon,
    };
  });

  // 가장 큰 침실 → 안방
  const beds = rooms.filter(r => r.type === 'BED');
  if (beds.length > 0) {
    const largest = beds.reduce((a, b) => a.area > b.area ? a : b);
    largest.type = 'MASTER_BED';
    largest.name = '안방';
  }

  // 3. Doors 변환
  const doors: DoorData[] = captured.doors.map((d, i) => {
    const pos = extractPosition(d.transform);
    const rotation = extractRotationY(d.transform);
    const doorType = d.attributes?.includes('sliding') ? 'sliding' as const
      : d.attributes?.includes('double') ? 'swing' as const
      : 'swing' as const;

    return {
      id: `door-${i}`,
      position: { x: pos.x, y: pos.z },
      width: d.dimensions.x || 0.9,
      rotation,
      type: doorType,
      connectedRooms: ['', ''] as [string, string],
    };
  });

  // 4. Windows 변환
  const windows: WindowData[] = captured.windows.map((w, i) => {
    const pos = extractPosition(w.transform);
    const rotation = extractRotationY(w.transform);

    return {
      id: `win-${i}`,
      position: { x: pos.x, y: pos.z },
      width: w.dimensions.x || 1.0,
      height: w.dimensions.y || 1.2,
      rotation,
      wallId: findNearestWall({ x: pos.x, y: pos.z }, walls),
    };
  });

  // 5. Fixtures + Furniture 분류
  const fixtures: FixtureData[] = [];
  const furniture: ScannedFurniture[] = [];

  captured.objects.forEach((obj, i) => {
    const pos = extractPosition(obj.transform);
    const fixtureType = mapObjectToFixture(obj.category);

    if (fixtureType) {
      fixtures.push({
        id: `fix-${i}`,
        type: fixtureType as FixtureData['type'],
        position: {
          x: pos.x - (obj.dimensions.x || 0.5) / 2,
          y: pos.z - (obj.dimensions.z || 0.5) / 2,
          width: obj.dimensions.x || 0.5,
          height: obj.dimensions.z || 0.5,
        },
        roomId: findContainingRoom({ x: pos.x, y: pos.z }, rooms),
      });
    } else {
      furniture.push({
        id: `furn-${i}`,
        category: obj.category,
        roomId: findContainingRoom({ x: pos.x, y: pos.z }, rooms),
        position: { x: pos.x, y: pos.z },
        dimensions: {
          width: obj.dimensions.x || 0.5,
          depth: obj.dimensions.z || 0.5,
          height: obj.dimensions.y || 0.5,
        },
        keepOrReplace: 'undecided',
      });
    }
  });

  // 총 면적 계산
  const totalArea = rooms.reduce((sum, r) => sum + r.area, 0);

  const floorPlan: ParsedFloorPlan = {
    totalArea: Math.round(totalArea * 100) / 100,
    rooms,
    walls,
    doors,
    windows,
    fixtures,
  };

  return { floorPlan, furniture };
}
