/**
 * Enhanced Fusion: Gemini + floorplan-ai + PyMuPDF 3소스 융합 엔진
 *
 * 융합 전략:
 * - 방(rooms): Gemini 우선 (시맨틱 정확)
 * - 벽(walls): floorplan-ai 우선 (기하학 정밀)
 * - 문/창/설비: 합집합 (중복 제거)
 * - 치수(dimensions): floorplan-ai 우선 (OCR 특화)
 */
import type {
  ParsedFloorPlan,
  DoorData,
  WindowData,
  FixtureData,
  DimensionData,
} from '@/types/floorplan';
import type { VectorHints } from './pymupdf-extractor';

const DEDUP_DISTANCE_M = 0.5; // 0.5m 이내면 동일 객체

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * 문 중복 제거 후 합집합
 */
function mergeDoors(primary: DoorData[], secondary: DoorData[]): DoorData[] {
  const merged = [...primary];
  let idx = merged.length;

  for (const sd of secondary) {
    const isDuplicate = merged.some(
      pd => distance(pd.position, sd.position) < DEDUP_DISTANCE_M
    );
    if (!isDuplicate) {
      merged.push({ ...sd, id: `door-${idx++}` });
    }
  }
  return merged;
}

/**
 * 창문 중복 제거 후 합집합
 */
function mergeWindows(primary: WindowData[], secondary: WindowData[]): WindowData[] {
  const merged = [...primary];
  let idx = merged.length;

  for (const sw of secondary) {
    const isDuplicate = merged.some(
      pw => distance(pw.position, sw.position) < DEDUP_DISTANCE_M
    );
    if (!isDuplicate) {
      merged.push({ ...sw, id: `win-${idx++}` });
    }
  }
  return merged;
}

/**
 * 설비 중복 제거 후 합집합
 */
function mergeFixtures(primary: FixtureData[], secondary: FixtureData[]): FixtureData[] {
  const merged = [...primary];
  let idx = merged.length;

  const getCenter = (f: FixtureData) => ({
    x: f.position.x + f.position.width / 2,
    y: f.position.y + f.position.height / 2,
  });

  for (const sf of secondary) {
    const sc = getCenter(sf);
    const isDuplicate = merged.some(pf => distance(getCenter(pf), sc) < DEDUP_DISTANCE_M);
    if (!isDuplicate) {
      merged.push({ ...sf, id: `fix-${idx++}` });
    }
  }
  return merged;
}

/**
 * 치수 중복 제거 후 합집합
 */
function mergeDimensions(
  primary: DimensionData[],
  secondary: DimensionData[]
): DimensionData[] {
  const merged = [...primary];
  let idx = merged.length;

  for (const sd of secondary) {
    // 같은 값 + 가까운 위치면 중복
    const isDuplicate = merged.some(
      pd =>
        pd.valueMm === sd.valueMm &&
        distance(pd.startPoint, sd.startPoint) < 1.0
    );
    if (!isDuplicate) {
      merged.push({ ...sd, id: `dim-${idx++}` });
    }
  }
  return merged;
}

export interface EnhancedFusionResult {
  floorPlan: ParsedFloorPlan;
  sources: {
    rooms: 'gemini' | 'ai_pipeline' | 'fused';
    walls: 'gemini' | 'ai_pipeline' | 'fused';
    doors: 'fused';
    windows: 'fused';
    fixtures: 'fused';
  };
  stats: {
    geminiRooms: number;
    aiRooms: number;
    geminiWalls: number;
    aiWalls: number;
    totalDoors: number;
    totalWindows: number;
    totalFixtures: number;
  };
}

/**
 * 3소스 융합: Gemini (시맨틱) + floorplan-ai (기하학) + PyMuPDF (벡터 힌트)
 *
 * Gemini만 있으면 기존과 동일.
 * floorplan-ai만 있으면 변환 결과 그대로.
 * 둘 다 있으면 전략적 융합.
 */
export function enhancedFuse(
  geminiPlan: ParsedFloorPlan,
  aiPlan: ParsedFloorPlan | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _vectorHints?: VectorHints | null,
): EnhancedFusionResult {
  // floorplan-ai 결과가 없으면 Gemini 결과만 사용
  if (!aiPlan) {
    return {
      floorPlan: geminiPlan,
      sources: {
        rooms: 'gemini',
        walls: 'gemini',
        doors: 'fused',
        windows: 'fused',
        fixtures: 'fused',
      },
      stats: {
        geminiRooms: geminiPlan.rooms.length,
        aiRooms: 0,
        geminiWalls: geminiPlan.walls.length,
        aiWalls: 0,
        totalDoors: geminiPlan.doors.length,
        totalWindows: geminiPlan.windows.length,
        totalFixtures: (geminiPlan.fixtures || []).length,
      },
    };
  }

  // Gemini 결과가 빈약하면 (방 0개) aiPlan 그대로 사용
  if (geminiPlan.rooms.length === 0 && aiPlan.rooms.length > 0) {
    return {
      floorPlan: aiPlan,
      sources: {
        rooms: 'ai_pipeline',
        walls: 'ai_pipeline',
        doors: 'fused',
        windows: 'fused',
        fixtures: 'fused',
      },
      stats: {
        geminiRooms: 0,
        aiRooms: aiPlan.rooms.length,
        geminiWalls: 0,
        aiWalls: aiPlan.walls.length,
        totalDoors: aiPlan.doors.length,
        totalWindows: aiPlan.windows.length,
        totalFixtures: (aiPlan.fixtures || []).length,
      },
    };
  }

  // --- 양쪽 모두 있는 경우: 전략적 융합 ---

  // 방: Gemini 우선 (시맨틱: 방 이름, 타입, 폴리곤 추출 정확)
  const rooms = geminiPlan.rooms;

  // 벽: floorplan-ai 우선 (기하학: Hough Transform 정밀)
  // 단, aiPlan 벽이 0개면 Gemini 사용
  const walls = aiPlan.walls.length > 0 ? aiPlan.walls : geminiPlan.walls;
  const wallSource = aiPlan.walls.length > 0 ? 'ai_pipeline' as const : 'gemini' as const;

  // 문: 합집합 (Gemini 우선, ai 보충)
  const doors = mergeDoors(geminiPlan.doors, aiPlan.doors);

  // 창: 합집합
  const windows = mergeWindows(geminiPlan.windows, aiPlan.windows);

  // 설비: 합집합
  const fixtures = mergeFixtures(
    geminiPlan.fixtures || [],
    aiPlan.fixtures || [],
  );

  // 치수: floorplan-ai 우선 (OCR 특화), Gemini 보충
  const dimensions = mergeDimensions(
    aiPlan.dimensions || [],
    geminiPlan.dimensions || [],
  );

  const fused: ParsedFloorPlan = {
    totalArea: geminiPlan.totalArea, // Gemini의 calibrated area 사용
    rooms,
    walls,
    doors,
    windows,
    fixtures,
    dimensions,
  };

  return {
    floorPlan: fused,
    sources: {
      rooms: 'gemini',
      walls: wallSource,
      doors: 'fused',
      windows: 'fused',
      fixtures: 'fused',
    },
    stats: {
      geminiRooms: geminiPlan.rooms.length,
      aiRooms: aiPlan.rooms.length,
      geminiWalls: geminiPlan.walls.length,
      aiWalls: aiPlan.walls.length,
      totalDoors: doors.length,
      totalWindows: windows.length,
      totalFixtures: fixtures.length,
    },
  };
}
