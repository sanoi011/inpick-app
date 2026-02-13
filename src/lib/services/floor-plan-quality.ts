/**
 * 도면 품질 평가 서비스
 * ParsedFloorPlan을 분석하여 0~1 품질 점수를 산출
 */
import type { ParsedFloorPlan, WallData, RoomData } from '@/types/floorplan';
import type { QualityDetails } from '@/types/floor-plan-collection';

interface QualityCheckResult {
  score: number;
  details: QualityDetails;
  warnings: string[];
}

/**
 * 벽체 폐합률 평가
 * - 벽 끝점이 다른 벽의 끝점 또는 중간점에 연결되어 있는지 검사
 * - 높을수록 벽이 잘 연결되어 닫힌 공간을 형성
 */
function evaluateWallClosure(walls: WallData[]): number {
  if (walls.length < 3) return 0;

  const tolerance = 0.15; // 15cm
  let connectedEndpoints = 0;
  const totalEndpoints = walls.length * 2;

  for (const wall of walls) {
    const endpoints = [wall.start, wall.end];

    for (const ep of endpoints) {
      // 다른 벽의 끝점과 연결되는지 확인
      const isConnected = walls.some((other) => {
        if (other.id === wall.id) return false;
        const d1 = Math.hypot(ep.x - other.start.x, ep.y - other.start.y);
        const d2 = Math.hypot(ep.x - other.end.x, ep.y - other.end.y);
        return d1 < tolerance || d2 < tolerance;
      });

      if (isConnected) connectedEndpoints++;
    }
  }

  return totalEndpoints > 0 ? connectedEndpoints / totalEndpoints : 0;
}

/**
 * 면적 정확도 평가
 * - 방 면적의 합이 전체 면적과 비교하여 일치하는 정도
 * - 방 면적이 비현실적인 값(0.5m² 미만, 100m² 초과)인지 검사
 */
function evaluateAreaAccuracy(rooms: RoomData[], totalArea: number): number {
  if (rooms.length === 0) return 0;

  const roomAreaSum = rooms.reduce((sum, r) => sum + r.area, 0);

  // 1. 방 면적 합 vs 전체 면적 비교 (50%)
  let areaRatio = 0;
  if (totalArea > 0 && roomAreaSum > 0) {
    const ratio = roomAreaSum / totalArea;
    if (ratio >= 0.8 && ratio <= 1.2) {
      areaRatio = 1 - Math.abs(ratio - 1);
    } else {
      areaRatio = Math.max(0, 0.5 - Math.abs(ratio - 1) * 0.5);
    }
  }

  // 2. 비현실적 방 면적 검사 (30%)
  const validRooms = rooms.filter((r) => r.area >= 0.5 && r.area <= 100);
  const validRoomRatio = rooms.length > 0 ? validRooms.length / rooms.length : 0;

  // 3. 방 크기 분포 합리성 (20%)
  const areas = rooms.map((r) => r.area).sort((a, b) => a - b);
  const median = areas[Math.floor(areas.length / 2)];
  const hasReasonableDistribution =
    median >= 3 && median <= 30 ? 1 : median >= 1 ? 0.5 : 0;

  return areaRatio * 0.5 + validRoomRatio * 0.3 + hasReasonableDistribution * 0.2;
}

/**
 * 방 감지 정확도 평가
 * - 최소 방 수 (1개 이상)
 * - 방 타입 다양성 (거실, 침실, 욕실 등)
 * - 필수 공간 포함 여부 (거실 OR 침실, 욕실, 현관)
 */
