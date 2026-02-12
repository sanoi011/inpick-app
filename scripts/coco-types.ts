// COCO annotation format types for building drawing data

export interface COCOCategory {
  id: number;
  name: string;
}

export interface COCOImage {
  id: number;
  width: number;
  height: number;
  file_name: string;
}

export interface COCOAnnotation {
  id: number;
  image_id: number;
  category_id: number;
  segmentation: number[][]; // [[x1,y1,x2,y2,...]]
  area: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
  iscrowd: number;
  attributes: Record<string, unknown>;
}

export interface COCOFile {
  categories: COCOCategory[];
  images: COCOImage[];
  annotations: COCOAnnotation[];
}

// Category ID to INPICK RoomType mapping
export const CATEGORY_TO_ROOM_TYPE: Record<number, string> = {
  1: "UTILITY",      // 공간_다목적공간
  13: "LIVING",      // 공간_거실
  14: "BED",         // 공간_침실 (largest becomes MASTER_BED)
  15: "KITCHEN",     // 공간_주방
  16: "ENTRANCE",    // 공간_현관
  17: "BALCONY",     // 공간_발코니
  18: "BATHROOM",    // 공간_화장실
  19: "UTILITY",     // 공간_실외기실
  20: "DRESSROOM",   // 공간_드레스룸
  22: "UTILITY",     // 공간_기타
};

// Category IDs to skip (common areas, background)
export const SKIP_CATEGORIES = new Set([2, 3, 12, 23]);

// Category name labels
export const CATEGORY_LABELS: Record<number, string> = {
  1: "다목적공간",
  13: "거실",
  14: "침실",
  15: "주방",
  16: "현관",
  17: "발코니",
  18: "화장실",
  19: "실외기실",
  20: "드레스룸",
  22: "기타",
};

// ─── STR (Structure) categories ───

export const STR_CATEGORIES = {
  DOOR: 9,       // 구조_출입문
  WINDOW: 10,    // 구조_창호
  WALL: 11,      // 구조_벽체
} as const;

export const FIXTURE_CATEGORIES: Record<number, string> = {
  4: "toilet",        // 객체_변기
  5: "sink",          // 객체_세면대
  6: "kitchen_sink",  // 객체_싱크대
  7: "bathtub",       // 객체_욕조
  8: "stove",         // 객체_가스레인지
};

export const DOOR_TYPE_MAP: Record<string, "swing" | "sliding" | "folding"> = {
  "여닫이문": "swing",
  "미닫이문": "sliding",
  "접이문": "folding",
  "회전문": "swing",
  "기타문": "swing",
};

export const WALL_MATERIAL_MAP: Record<string, { isExterior: boolean; thickness: number }> = {
  "철근콘크리트벽": { isExterior: true, thickness: 0.20 },
  "기타벽": { isExterior: false, thickness: 0.12 },
  "RC벽": { isExterior: true, thickness: 0.20 },
};
