/**
 * 자재 카탈로그 — 한국물가협회(KPA) + 대한건설협회 표준품셈 기반 시공 단가.
 *
 * 가격 = 자재비 (material_price) + 노무비 (labor_price)
 * 현장 적용 시 추가:
 *   - 부자재 (접착제/실리콘 등) 자재의 5% 정도 자동
 *   - 경비 (운반비/폐기물/잡재료) 자재+노무의 8%
 *   - 간접비 (관리비+이윤) 위 합의 12%
 *
 * 모든 가격은 ㎡당 KRW (또는 EA/m). 시공면적 1㎡ 기준 평균.
 * 시세 조사: 한국물가정보 2026.04 + 인테리어 단가표 평균.
 *
 * 이 카탈로그는 실거래 단가의 ±10% 범위. 실제 견적은 현장 답사 후 확정.
 */
import type { CatalogMaterial, InteriorCategory } from "@/types/segmentation";

export const MATERIAL_CATALOG: CatalogMaterial[] = [
  // ────────── FLOOR (바닥) ──────────
  // 도배공 + 바닥공 일당 약 25만원, 보조원 18만원 평균. m²당 약 6~10천원 노무비.
  {
    sku: "FLR-OAK-WHT",
    name: "강마루 화이트오크",
    brand: "동화자연마루",
    category: "floor",
    unit: "sqm",
    material_price: 42000,
    labor_price: 18000,  // 도배공 + 본드 + 마무리. 표준품셈 기준
    description:
      "Korean engineered laminate flooring, white-oak grain, matte finish, 9mm plank, photorealistic wood texture",
    color: "warm white-oak",
    texture: "fine wood grain",
    finish: "matte",
    color_hex: "#D4B896",
  },
  {
    sku: "FLR-OAK-NAT",
    name: "강마루 내추럴오크",
    brand: "동화자연마루",
    category: "floor",
    unit: "sqm",
    material_price: 44000,
    labor_price: 18000,
    description: "Korean engineered laminate flooring, natural-oak warm tone",
    color: "natural oak",
    texture: "soft wood grain",
    finish: "matte",
    color_hex: "#C8A77D",
  },
  {
    sku: "FLR-WAL-DRK",
    name: "강마루 다크월넛",
    category: "floor",
    unit: "sqm",
    material_price: 48000,
    labor_price: 18000,
    description: "Korean dark walnut laminate floor, deep brown grain",
    color: "dark walnut brown",
    texture: "rich wood grain",
    finish: "satin",
    color_hex: "#5D3A1A",
  },
  {
    sku: "FLR-HRB-OAK",
    name: "원목마루 헤링본 오크",
    brand: "이건마루",
    category: "floor",
    unit: "sqm",
    material_price: 89000,
    labor_price: 32000, // 헤링본은 시공 난이도 높아 노무비 +
    description: "Solid oak herringbone parquet flooring",
    color: "honey oak",
    texture: "herringbone parquet",
    finish: "oil satin",
    color_hex: "#B88A5A",
  },
  {
    sku: "FLR-PSL-WHT",
    name: "포세린 타일 마블 화이트",
    category: "floor",
    unit: "sqm",
    material_price: 68000,
    labor_price: 35000, // 타일공 일당 30만원. 줄눈/접착/배수까지
    description: "Large-format porcelain tile, marble look",
    color: "white marble with grey veining",
    texture: "polished smooth",
    finish: "glossy",
    color_hex: "#F0EDE8",
  },
  {
    sku: "FLR-PVC-CON",
    name: "데코타일 콘크리트룩",
    category: "floor",
    unit: "sqm",
    material_price: 22000,
    labor_price: 12000,
    description: "Vinyl deco tile with concrete look",
    color: "concrete grey",
    texture: "concrete cement",
    finish: "matte",
    color_hex: "#A8A8A8",
  },

  // ────────── WALL (벽) ──────────
  // 도배공 일당 27만원. 1일 약 30㎡ 시공. 노무비 약 9천원/㎡.
  // 페인트는 도장공 일당 25만원. 하루 50㎡. 노무비 약 5천원/㎡ + 양생/2회칠 추가.
  {
    sku: "WAL-PNT-WHT",
    name: "친환경 페인트 화이트",
    brand: "벤자민무어",
    category: "wall",
    unit: "sqm",
    material_price: 8000,    // 친환경 페인트 1L 약 4만원, 1L = 8㎡ → 5천원/㎡ + 프라이머 3천
    labor_price: 12000,      // 도장공 + 양생 + 2회 도포
    description: "Low-VOC eco paint, pure clean white",
    color: "pure white",
    finish: "matte",
    color_hex: "#FAFAFA",
  },
  {
    sku: "WAL-PNT-GRG",
    name: "친환경 페인트 그레이지",
    brand: "벤자민무어",
    category: "wall",
    unit: "sqm",
    material_price: 9000,
    labor_price: 12000,
    description: "Low-VOC eco paint, warm greige",
    color: "warm greige",
    finish: "matte",
    color_hex: "#C9C0B3",
  },
  {
    sku: "WAL-WPB-LIN",
    name: "실크벽지 베이지 린넨",
    category: "wall",
    unit: "sqm",
    material_price: 12000,   // 실크벽지 1롤 5.3㎡ 약 5만원 = 9.4천원/㎡ + 본드/풀
    labor_price: 9000,       // 도배공 표준품셈 8.5천/㎡
    description: "Korean silk wallpaper, beige linen-textured",
    color: "beige linen",
    texture: "linen weave",
    finish: "satin",
    color_hex: "#E8DCC8",
  },
  {
    sku: "WAL-WD-OAK",
    name: "우드패널 오크",
    category: "wall",
    unit: "sqm",
    material_price: 48000,
    labor_price: 22000, // 패널 시공 + 마감
    description: "Vertical oak wood panel wall, ribbed slats",
    color: "warm oak",
    texture: "vertical ribbed wood slats",
    finish: "natural oil",
    color_hex: "#C8A77D",
  },
  {
    sku: "WAL-LIM-WHT",
    name: "라임스톤 마이크로시멘트",
    category: "wall",
    unit: "sqm",
    material_price: 72000,
    labor_price: 38000, // 미장공 + 다회 마감
    description: "Limestone microcement wall finish",
    color: "off-white limestone",
    texture: "microcement organic",
    finish: "matte mineral",
    color_hex: "#EDE7DD",
  },

  // ────────── CEILING (천장) ──────────
  {
    sku: "CEI-PNT-WHT",
    name: "천장 페인트 화이트",
    category: "ceiling",
    unit: "sqm",
    material_price: 7000,
    labor_price: 14000, // 천장 도장은 손이 더 가서 +2천 (사다리/팔뚝 작업)
    description: "Flat white ceiling paint, eco low-VOC",
    color: "flat white",
    finish: "matte",
    color_hex: "#FFFFFF",
  },
  {
    sku: "CEI-LIN-MOL",
    name: "라인몰딩 천장 (간접조명)",
    category: "ceiling",
    unit: "sqm",
    material_price: 28000,
    labor_price: 32000, // 목공 + 전기 + 마감
    description:
      "Slim line moulding ceiling with indirect cove lighting",
    color: "white",
    finish: "matte with hidden LED line",
    color_hex: "#FFFFFF",
  },

  // ────────── WINDOW (창호) ──────────
  // 시스템창호는 m 단위 (선형). 보통 1창 4~6m. 자재 + 시공 + 실란트 + 단열재.
  {
    sku: "WIN-ALU-BLK",
    name: "시스템창호 알루미늄 블랙",
    brand: "LG하우시스",
    category: "window",
    unit: "m",
    material_price: 280000,
    labor_price: 120000, // 창호공 + 보조원 + 단열 마감
    description: "Black aluminum system window, slim profile",
    color: "matte black aluminum",
    finish: "matte",
    color_hex: "#1F1F1F",
  },
  {
    sku: "WIN-WD-OAK",
    name: "시스템창호 우드클래드 오크",
    category: "window",
    unit: "m",
    material_price: 420000,
    labor_price: 150000,
    description: "Wood-clad system window with oak interior frame",
    color: "oak wood interior",
    finish: "natural oil",
    color_hex: "#C8A77D",
  },

  // ────────── DOOR (문) ──────────
  // each 단위. 자재 + 도어틀 + 잠금장치 + 시공.
  {
    sku: "DOR-ABS-WHT",
    name: "ABS 도어 화이트",
    category: "door",
    unit: "each",
    material_price: 180000,
    labor_price: 80000, // 목공 반나절 + 잠금장치 + 마감
    description: "ABS interior door, clean white",
    color: "white",
    finish: "matte",
    color_hex: "#F8F8F8",
  },
  {
    sku: "DOR-WD-OAK",
    name: "우드도어 오크",
    category: "door",
    unit: "each",
    material_price: 320000,
    labor_price: 100000,
    description: "Oak wood interior door, warm vertical grain",
    color: "warm oak",
    finish: "natural oil",
    color_hex: "#C8A77D",
  },
  {
    sku: "DOR-SLD-3PN",
    name: "중문 3연동 슬라이딩",
    category: "door",
    unit: "each",
    material_price: 680000,
    labor_price: 220000, // 3연동 레일 시공 + 정밀 조정
    description: "Korean 3-panel sliding entry inner door",
    color: "matte black frame, frosted glass",
    finish: "frosted glass",
    color_hex: "#2A2A2A",
  },

  // ────────── CURTAIN (커튼) ──────────
  // 1창 기준. 설치 인건비 1~2시간.
  {
    sku: "CUR-ROL-WHT",
    name: "롤러쉐이드 화이트",
    category: "curtain",
    unit: "each",
    material_price: 95000,
    labor_price: 25000,
    description: "Roller shade in white linen",
    color: "white linen",
    finish: "matte",
    color_hex: "#F5F5F0",
  },
  {
    sku: "CUR-WBL-OAK",
    name: "우드블라인드 오크",
    category: "curtain",
    unit: "each",
    material_price: 180000,
    labor_price: 35000,
    description: "Oak wood horizontal blinds, 50mm slats",
    color: "warm oak",
    finish: "natural",
    color_hex: "#C8A77D",
  },
];

/** 카테고리별 fallback 노무비 비율 (자재비 대비 %, 카탈로그 미상 시) */
export const FALLBACK_LABOR_RATIO: Record<InteriorCategory, number> = {
  floor: 0.45,    // 자재의 45% 정도
  wall: 1.10,     // 페인트는 자재보다 노무비 큼
  ceiling: 1.50,  // 천장은 더 큼 (높이 작업)
  window: 0.40,
  door: 0.40,
  curtain: 0.25,
  sofa: 0,
  chair: 0,
  table: 0,
  bed: 0,
  cabinet: 0,
  lighting: 0,
  plant: 0,
  rug: 0,
  artwork: 0,
  unknown: 0,
};

export function materialsByCategory(category: InteriorCategory): CatalogMaterial[] {
  return MATERIAL_CATALOG.filter((m) => m.category === category);
}

export function materialBySku(sku: string): CatalogMaterial | undefined {
  return MATERIAL_CATALOG.find((m) => m.sku === sku);
}

/**
 * 자재 1단위(㎡/m/EA)당 시공 총액 (자재 + 노무).
 * 부자재/경비/간접비는 별도 견적 단계에서 가산.
 */
export function unitTotal(m: CatalogMaterial): number {
  return m.material_price + m.labor_price;
}
