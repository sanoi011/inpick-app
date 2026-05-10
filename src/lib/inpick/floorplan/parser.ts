/**
 * Floorplan parser — Phase 4.
 *
 * 가이드: c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md §7 (도면 구조 파이프라인)
 *
 * 책임:
 *   - propertyId/roomName이 주어지면 RoomGeometry를 어디서 가져올지 결정
 *   - 우선순위: DB 캐시 → 모델 (parsed-floorplan) → heuristic → null
 *   - null이면 호출자가 wallLayout/floorplanImageUrl 기반 fallback 사용
 *
 * 현재 구현 (Phase 4):
 *   - DB 조회는 placeholder (Phase 6/Phase 9에서 활성화)
 *   - heuristic: roomName + widthMm/depthMm로 사각형 RoomGeometry 생성
 *   - 모델 추출은 미구현 (parsed-floorplan-cache.ts와 통합 예정)
 *
 * 다음 단계:
 *   - Phase 6: 이 파서가 반환한 RoomGeometry를 RunPod worker가 2.5D proxy로 변환
 *   - Phase 9: parsed-floorplan-cache.ts와 통합하여 Step1 결과 자동 활용
 */

import type {
  FloorplanGeometry,
  GeometryNormalizeMode,
  Opening,
  Point2D,
  RoomGeometry,
  WallSegment,
} from "./geometry-types";

// ─── 입력 ───
export interface ParseFloorplanInput {
  propertyId?: string;
  roomName: string;
  /** Step1에서 추출된 wallLayout 자연어 (옵션) */
  wallLayout?: string;
  /** 방 치수 (heuristic 생성용) */
  widthMm?: number;
  depthMm?: number;
  /** 도면 이미지 (모델 추출용 — Phase 6+ 사용) */
  floorplanImageUrl?: string;
  /** 도면 이미지 픽셀 크기 */
  imageSize?: { widthPx: number; heightPx: number };
  /** 추가 힌트 (창 개수, 문 위치 등) */
  windows?: number;
  doors?: number;
  windowWalls?: string[]; // ["north", "east"] 등
  doorWalls?: string[];
}

// ─── 출력 ───
export interface ParseFloorplanResult {
  geometry: RoomGeometry | null;
  /** geometry를 못 만들었을 때 호출자가 baseline으로 어떻게 폴백할지 안내 */
  fallback: "wallLayout" | "floorplanImage" | "promptOnly";
  reason?: string;
}

// ─── DB 조회 placeholder ───
/**
 * Phase 6/9에서 generated_floorplans / parsed_floorplans 테이블 조회로 교체.
 * 현재는 항상 null 반환.
 */
async function lookupRoomGeometryInDb(
  propertyId: string,
  roomName: string,
): Promise<RoomGeometry | null> {
  void propertyId;
  void roomName;
  // TODO Phase 6+: Supabase 조회 (generated_floorplans + room polygon JSONB)
  return null;
}

// ─── Heuristic 사각형 룸 생성 ───
/**
 * 방 치수 → 정규화 사각형 RoomGeometry.
 * 기준: 방을 (0,0)~(1,1) 사각형으로 두고, 후단 RunPod proxy가 widthMm/depthMm로 스케일.
 *
 * windowWalls/doorWalls 힌트가 있으면 해당 벽에 개구부 추가.
 * 벽 라벨: north(상), east(우), south(하), west(좌)
 */
