// src/lib/floor-plan/viewer-constants.ts
// INPICK 엔지니어링 뷰어 컬러 팔레트 + 상수

export const ENG_COLORS = {
  // 벽체
  WALL_EXTERIOR: "#2D2D3D",
  WALL_INTERIOR: "#4A4A5A",
  WALL_STROKE: "#1A1A2E",

  // 공간 타입별 반투명 채우기 (기술적 톤)
  ROOM_FILLS: {
    LIVING: "rgba(200, 215, 235, 0.35)",
    KITCHEN: "rgba(225, 210, 190, 0.35)",
    MASTER_BED: "rgba(210, 200, 225, 0.35)",
    BED: "rgba(195, 205, 220, 0.35)",
    BATHROOM: "rgba(190, 220, 225, 0.35)",
    ENTRANCE: "rgba(220, 210, 200, 0.35)",
    BALCONY: "rgba(200, 220, 200, 0.35)",
    UTILITY: "rgba(215, 215, 215, 0.35)",
    CORRIDOR: "rgba(210, 215, 220, 0.35)",
    DRESSROOM: "rgba(220, 205, 215, 0.35)",
  } as Record<string, string>,

  // 문/창문
  DOOR_ARC: "#E67E22",
  DOOR_LEAF: "#D4A574",
  WINDOW_FRAME: "#60A5FA",
  WINDOW_GLASS: "#93C5FD",

  // 치수선
  DIMENSION_LINE: "#6B7280",
  DIMENSION_TEXT: "#374151",

  // 설비
  FIXTURE_STROKE: "#4B5563",
  FIXTURE_FILL: "#F3F4F6",

  // 배경
  GRID_LINE: "#E5E7EB",
  BACKGROUND: "#FAFBFC",

  // 뱃지
  BADGE_BG: "#1E3A5F",
  BADGE_TEXT: "#FFFFFF",

  // 선택/호버
  SELECTED_STROKE: "#2563EB",
  SELECTED_FILL: "rgba(37, 99, 235, 0.08)",
  HOVER_STROKE: "#60A5FA",

  // 라벨
  LABEL_NAME: "#2D2D3D",
  LABEL_AREA: "#6B7280",
} as const;

export const VIEWER_SCALE = 50; // 1m = 50px in SVG
