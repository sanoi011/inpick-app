/**
 * 인테리어 렌더 이미지의 세그멘테이션/자재 교체 데이터 모델
 * 가이드: InPick_Segmentation_Material_Replacement_Guide.md §1-4
 */

export const INTERIOR_CATEGORIES = {
  floor: "바닥",
  wall: "벽",
  ceiling: "천장",
  window: "창문",
  door: "문",
  curtain: "커튼",
  sofa: "소파",
  chair: "의자",
  table: "테이블",
  bed: "침대",
  cabinet: "수납장",
  lighting: "조명",
  plant: "식물",
  rug: "러그",
  artwork: "아트워크",
  unknown: "기타",
} as const;

export type InteriorCategory = keyof typeof INTERIOR_CATEGORIES;

/** 시공(자재 교체) 가능 카테고리 */
export const REPLACEABLE_CATEGORIES = new Set<InteriorCategory>([
  "floor",
  "wall",
  "ceiling",
  "window",
  "door",
  "curtain",
]);

/** 가구 카테고리 (시공 면적에서 제외) */
export const FURNITURE_CATEGORIES = new Set<InteriorCategory>([
  "sofa",
  "chair",
  "table",
  "bed",
  "cabinet",
  "plant",
  "rug",
  "artwork",
]);

export interface SegRegion {
  /** "region_001" 형식 */
  id: string;
  category: InteriorCategory;
  /** "바닥" 같은 한글 라벨 */
  label_ko: string;

  /**
   * 정규화 polygon (0~1 좌표). SVG `viewBox="0 0 1 1"` + `vectorEffect="non-scaling-stroke"` 와 같이 그릴 것.
   * 픽셀 좌표가 필요하면 Math.round(x * imageWidth) / Math.round(y * imageHeight).
   */
  polygon: [number, number][];

  /** [x, y, w, h] — 정규화. 라벨 위치, hit-test 가속용 */
  bbox: [number, number, number, number];

  /** 카테고리 분류 신뢰도 0~1 */
  confidence: number;

  is_replaceable: boolean;
  is_furniture: boolean;

  /** 사용자가 선택한 자재 (없으면 null) */
  current_material: string | null;
  current_material_sku: string | null;

  /** 면적 — Vision/SAM 파이프라인이 산출 */
  area_normalized: number; // polygon 면적 / 전체 (0~1)
  area_sqm?: number;       // pixel_to_sqm_ratio가 있을 때만

  /** Vision/SAM이 추정한 현재 자재 텍스트 (참고용) */
  guessed_material?: string;
  guessed_color_hex?: string;
}

export interface SegmentationData {
  image_id: string;
  image_url: string;
  image_size: [number, number]; // [W, H]
  /** 평면도/Step1에서 받은 실면적 (m²) */
  real_world_area_sqm?: number;
  /** 시공 가능 영역 정규화 면적 합 → real_world_area_sqm 에 매핑 */
  pixel_to_sqm_ratio?: number;
  total_regions: number;
  regions: SegRegion[];
  provider: "gpt-4o-vision" | "sam-2.1" | "sam-3";
  created_at: string;
}

/** 자재 라이브러리 entry */
export interface CatalogMaterial {
  sku: string;
  name: string;
  brand?: string;
  category: InteriorCategory;
  /** 단위 — 면적 자재면 sqm, 개수 자재면 each */
  unit: "sqm" | "m" | "each";
  price_per_unit: number; // KRW
  description: string;     // gpt-image-2 prompt에 들어갈 영문 묘사
  color?: string;
  texture?: string;
  finish?: string;
  thumbnail_url?: string;
  color_hex?: string;
}

/** 견적 1줄 */
export interface EstimateLine {
  region_id: string;
  category: InteriorCategory;
  label_ko: string;
  material_name: string;
  material_sku: string;
  brand?: string;
  unit: "sqm" | "m" | "each";
  qty: number;       // 면적 또는 개수
  unit_price: number;
  subtotal: number;
}
