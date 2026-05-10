/**
 * Surface → Category 매핑.
 *
 * 가이드: c:\Users\user\Downloads\inpick-vision-material-estimate-dev-plan-20260510.md §8-2
 *
 * material_products.category_code와 category_taxonomy/category_aliases 통합 검색용.
 * 예: surfaceType="floor" + room="bath" → ["BATH_TILE", "tile", "porcelain_tile"]
 */
import type { SurfaceType } from "./types";

/**
 * 1차 매핑 — surface 단독 (room 무관).
 * material_products.category_code 우선, 그 다음 category_taxonomy slug.
 */
export const SURFACE_TO_CATEGORY_HINTS: Record<SurfaceType, string[]> = {
  floor: ["FLOORING", "flooring", "wood_floor", "laminate_floor", "강마루", "장판", "마루", "원목마루"],
  wall: ["WALLPAPER", "PAINT", "wallpaper", "paint", "wall_panel", "도배", "벽지", "페인트"],
  ceiling: ["CEILING", "ceiling", "ceiling_paper", "천장지", "천장", "도장"],
  tile: ["BATH_TILE", "KITCHEN_TILE", "tile", "porcelain_tile", "bathroom_tile", "kitchen_tile", "타일", "포세린"],
  cabinet: ["KITCHEN_CABINET", "STORAGE", "cabinet", "kitchen_cabinet", "붙박이장", "싱크대"],
  countertop: ["countertop", "engineered_stone", "인조대리석", "상판"],
  baseboard: ["BASEBOARD", "baseboard", "걸레받이"],
  door: ["DOOR_ROOM", "ENTRY_DOOR", "door", "interior_door", "문짝", "문틀", "방문", "현관문"],
  window: ["WINDOW", "window", "샷시", "창호"],
  fixture: ["fixture", "hardware", "부속"],
  lighting: ["LIGHTING", "lighting", "조명"],
  sanitary: [
    "TOILET",
    "VANITY",
    "SHOWER_BATH",
    "BATH_SET",
    "sanitary",
    "toilet",
    "sink",
    "위생도기",
    "변기",
    "세면대",
  ],
  unknown: [],
};

/**
 * Room context 결합 — 욕실 floor는 바닥재(FLOORING)가 아니라 BATH_TILE이 유력.
 */
export function refineCategoryHintsByRoom(
  surface: SurfaceType,
  roomType?: string,
  roomName?: string,
): string[] {
  const base = SURFACE_TO_CATEGORY_HINTS[surface] || [];
  const room = (roomType || roomName || "").toLowerCase();
  const isBath = room.includes("bath") || room.includes("욕실") || room.includes("화장실");
  const isKitchen = room.includes("kitchen") || room.includes("주방") || room.includes("부엌");
  const isEntry = room.includes("entry") || room.includes("entrance") || room.includes("현관");
  const isBalcony = room.includes("balcony") || room.includes("발코니") || room.includes("베란다");

  // 욕실 우선
  if (isBath) {
    if (surface === "floor" || surface === "wall" || surface === "tile") {
      return ["BATH_TILE", ...base.filter((c) => c !== "FLOORING")];
    }
    if (surface === "fixture" || surface === "sanitary") {
      return ["BATH_SET", "TOILET", "VANITY", "SHOWER_BATH", ...base];
    }
  }

  // 주방
  if (isKitchen) {
    if (surface === "floor") return ["FLOORING", "KITCHEN_TILE", ...base];
    if (surface === "wall") return ["KITCHEN_TILE", "WALLPAPER", ...base];
    if (surface === "fixture" || surface === "cabinet") {
      return ["KITCHEN_CABINET", "KITCHEN_SINK", ...base];
    }
  }

  // 현관
  if (isEntry) {
    if (surface === "door") return ["ENTRY_DOOR", "DOOR_ROOM", ...base];
    if (surface === "floor") return ["BATH_TILE", "FLOORING", ...base];
  }

  // 발코니
  if (isBalcony) {
    if (surface === "floor") return ["BATH_TILE", "FLOORING", ...base];
  }

  return base;
}

/**
 * Room compatibility check — confidence gate에서 사용.
 * 예: 욕실 floor에 강마루(FLOORING)가 top1으로 나오면 incompatible.
 */
export function isCategoryCompatibleWithRoom(
  categoryCode: string,
  surface: SurfaceType,
  roomType?: string,
  roomName?: string,
): boolean {
  const expected = refineCategoryHintsByRoom(surface, roomType, roomName);
  if (expected.length === 0) return true; // unknown — 통과
  // case-insensitive contains
  const cat = categoryCode.toLowerCase();
  return expected.some(
    (e) => e.toLowerCase() === cat || cat.includes(e.toLowerCase()),
  );
}
