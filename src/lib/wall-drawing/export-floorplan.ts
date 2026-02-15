/**
 * Wall Drawing Export - DrawingState → ParsedFloorPlan 변환
 *
 * 손도면 그리기 도구의 결과를 기존 뷰어/물량산출 파이프라인에 연결
 */

import type { DrawingState, DrawnWall, DetectedRoom } from "@/types/wall-drawing";
import type {
  ParsedFloorPlan,
  RoomData,
  WallData,
  DoorData,
  WindowData,
  RoomType,
  WallType,
} from "@/types/floorplan";
import { wallAngle, wallNormal, interpolateOnSegment } from "./geometry";

// ─── 면적 정규화 ─────────────────────────────────────

/**
 * 모든 좌표를 스케일 조정하여 목표 면적에 맞춤
 * linearScale = √(targetArea / currentArea)
 */
function normalizeCoordinates(
  state: DrawingState,
  targetArea: number
): DrawingState {
  const currentArea = state.rooms.reduce((sum, r) => sum + r.area, 0);
  if (currentArea < 0.1) return state; // 방이 없으면 패스

  const ratio = targetArea / currentArea;
  if (Math.abs(ratio - 1) < 0.05) return state; // 5% 이내면 보정 불필요

  const linearScale = Math.sqrt(ratio);

  return {
    ...state,
    walls: state.walls.map((w) => ({
      ...w,
      start: { x: w.start.x * linearScale, y: w.start.y * linearScale },
      end: { x: w.end.x * linearScale, y: w.end.y * linearScale },
      openings: w.openings.map((o) => ({
        ...o,
        width: o.width * linearScale,
      })),
    })),
    rooms: state.rooms.map((r) => ({
      ...r,
      polygon: r.polygon.map((p) => ({
        x: p.x * linearScale,
        y: p.y * linearScale,
      })),
      area: r.area * ratio,
    })),
  };
}

// ─── 벽 변환 ─────────────────────────────────────────

function convertWalls(walls: DrawnWall[]): WallData[] {
  return walls.map((w, i) => {
    const normal = wallNormal(w);
    const halfT = w.thickness / 2;

    // 벽 폴리곤 (4점, 법선 방향으로 두께 확장)
    const polygon = [
      { x: w.start.x + normal.x * halfT, y: w.start.y + normal.y * halfT },
      { x: w.end.x + normal.x * halfT, y: w.end.y + normal.y * halfT },
      { x: w.end.x - normal.x * halfT, y: w.end.y - normal.y * halfT },
      { x: w.start.x - normal.x * halfT, y: w.start.y - normal.y * halfT },
    ];

    const wallType: WallType = w.isExterior ? "exterior" : "partition";

    return {
      id: w.id || `wall-${i + 1}`,
      start: { x: w.start.x, y: w.start.y },
      end: { x: w.end.x, y: w.end.y },
      thickness: w.thickness,
      isExterior: w.isExterior,
      wallType,
      polygon,
    };
  });
}

// ─── 개구부 변환 ─────────────────────────────────────

function convertDoors(walls: DrawnWall[]): DoorData[] {
  const doors: DoorData[] = [];
  let doorIdx = 0;

  for (const wall of walls) {
    const angle = wallAngle(wall);
    const rotation = angle * (180 / Math.PI);

    for (const opening of wall.openings) {
      if (opening.type === "window" || opening.type === "large_window") continue;

      doorIdx++;
      const pos = interpolateOnSegment(wall.start, wall.end, opening.positionOnWall);

      let doorType: DoorData["type"];
      switch (opening.type) {
        case "swing":
          doorType = "swing";
          break;
        case "sliding":
          doorType = "sliding";
          break;
        case "entrance":
          doorType = "entrance";
          break;
        default:
          doorType = "swing";
      }

      doors.push({
        id: opening.id || `door-${doorIdx}`,
        position: { x: pos.x, y: pos.y },
        width: opening.width,
        rotation,
        type: doorType,
        connectedRooms: ["", ""], // 빈 값 (라벨링에서 채워짐)
      });
    }
  }

  return doors;
}

function convertWindows(walls: DrawnWall[]): WindowData[] {
  const windows: WindowData[] = [];
  let winIdx = 0;

  for (const wall of walls) {
    const angle = wallAngle(wall);
    const rotation = angle * (180 / Math.PI);

    for (const opening of wall.openings) {
      if (opening.type !== "window" && opening.type !== "large_window") continue;

      winIdx++;
      const pos = interpolateOnSegment(wall.start, wall.end, opening.positionOnWall);

      windows.push({
        id: opening.id || `window-${winIdx}`,
        position: { x: pos.x, y: pos.y },
        width: opening.width,
        height: opening.type === "large_window" ? 2.2 : 1.2,
        rotation,
        wallId: wall.id,
      });
    }
  }

  return windows;
}

// ─── 방 변환 ─────────────────────────────────────────

function convertRooms(rooms: DetectedRoom[]): RoomData[] {
  return rooms.map((r, i) => {
    // 바운딩박스 계산
    const xs = r.polygon.map((p) => p.x);
    const ys = r.polygon.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    // 중심점
    const cx = r.polygon.reduce((s, p) => s + p.x, 0) / r.polygon.length;
    const cy = r.polygon.reduce((s, p) => s + p.y, 0) / r.polygon.length;

    // 바닥 재질 추정
    const material = r.type === "BATHROOM" ? "tile" as const : "wood" as const;

    return {
      id: r.id || `room-${i + 1}`,
      type: (r.type || "LIVING") as RoomType,
      name: r.name || roomTypeName(r.type as RoomType | undefined),
      area: Math.round(r.area * 100) / 100,
      position: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
      polygon: r.polygon.map((p) => ({ x: p.x, y: p.y })),
      center: { x: cx, y: cy },
      material,
    };
  });
}

function roomTypeName(type?: RoomType): string {
  const labels: Record<string, string> = {
    LIVING: "거실",
    KITCHEN: "주방",
    MASTER_BED: "안방",
    BED: "침실",
    BATHROOM: "욕실",
    ENTRANCE: "현관",
    BALCONY: "발코니",
    UTILITY: "다용도실",
    CORRIDOR: "복도",
    DRESSROOM: "드레스룸",
  };
  return labels[type || "LIVING"] || "거실";
}

// ─── 메인 내보내기 함수 ──────────────────────────────

/**
 * DrawingState → ParsedFloorPlan 변환
 * @param state 현재 드로잉 상태
 * @param knownArea 알려진 전용면적 (㎡), 있으면 면적 정규화 수행
 */
export function exportToFloorPlan(
  state: DrawingState,
  knownArea?: number
): ParsedFloorPlan {
  // 면적 정규화
  const normalizedState = knownArea
    ? normalizeCoordinates(state, knownArea)
    : state;

  const walls = convertWalls(normalizedState.walls);
  const rooms = convertRooms(normalizedState.rooms);
  const doors = convertDoors(normalizedState.walls);
  const windows = convertWindows(normalizedState.walls);

  // 총 면적 계산
  const totalArea = knownArea || rooms.reduce((sum, r) => sum + r.area, 0);

  return {
    totalArea: Math.round(totalArea * 1000) / 1000,
    rooms,
    walls,
    doors,
    windows,
    fixtures: [],
  };
}