export function buildHeuristicRoomGeometry(
  input: ParseFloorplanInput,
): RoomGeometry | null {
  if (!input.widthMm || !input.depthMm) return null;

  const polygon: Point2D[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];

  const walls: WallSegment[] = [
    { id: "wall-north", from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, kind: "exterior" },
    { id: "wall-east", from: { x: 1, y: 0 }, to: { x: 1, y: 1 }, kind: "exterior" },
    { id: "wall-south", from: { x: 1, y: 1 }, to: { x: 0, y: 1 }, kind: "interior" },
    { id: "wall-west", from: { x: 0, y: 1 }, to: { x: 0, y: 0 }, kind: "interior" },
  ];

  const wallByLabel: Record<string, string> = {
    north: "wall-north",
    east: "wall-east",
    south: "wall-south",
    west: "wall-west",
  };

  const openings: Opening[] = [];
  let openingIdx = 0;

  // 창문 힌트 → 벽에 균등 분배
  const windowWalls = input.windowWalls?.length ? input.windowWalls : null;
  const numWindows = input.windows ?? (windowWalls ? windowWalls.length : 0);
  if (windowWalls && numWindows > 0) {
    for (let i = 0; i < numWindows; i++) {
      const label = windowWalls[i % windowWalls.length];
      const wallId = wallByLabel[label.toLowerCase()];
      if (!wallId) continue;
      openings.push({
        id: `opening-${openingIdx++}`,
        type: "window",
        wallId,
        positionRatio: 0.5,
        widthRatio: 0.4,
        sillHeightMm: 900,
        heightMm: 1200,
      });
    }
  }

  // 문 힌트
  const doorWalls = input.doorWalls?.length ? input.doorWalls : null;
  const numDoors = input.doors ?? (doorWalls ? doorWalls.length : 1);
  if (numDoors > 0) {
    const labels = doorWalls && doorWalls.length > 0 ? doorWalls : ["south"];
    for (let i = 0; i < numDoors; i++) {
      const label = labels[i % labels.length];
      const wallId = wallByLabel[label.toLowerCase()];
      if (!wallId) continue;
      openings.push({
        id: `opening-${openingIdx++}`,
        type: "door",
        wallId,
        positionRatio: 0.5,
        widthRatio: 0.2,
        sillHeightMm: 0,
        heightMm: 2100,
      });
    }
  }

  return {
    roomId: `${input.propertyId || "p"}-${input.roomName}`,
    roomName: input.roomName,
    polygon,
    walls,
    openings,
    estimatedAreaM2: (input.widthMm * input.depthMm) / 1_000_000,
    normalizeMode: "ratio" as GeometryNormalizeMode,
    ceilingHeightMm: 2400,
    source: "heuristic",
    metadata: {
      widthMm: input.widthMm,
      depthMm: input.depthMm,
      generatedFrom: "buildHeuristicRoomGeometry",
    },
  };
}

// ─── 메인 진입 ───
/**
 * 입력으로부터 RoomGeometry를 만들거나 fallback 모드를 결정.
 *
 * 우선순위:
 *   1. DB에서 propertyId+roomName 매칭 (Phase 6+)
 *   2. heuristic (widthMm/depthMm로 사각형) — 현재 활성
 *   3. null + fallback 안내
 */
export async function parseRoomGeometry(
  input: ParseFloorplanInput,
): Promise<ParseFloorplanResult> {
  // 1. DB
  if (input.propertyId) {
    const dbGeo = await lookupRoomGeometryInDb(input.propertyId, input.roomName);
    if (dbGeo) {
      return { geometry: dbGeo, fallback: "promptOnly", reason: "db_hit" };
    }
  }

  // 2. heuristic
  if (input.widthMm && input.depthMm) {
    const geo = buildHeuristicRoomGeometry(input);
    if (geo) {
      return {
        geometry: geo,
        fallback: "wallLayout",
        reason: "heuristic_rectangle",
      };
    }
  }

  // 3. fallback
  if (input.wallLayout) {
    return {
      geometry: null,
      fallback: "wallLayout",
      reason: "no_geometry_use_walllayout",
    };
  }
  if (input.floorplanImageUrl) {
    return {
      geometry: null,
      fallback: "floorplanImage",
      reason: "no_geometry_use_floorplan_baseline",
    };
  }
  return {
    geometry: null,
    fallback: "promptOnly",
    reason: "no_geometry_no_floorplan_only_prompt",
  };
}

// ─── 평면도 전체 (placeholder) ───
/**
 * Phase 6+에서 parse-drawing 결과 → FloorplanGeometry 변환 진입점.
 * 현재는 placeholder.
 */
export async function parseFloorplanGeometry(
  propertyId: string,
): Promise<FloorplanGeometry | null> {
  void propertyId;
  return null;
}
