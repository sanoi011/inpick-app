/**
 * 견적서 내역서 — 공종 12개 + 공종별 자재 카테고리 매핑.
 *
 * 가이드: InPick_Quote_System_Spec.md §B-1
 *
 * 현재 material-catalog.ts는 단순 분류(floor/wall/ceiling/window/door/curtain) 사용.
 * 본 spec은 세분화 카테고리(floor_tile_bath/lighting_pendant 등)를 명시 — 추후 catalog 세분화 작업 시 호환.
 * getSectionByMaterialCategory()는 단순/세분화 둘 다 매칭하도록 fallback 처리.
 */

export interface StandardItem {
  itemName: string;
  unit: string;
  defaultQuantity: number | "auto";
  laborCost: number;
  expenseCost: number;
  /** 'auto' 수량 계산식. 변수: area_sqm, bath_area_sqm 등. 미지정 시 1.0 */
  formula?: string;
}

export interface QuoteSection {
  sectionId: string;
  sectionNumber: string;
  sectionName: string;
  sectionNameEn: string;
  /** 본 공종에 포함될 material-catalog 카테고리 (단순/세분 모두 가능) */
  materialCategories: string[];
  /** 본 공종에 자동 추가될 표준 항목 (인건비·운반비·보양 등) */
  standardItems: StandardItem[];
}

export const QUOTE_SECTIONS: QuoteSection[] = [
  // ===== 01. 철거 =====
  {
    sectionId: "demolition",
    sectionNumber: "01",
    sectionName: "철거 및 폐기물 처리",
    sectionNameEn: "Demolition & Disposal",
    materialCategories: [],
    standardItems: [
      {
        itemName: "기존 마감재 철거 (벽/바닥/천장)",
        unit: "m²",
        defaultQuantity: "auto",
        laborCost: 12000,
        expenseCost: 2500,
        formula: "area_sqm",
      },
      {
        itemName: "폐기물 운반 및 처리",
        unit: "톤",
        defaultQuantity: "auto",
        laborCost: 82000,
        expenseCost: 31300,
        formula: "area_sqm * 0.04",
      },
      {
        itemName: "엘리베이터 보양",
        unit: "식",
        defaultQuantity: 1,
        laborCost: 0,
        expenseCost: 350000,
      },
    ],
  },

  // ===== 02. 목공사 =====
  {
    sectionId: "carpentry",
    sectionNumber: "02",
    sectionName: "목공사",
    sectionNameEn: "Carpentry",
    materialCategories: ["ceiling", "wall_partition", "built_in", "art_wall"],
    standardItems: [
      {
        itemName: "석고보드 천장 시공",
        unit: "m²",
        defaultQuantity: "auto",
        laborCost: 12500,
        expenseCost: 0,
        formula: "area_sqm",
      },
    ],
  },

  // ===== 03. 바닥재 =====
  {
    sectionId: "flooring",
    sectionNumber: "03",
    sectionName: "바닥재",
    sectionNameEn: "Flooring",
    materialCategories: ["floor", "floor_tile", "floor_cushion"],
    standardItems: [
      {
        itemName: "바닥 보양 / 청소",
        unit: "식",
        defaultQuantity: 1,
        laborCost: 80000,
        expenseCost: 30000,
      },
    ],
  },

  // ===== 04. 도배 =====
  {
    sectionId: "wallpaper",
    sectionNumber: "04",
    sectionName: "도배",
    sectionNameEn: "Wallpaper",
    materialCategories: ["wallpaper", "wallpaper_paste"],
    standardItems: [],
  },

  // ===== 05. 타일공사 =====
  {
    sectionId: "tile",
    sectionNumber: "05",
    sectionName: "타일공사",
    sectionNameEn: "Tile Work",
    materialCategories: ["wall_tile", "floor_tile_bath", "grout"],
    standardItems: [
      {
        itemName: "방수공사 (액체방수 2회)",
        unit: "m²",
        defaultQuantity: "auto",
        laborCost: 8500,
        expenseCost: 7300,
        formula: "bath_area_sqm",
      },
    ],
  },

  // ===== 06. 주방가구 =====
  {
    sectionId: "kitchen",
    sectionNumber: "06",
    sectionName: "주방가구",
    sectionNameEn: "Kitchen",
    materialCategories: ["sink", "counter", "kitchen_hood", "kitchen_faucet"],
    standardItems: [],
  },

  // ===== 07. 위생도기 =====
  {
    sectionId: "sanitary",
    sectionNumber: "07",
    sectionName: "위생도기 / 욕실가구",
    sectionNameEn: "Sanitary",
    materialCategories: ["toilet", "washstand", "shower", "bath_cabinet", "bath_accessory"],
    standardItems: [],
  },

  // ===== 08. 전기공사 =====
  {
    sectionId: "electrical",
    sectionNumber: "08",
    sectionName: "전기공사",
    sectionNameEn: "Electrical",
    materialCategories: ["switch", "outlet", "wire"],
    standardItems: [
      {
        itemName: "인터폰 / 분전반 점검",
        unit: "식",
        defaultQuantity: 1,
        laborCost: 180000,
        expenseCost: 0,
      },
    ],
  },

  // ===== 09. 조명기구 =====
  {
    sectionId: "lighting",
    sectionNumber: "09",
    sectionName: "조명기구",
    sectionNameEn: "Lighting",
    materialCategories: [
      "lighting_ceiling",
      "lighting_pendant",
      "lighting_wall",
      "lighting_led",
    ],
    standardItems: [],
  },

  // ===== 10. 도장공사 =====
  {
    sectionId: "painting",
    sectionNumber: "10",
    sectionName: "도장공사",
    sectionNameEn: "Painting",
    materialCategories: ["paint", "primer"],
    standardItems: [
      {
        itemName: "하지 처리 (퍼티 / 샌딩)",
        unit: "m²",
        defaultQuantity: "auto",
        laborCost: 4500,
        expenseCost: 1200,
        formula: "area_sqm",
      },
    ],
  },

  // ===== 11. 중문 / 방문 =====
  {
    sectionId: "door",
    sectionNumber: "11",
    sectionName: "중문 / 방문",
    sectionNameEn: "Door",
    materialCategories: ["door", "sliding_door", "door_handle"],
    standardItems: [],
  },

  // ===== 12. 필름 / 도배 마감 =====
  {
    sectionId: "film_finish",
    sectionNumber: "12",
    sectionName: "필름 / 도배 마감",
    sectionNameEn: "Film & Finish",
    materialCategories: ["film_interior", "molding"],
    standardItems: [],
  },
];

