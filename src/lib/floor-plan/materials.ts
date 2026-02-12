// src/lib/floor-plan/materials.ts
// PBR 재질 정의 (INPICK-TECH-SPEC 기준)

export interface PBRMaterialDef {
  name: string;
  color: string;
  roughness: number;
  metalness: number;
  envMapIntensity?: number;
  transparent?: boolean;
  opacity?: number;
}

// 벽면 (페인트)
export const WALL_PAINT: PBRMaterialDef = {
  name: "wall_paint",
  color: "#f5f0eb",
  roughness: 0.92,
  metalness: 0.0,
  envMapIntensity: 0.3,
};

// 원목 마루
export const WOOD_FLOOR: PBRMaterialDef = {
  name: "wood_floor",
  color: "#b08a5e",
  roughness: 0.55,
  metalness: 0.0,
  envMapIntensity: 0.5,
};

// 타일 (욕실/현관)
export const TILE: PBRMaterialDef = {
  name: "tile",
  color: "#d4d0cc",
  roughness: 0.25,
  metalness: 0.0,
  envMapIntensity: 0.8,
};

// 유리
export const GLASS: PBRMaterialDef = {
  name: "glass",
  color: "#c8e0f0",
  roughness: 0.05,
  metalness: 0.0,
  envMapIntensity: 1.2,
  transparent: true,
  opacity: 0.35,
};

// 스테인리스 (주방)
export const STAINLESS: PBRMaterialDef = {
  name: "stainless",
  color: "#c0c0c0",
  roughness: 0.18,
  metalness: 0.95,
  envMapIntensity: 1.5,
};

// 도기 (위생도기)
export const CERAMIC: PBRMaterialDef = {
  name: "ceramic",
  color: "#f8f8f8",
  roughness: 0.12,
  metalness: 0.0,
  envMapIntensity: 1.0,
};

// 다크 벽체 (외벽 — 엔지니어링 스타일)
export const WALL_DARK: PBRMaterialDef = {
  name: "wall_dark",
  color: "#2D2D3D",
  roughness: 0.85,
  metalness: 0.02,
  envMapIntensity: 0.4,
};

// 다크 벽체 (내벽 — 약간 밝은 톤)
export const WALL_DARK_INTERIOR: PBRMaterialDef = {
  name: "wall_dark_interior",
  color: "#3D3D4D",
  roughness: 0.88,
  metalness: 0.01,
  envMapIntensity: 0.35,
};

// 천장 (화이트 페인트)
export const CEILING: PBRMaterialDef = {
  name: "ceiling",
  color: "#ffffff",
  roughness: 0.95,
  metalness: 0.0,
  envMapIntensity: 0.2,
};

// 공간 타입별 바닥 재질 매핑
export const FLOOR_MATERIAL_MAP: Record<string, PBRMaterialDef> = {
  LIVING_ROOM: WOOD_FLOOR,
  LIVING: WOOD_FLOOR,
  MASTER_BEDROOM: WOOD_FLOOR,
  MASTER_BED: WOOD_FLOOR,
  BEDROOM: WOOD_FLOOR,
  BED: WOOD_FLOOR,
  KITCHEN: WOOD_FLOOR,
  CORRIDOR: WOOD_FLOOR,
  DRESSROOM: WOOD_FLOOR,
  BATHROOM: TILE,
  ENTRANCE: TILE,
  BALCONY: TILE,
  UTILITY: TILE,
};

export function getFloorMaterial(roomType: string): PBRMaterialDef {
  return FLOOR_MATERIAL_MAP[roomType] || WOOD_FLOOR;
}
