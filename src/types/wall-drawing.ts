/**
 * Wall Drawing Tool - 인터랙티브 벽 그리기 도구 타입 정의
 */

import type { RoomType } from "./floorplan";

// ─── Drawing Tools ──────────────────────────────────

export type DrawingTool = "wall" | "select" | "opening" | "eraser" | "label";

export type OpeningType =
  | "swing"
  | "sliding"
  | "entrance"
  | "window"
  | "large_window";

// ─── Core Geometry ──────────────────────────────────

export interface DrawingPoint {
  x: number; // 미터 단위
  y: number;
}

// ─── Wall ───────────────────────────────────────────

export interface WallOpening {
  id: string;
  type: OpeningType;
  positionOnWall: number; // 0~1 (벽 시작점에서의 비율)
  width: number; // 미터
  swingDirection?: "left" | "right";
}

export interface DrawnWall {
  id: string;
  start: DrawingPoint;
  end: DrawingPoint;
  thickness: number; // 0.12(파티션) or 0.2(외벽)
  isExterior: boolean;
  openings: WallOpening[];
}

// ─── Room ───────────────────────────────────────────

export interface DetectedRoom {
  id: string;
  polygon: DrawingPoint[];
  type?: RoomType;
  name?: string;
  area: number; // m²
}

// ─── Drawing State ──────────────────────────────────

export interface DrawingState {
  walls: DrawnWall[];
  rooms: DetectedRoom[];
  scale: number; // px/m (기본 50)
  panOffset: DrawingPoint;
  totalAreaM2?: number;
  gridEnabled: boolean;
  snapEnabled: boolean;
}

// ─── Actions (undo/redo) ────────────────────────────

export type DrawingAction =
  | { type: "ADD_WALL"; wall: DrawnWall }
  | { type: "REMOVE_WALL"; wallId: string }
  | { type: "ADD_OPENING"; wallId: string; opening: WallOpening }
  | { type: "REMOVE_OPENING"; wallId: string; openingId: string }
  | { type: "LABEL_ROOM"; roomId: string; roomType: RoomType; name: string }
  | { type: "SET_ROOMS"; rooms: DetectedRoom[] }
  | { type: "SET_PAN"; offset: DrawingPoint }
  | { type: "SET_SCALE"; scale: number }
  | { type: "TOGGLE_GRID" }
  | { type: "TOGGLE_SNAP" }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "CLEAR" };

// ─── Opening Defaults (한국 아파트 표준 치수) ───────

export const OPENING_DEFAULTS: Record<
  OpeningType,
  { width: number; label: string }
> = {
  swing: { width: 0.9, label: "여닫이문" },
  sliding: { width: 1.8, label: "미닫이문" },
  entrance: { width: 0.95, label: "현관문" },
  window: { width: 1.5, label: "창문" },
  large_window: { width: 2.4, label: "거실창" },
};

// ─── Constants ──────────────────────────────────────

export const GRID_SIZE = 0.5; // 미터
export const SNAP_THRESHOLD = 0.2; // 미터 (끝점 스냅)
export const STRAIGHTEN_ANGLE = 15; // 도 (직선 보정 허용 각도)
export const DEFAULT_WALL_THICKNESS = 0.12;
export const EXTERIOR_WALL_THICKNESS = 0.2;