function evaluateRoomDetection(rooms: RoomData[]): number {
  if (rooms.length === 0) return 0;

  // 1. 최소 방 수 (30%)
  const roomCountScore = Math.min(rooms.length / 4, 1);

  // 2. 타입 다양성 (30%)
  const uniqueTypes = new Set(rooms.map((r) => r.type));
  const typeScore = Math.min(uniqueTypes.size / 4, 1);

  // 3. 필수 공간 포함 (40%)
  const hasLiving = rooms.some((r) => r.type === 'LIVING' || r.type === 'MASTER_BED');
  const hasBathroom = rooms.some((r) => r.type === 'BATHROOM');
  const hasEntrance = rooms.some((r) => r.type === 'ENTRANCE');
  const hasKitchen = rooms.some((r) => r.type === 'KITCHEN');

  let essentialScore = 0;
  if (hasLiving) essentialScore += 0.35;
  if (hasBathroom) essentialScore += 0.25;
  if (hasEntrance) essentialScore += 0.2;
  if (hasKitchen) essentialScore += 0.2;

  return roomCountScore * 0.3 + typeScore * 0.3 + essentialScore * 0.4;
}

/**
 * 설비 감지 정확도 평가
 * - 욕실에 양변기/세면대
 * - 주방에 싱크/가스레인지
 */
function evaluateFixtureDetection(
  rooms: RoomData[],
  fixtures: { type: string; roomId?: string }[]
): number {
  if (fixtures.length === 0) return rooms.length === 0 ? 0 : 0.2;

  const bathrooms = rooms.filter((r) => r.type === 'BATHROOM');
  const kitchens = rooms.filter((r) => r.type === 'KITCHEN');

  let score = 0;
  let checks = 0;

  // 욕실에 양변기가 있는지
  for (const bath of bathrooms) {
    checks++;
    const hasToilet = fixtures.some(
      (f) => f.type === 'toilet' && f.roomId === bath.id
    );
    if (hasToilet) score++;
  }

  // 주방에 싱크/가스레인지가 있는지
  for (const kitchen of kitchens) {
    checks++;
    const hasSink = fixtures.some(
      (f) =>
        (f.type === 'kitchen_sink' || f.type === 'sink') &&
        f.roomId === kitchen.id
    );
    if (hasSink) score++;
  }

  // 설비 수 대비 기본 점수
  const fixtureCountScore = Math.min(fixtures.length / 5, 1);

  if (checks === 0) return fixtureCountScore;
  return (score / checks) * 0.6 + fixtureCountScore * 0.4;
}

/**
 * 종합 품질 평가
 */
export function evaluateFloorPlanQuality(
  floorPlan: ParsedFloorPlan
): QualityCheckResult {
  const warnings: string[] = [];

  const wallClosure = evaluateWallClosure(floorPlan.walls);
  if (wallClosure < 0.5) warnings.push('벽체 폐합률이 낮습니다 (벽이 잘 연결되지 않음)');

  const areaAccuracy = evaluateAreaAccuracy(floorPlan.rooms, floorPlan.totalArea);
  if (areaAccuracy < 0.5) warnings.push('면적 데이터 정확도가 낮습니다');

  const roomDetection = evaluateRoomDetection(floorPlan.rooms);
  if (roomDetection < 0.5) warnings.push('공간 감지율이 낮습니다');

  const fixtureDetection = evaluateFixtureDetection(
    floorPlan.rooms,
    (floorPlan.fixtures || []).map((f) => ({ type: f.type, roomId: f.roomId }))
  );

  // 가중 평균 (벽폐합 25%, 면적 25%, 방감지 30%, 설비 20%)
  const overallScore =
    wallClosure * 0.25 +
    areaAccuracy * 0.25 +
    roomDetection * 0.3 +
    fixtureDetection * 0.2;

  const details: QualityDetails = {
    wallClosure: Math.round(wallClosure * 100) / 100,
    areaAccuracy: Math.round(areaAccuracy * 100) / 100,
    roomDetection: Math.round(roomDetection * 100) / 100,
    fixtureDetection: Math.round(fixtureDetection * 100) / 100,
    overallScore: Math.round(overallScore * 100) / 100,
  };

  return {
    score: details.overallScore,
    details,
    warnings,
  };
}
