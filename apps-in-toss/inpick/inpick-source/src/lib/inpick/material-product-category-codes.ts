/**
 * material_products.category_code bridge.
 *
 * 운영 DB에는 초기 영문 코드, 세분화된 ARCH/MECH/ELEC 코드, 견적용
 * MAT/MEC/ELE/FUR seed 코드가 함께 존재한다. 화면·Vision·견적 조회가 서로
 * 다른 코드 집합을 사용하지 않도록 이 파일을 단일 기준으로 사용한다.
 */

export const MATERIAL_PRODUCT_CATEGORY_CODES = {
  floor: [
    "MAT-FLR-ENGINEERED",
    "MAT-FLR-PORCELAIN",
    "ARCH_FLOOR",
    "ARCH_FLOOR_ENG",
    "ARCH_FLOOR_WOOD",
    "ARCH_FLOOR_LAM",
    "ARCH_FLOOR_LVT",
    "ARCH_FLOOR_TILE",
    "ARCH_FLOOR_EPOXY",
    "FLOORING",
    "FLOOR",
    "FLOOR_WOOD",
    "FLOOR_TILE",
    "FLOOR_VINYL",
    "FLOOR_STONE",
  ],
  wall: [
    "MAT-WAL-WALLPAPER-SILK",
    "MAT-WAL-PAINT",
    "ARCH_WALL",
    "ARCH_WALL_SILK",
    "ARCH_WALL_PAPER",
    "ARCH_WALL_3D",
    "ARCH_WALL_PAINT",
    "ARCH_WALL_PANEL",
    "ARCH_FILM",
    "ARCH_PAINT",
    "WALLPAPER",
    "PAINT",
    "WALL",
    "WALL_PAPER",
    "WALL_PAINT",
    "WALL_PANEL",
  ],
  ceiling: [
    "MAT-CEI-SMC",
    "ARCH_CEIL",
    "ARCH_CEIL_GYPSUM",
    "ARCH_CEIL_TBAR",
    "ARCH_CEIL_WOOD",
    "ARCH_CEIL_METAL",
    "CEILING",
    "CEILING_PAPER",
    "CEILING_PANEL",
  ],
  tile: [
    "MAT-FLR-PORCELAIN",
    "ARCH_TILE",
    "ARCH_TILE_BATH",
    "ARCH_TILE_KITCHEN",
    "ARCH_TILE_PORCELAIN",
    "ARCH_TILE_CERAMIC",
    "ARCH_FLOOR_TILE",
    "BATH_TILE",
    "KITCHEN_TILE",
  ],
  cabinet: [
    "FUR-KIT-LOWER-CAB",
    "ARCH_KITCHEN",
    "ARCH_KITCHEN_UPPER",
    "ARCH_KITCHEN_LOWER",
    "ARCH_KITCHEN_SINK",
    "KITCHEN_CABINET",
    "KITCHEN_SINK",
    "STORAGE",
  ],
  countertop: [
    "FUR-KIT-COUNTERTOP",
    "ARCH_KITCHEN_TOP",
    "ARCH_STONE_ENG",
    "ARCH_STONE_ACRYLIC",
    "COUNTERTOP",
  ],
  baseboard: ["ARCH_FLOOR_BASE", "BASEBOARD"],
  door: [
    "MAT-DOOR-ABS",
    "ELE-SEC-DOORLOCK",
    "ARCH_DOOR",
    "ARCH_DOOR_ROOM",
    "ARCH_DOOR_ENTRY",
    "ARCH_DOOR_SLIDE",
    "ARCH_DOOR_POCKET",
    "ARCH_DOOR_FOLD",
    "DOOR_ROOM",
    "ENTRY_DOOR",
    "DOOR",
    "DOOR_INTERIOR",
    "DOOR_ENTRANCE",
  ],
  window: [
    "MAT-WDW-PVC",
    "ARCH_WIN",
    "ARCH_WIN_PVC",
    "ARCH_WIN_ALU",
    "ARCH_WIN_WOOD",
    "WINDOW",
    "WINDOW_FRAME",
    "WINDOW_GLASS",
  ],
  fixture: [
    "ELE-SEC-DOORLOCK",
    "FUR-KIT-HOOD",
    "FUR-KIT-COOKTOP",
    "ARCH_KITCHEN_HOOD",
    "ARCH_HARDWARE",
    "ARCH_BATH",
  ],
  lighting: [
    "ELE-LGT-DOWNLIGHT",
    "ELE-LGT-CEILING",
    "ELEC_LIGHT",
    "ELEC_LIGHT_CEIL",
    "ELEC_LIGHT_DOWN",
    "ELEC_LIGHT_PENDANT",
    "LIGHTING",
  ],
  sanitary: [
    "MEC-SAN-TOILET",
    "MEC-SAN-BASIN",
    "MEC-SAN-BATHTUB",
    "MEC-FAU-BASIN",
    "MEC-FAU-KITCHEN",
    "MEC-HEAT-BOILER",
    "MECH_SANITARY",
    "MECH_SANITARY_WC",
    "MECH_SANITARY_BASIN",
    "MECH_SANITARY_TUB",
    "MECH_SANITARY_WASHLET",
    "MECH_FAUCET",
    "MECH_FAUCET_SHOWER",
    "TOILET",
    "VANITY",
    "SHOWER_BATH",
    "BATH_SET",
  ],
  curtain: [
    "ARCH_CURTAIN",
    "ARCH_BLIND",
    "CURTAIN",
    "BLIND",
    "WINDOW_COVERING",
  ],
} as const;

export type MaterialProductCategoryGroup =
  keyof typeof MATERIAL_PRODUCT_CATEGORY_CODES;

export function materialProductCategoryCodes(
  ...groups: MaterialProductCategoryGroup[]
): string[] {
  return Array.from(
    new Set(groups.flatMap((group) => MATERIAL_PRODUCT_CATEGORY_CODES[group])),
  );
}

/**
 * 1차 이미지 인덱스 대상. 일반 가구(ARCH_FURN)와 커튼처럼 현재 제품 분류가
 * 불명확한 데이터는 제외하고, 견적서의 마감·기구 라인에 직접 연결되는 제품만 담는다.
 */
export const CORE_IMAGE_INDEX_CATEGORY_CODES = materialProductCategoryCodes(
  "floor",
  "wall",
  "ceiling",
  "tile",
  "cabinet",
  "countertop",
  "baseboard",
  "door",
  "window",
  "fixture",
  "lighting",
  "sanitary",
);