// ════════════════════════════════════════
// 유틸
// ════════════════════════════════════════

/**
 * 자재 카테고리 → 공종 매핑.
 * material-catalog가 아직 단순 분류(floor/wall/ceiling)인 점을 감안해
 * 정확 일치 후 prefix fallback도 시도.
 */
export function getSectionByMaterialCategory(category: string): QuoteSection | null {
  // 1) 정확 일치
  const exact = QUOTE_SECTIONS.find((s) => s.materialCategories.includes(category));
  if (exact) return exact;
  // 2) prefix fallback (예: "floor" → flooring 공종, "wall" 단일은 도배 또는 도장으로 — 명시적 매핑 필요)
  const lower = category.toLowerCase();
  if (lower === "floor") return QUOTE_SECTIONS.find((s) => s.sectionId === "flooring") || null;
  if (lower === "wall") return QUOTE_SECTIONS.find((s) => s.sectionId === "wallpaper") || null;
  if (lower === "ceiling") return QUOTE_SECTIONS.find((s) => s.sectionId === "carpentry") || null;
  if (lower === "window") return QUOTE_SECTIONS.find((s) => s.sectionId === "door") || null;
  if (lower === "door") return QUOTE_SECTIONS.find((s) => s.sectionId === "door") || null;
  if (lower === "curtain") return QUOTE_SECTIONS.find((s) => s.sectionId === "film_finish") || null;
  return null;
}

export function getSectionById(sectionId: string): QuoteSection | null {
  return QUOTE_SECTIONS.find((s) => s.sectionId === sectionId) || null;
}

/**
 * 공종 ID 12개 (고정 순서) — UI 정렬·내역서 헤더 출력에 사용.
 */
export const QUOTE_SECTION_ORDER = QUOTE_SECTIONS.map((s) => s.sectionId);

/**
 * 'auto' 수량 + formula 평가.
 * 변수: area_sqm (시공 면적), bath_area_sqm (욕실 면적, 없으면 area_sqm × 0.05)
 */
export function evaluateFormula(
  formula: string | undefined,
  vars: { area_sqm: number; bath_area_sqm?: number },
): number {
  if (!formula) return 1;
  const bath = vars.bath_area_sqm ?? vars.area_sqm * 0.05;
  // safe eval — formula는 spec 정의 텍스트만 허용 (외부 입력 X)
  const expr = formula
    .replace(/area_sqm/g, String(vars.area_sqm))
    .replace(/bath_area_sqm/g, String(bath));
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)();
    return typeof result === "number" && Number.isFinite(result) ? result : 1;
  } catch {
    return 1;
  }
}
