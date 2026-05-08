/**
 * 자재 카탈로그 — 영역 카테고리별 추천 자재 목록.
 * 가이드 §2-3 / §3-2 의 materials_db 역할.
 *
 * 가격: 한국물가협회(KPA) 단가 기준 평균. 실 거래 시 ±20% 변동 가능.
 * description: gpt-image-2 prompt에 영문으로 들어가는 자재 묘사.
 *
 * TODO: 추후 Supabase materials 테이블로 이전 (브랜드 SKU와 결제 연동).
 */
import type { CatalogMaterial, InteriorCategory } from "@/types/segmentation";

export const MATERIAL_CATALOG: CatalogMaterial[] = [
  // ────────── FLOOR ──────────
  {
    sku: "FLR-OAK-WHT",
    name: "강마루 화이트오크",
    brand: "동화자연마루",
    category: "floor",
    unit: "sqm",
    price_per_unit: 42000,
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
    price_per_unit: 44000,
    description:
      "Korean engineered laminate flooring, natural-oak warm tone, soft wood grain visible",
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
    price_per_unit: 48000,
    description: "Korean dark walnut laminate floor, deep brown grain, herringbone-friendly",
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
    price_per_unit: 89000,
    description: "Solid oak herringbone parquet flooring, classical pattern, warm honey tone",
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
    price_per_unit: 68000,
    description:
      "Large-format porcelain tile, marble look, white with grey veins, glossy finish, 600x600mm",
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
    price_per_unit: 22000,
    description: "Vinyl deco tile with concrete look, urban modern, light grey",
    color: "concrete grey",
    texture: "concrete cement",
    finish: "matte",
    color_hex: "#A8A8A8",
  },

  // ────────── WALL ──────────
  {
    sku: "WAL-PNT-WHT",
    name: "친환경 페인트 화이트",
    brand: "벤자민무어",
    category: "wall",
    unit: "sqm",
    price_per_unit: 8000,
    description: "Low-VOC eco paint, pure clean white, smooth matte wall finish",
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
    price_per_unit: 9000,
    description: "Low-VOC eco paint, warm greige (grey-beige), modern minimal wall finish",
    color: "warm greige",
    finish: "matte",
    color_hex: "#C9C0B3",
  },
  {
    sku: "WAL-WPB-LIN",
    name: "실크벽지 베이지 린넨",
    category: "wall",
    unit: "sqm",
    price_per_unit: 12000,
    description: "Korean silk wallpaper, beige linen-textured, subtle weave pattern",
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
    price_per_unit: 48000,
    description: "Vertical oak wood panel wall, ribbed slats, warm modern accent wall",
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
    price_per_unit: 72000,
    description: "Limestone microcement wall finish, natural off-white, subtle organic texture",
    color: "off-white limestone",
    texture: "microcement organic",
    finish: "matte mineral",
    color_hex: "#EDE7DD",
  },

  // ────────── CEILING ──────────
  {
    sku: "CEI-PNT-WHT",
    name: "천장 페인트 화이트",
    category: "ceiling",
    unit: "sqm",
    price_per_unit: 7000,
    description: "Flat white ceiling paint, eco low-VOC, smooth even finish",
    color: "flat white",
    finish: "matte",
    color_hex: "#FFFFFF",
  },
  {
    sku: "CEI-LIN-MOL",
    name: "라인몰딩 천장 (간접조명)",
    category: "ceiling",
    unit: "sqm",
    price_per_unit: 28000,
    description:
      "Slim line moulding ceiling with indirect cove lighting, modern minimal, no thick crown",
    color: "white",
    finish: "matte with hidden LED line",
    color_hex: "#FFFFFF",
  },

  // ────────── WINDOW ──────────
  {
    sku: "WIN-ALU-BLK",
    name: "시스템창호 알루미늄 블랙",
    brand: "LG하우시스",
    category: "window",
    unit: "m",
    price_per_unit: 280000,
    description: "Black aluminum system window frame, slim profile, double-pane glazing",
    color: "matte black aluminum",
    finish: "matte",
    color_hex: "#1F1F1F",
  },
  {
    sku: "WIN-WD-OAK",
    name: "시스템창호 우드클래드 오크",
    category: "window",
    unit: "m",
    price_per_unit: 420000,
    description: "Wood-clad system window with oak interior frame, premium quiet luxury",
    color: "oak wood interior",
    finish: "natural oil",
    color_hex: "#C8A77D",
  },

  // ────────── DOOR ──────────
  {
    sku: "DOR-ABS-WHT",
    name: "ABS 도어 화이트",
    category: "door",
    unit: "each",
    price_per_unit: 180000,
    description: "ABS interior door, clean white, slim minimal frame",
    color: "white",
    finish: "matte",
    color_hex: "#F8F8F8",
  },
  {
    sku: "DOR-WD-OAK",
    name: "우드도어 오크",
    category: "door",
    unit: "each",
    price_per_unit: 320000,
    description: "Oak wood interior door, warm vertical grain, hidden hinge",
    color: "warm oak",
    finish: "natural oil",
    color_hex: "#C8A77D",
  },
  {
    sku: "DOR-SLD-3PN",
    name: "중문 3연동 슬라이딩",
    category: "door",
    unit: "each",
    price_per_unit: 680000,
    description: "Korean 3-panel sliding entry inner door, slim aluminum frame, frosted glass",
    color: "matte black frame, frosted glass",
    finish: "frosted glass",
    color_hex: "#2A2A2A",
  },

  // ────────── CURTAIN ──────────
  {
    sku: "CUR-ROL-WHT",
    name: "롤러쉐이드 화이트",
    category: "curtain",
    unit: "each",
    price_per_unit: 95000,
    description: "Roller shade in white linen, clean roll-up window covering",
    color: "white linen",
    finish: "matte",
    color_hex: "#F5F5F0",
  },
  {
    sku: "CUR-WBL-OAK",
    name: "우드블라인드 오크",
    category: "curtain",
    unit: "each",
    price_per_unit: 180000,
    description: "Oak wood horizontal blinds, 50mm slats, warm minimal",
    color: "warm oak",
    finish: "natural",
    color_hex: "#C8A77D",
  },
];

export function materialsByCategory(category: InteriorCategory): CatalogMaterial[] {
  return MATERIAL_CATALOG.filter((m) => m.category === category);
}

export function materialBySku(sku: string): CatalogMaterial | undefined {
  return MATERIAL_CATALOG.find((m) => m.sku === sku);
}
