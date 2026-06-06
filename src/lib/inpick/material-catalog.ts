/**
 * 자재 카탈로그 — 한국 인테리어 표준 스펙 80+ 종.
 *
 * 출처:
 *   - 한국물가협회(KPA) 자재 단가
 *   - 대한건설협회 표준품셈 (직종별 노무비)
 *   - 인테리어 협회 평균 시세 (LX하우시스, 동화자연마루, 한샘 등 메이커 카탈로그)
 *
 * 가격 = material_price (자재) + labor_price (노무)
 * 추가 단계 (자동):
 *   - 부자재 자재의 5% (접착제/실리콘/플랜지 등)
 *   - 가설비 (엘리베이터 보양/출입구 보양 등) — 견적 단계에서 정액 또는 %
 *   - 경비 (운반/폐기/잡재료) 직접비 8%
 *   - 현장관리비 5% / 안전관리비 1.5%
 *   - 간접비 (이윤) 12%
 *   - 부가세 별도 10%
 */
import type { CatalogMaterial, InteriorCategory } from "@/types/segmentation";

export const MATERIAL_CATALOG: CatalogMaterial[] = [
  // ═══════════════════════════════════════════════════
  // FLOOR (바닥) — 18종
  // ═══════════════════════════════════════════════════
  // 강마루
  { sku: "FLR-LAM-OAK-WHT", name: "강마루 화이트오크", brand: "동화자연마루", category: "floor", unit: "sqm", material_price: 42000, labor_price: 18000, description: "Korean engineered laminate floor, white-oak grain", color: "warm white-oak", texture: "fine wood grain", finish: "matte", color_hex: "#D4B896" },
  { sku: "FLR-LAM-OAK-NAT", name: "강마루 내추럴오크", brand: "동화자연마루", category: "floor", unit: "sqm", material_price: 44000, labor_price: 18000, description: "Korean laminate floor, natural-oak warm tone", color: "natural oak", texture: "soft wood grain", finish: "matte", color_hex: "#C8A77D" },
  { sku: "FLR-LAM-WAL-DRK", name: "강마루 다크월넛", brand: "동화자연마루", category: "floor", unit: "sqm", material_price: 48000, labor_price: 18000, description: "Korean dark walnut laminate floor", color: "dark walnut brown", texture: "rich wood grain", finish: "satin", color_hex: "#5D3A1A" },
  { sku: "FLR-LAM-MAP", name: "강마루 메이플", brand: "구정마루", category: "floor", unit: "sqm", material_price: 46000, labor_price: 18000, description: "Korean maple laminate, light cream tone", color: "light maple", finish: "matte", color_hex: "#E2C9A0" },
  { sku: "FLR-LAM-ASH", name: "강마루 그레이애쉬", brand: "구정마루", category: "floor", unit: "sqm", material_price: 47000, labor_price: 18000, description: "Korean grey ash laminate, modern cool tone", color: "grey ash", finish: "matte", color_hex: "#A89A8C" },
  // 원목마루
  { sku: "FLR-SOLID-OAK", name: "원목마루 일자형 오크", brand: "이건마루", category: "floor", unit: "sqm", material_price: 78000, labor_price: 25000, description: "Solid oak hardwood, plank style", color: "honey oak", finish: "oil satin", color_hex: "#C4A477" },
  { sku: "FLR-HRB-OAK", name: "원목마루 헤링본 오크", brand: "이건마루", category: "floor", unit: "sqm", material_price: 89000, labor_price: 32000, description: "Solid oak herringbone parquet", color: "honey oak", texture: "herringbone parquet", finish: "oil satin", color_hex: "#B88A5A" },
  { sku: "FLR-HRB-WAL", name: "원목마루 헤링본 월넛", brand: "예성마루", category: "floor", unit: "sqm", material_price: 105000, labor_price: 32000, description: "Solid walnut herringbone parquet, premium dark", color: "rich walnut", finish: "oil natural", color_hex: "#5A3A22" },
  { sku: "FLR-VHM-OAK", name: "원목마루 V홈 오크", category: "floor", unit: "sqm", material_price: 92000, labor_price: 25000, description: "Solid oak with V-groove edges", color: "warm oak", finish: "oil matte", color_hex: "#C8A77D" },
  // 데코타일 (LVT)
  { sku: "FLR-LVT-WD", name: "LVT 데코타일 우드룩", category: "floor", unit: "sqm", material_price: 24000, labor_price: 12000, description: "Luxury vinyl tile, wood look, click-lock", color: "warm wood", finish: "matte", color_hex: "#B58E64" },
  { sku: "FLR-LVT-CON", name: "LVT 데코타일 콘크리트룩", category: "floor", unit: "sqm", material_price: 22000, labor_price: 12000, description: "LVT with concrete look, urban modern", color: "concrete grey", finish: "matte", color_hex: "#A8A8A8" },
  { sku: "FLR-LVT-MARB", name: "LVT 데코타일 마블룩", category: "floor", unit: "sqm", material_price: 28000, labor_price: 12000, description: "LVT with white marble look", color: "white marble", finish: "satin", color_hex: "#EFEFEF" },
  // 폴리싱 / 포세린 타일
  { sku: "FLR-POL-600", name: "폴리싱 타일 600×600 화이트", category: "floor", unit: "sqm", material_price: 32000, labor_price: 30000, description: "Polished porcelain tile 600x600, white", color: "white", finish: "glossy", color_hex: "#F5F5F5" },
  { sku: "FLR-POL-800-GRY", name: "폴리싱 타일 800×800 그레이", category: "floor", unit: "sqm", material_price: 48000, labor_price: 32000, description: "Polished porcelain 800x800, modern grey", color: "soft grey", finish: "glossy", color_hex: "#BEBEBE" },
  { sku: "FLR-POR-MARB-WHT", name: "포세린 마블 화이트 600×1200", category: "floor", unit: "sqm", material_price: 78000, labor_price: 35000, description: "Premium porcelain marble look 600x1200", color: "white marble grey vein", finish: "polished", color_hex: "#F0EDE8" },
  { sku: "FLR-POR-CON", name: "포세린 콘크리트룩 600×600", category: "floor", unit: "sqm", material_price: 54000, labor_price: 30000, description: "Porcelain tile concrete look", color: "concrete urban grey", finish: "matte", color_hex: "#9B9B9B" },
  // 장판 / 카펫
  { sku: "FLR-PVC-ECO", name: "친환경 PVC 장판", brand: "LX하우시스", category: "floor", unit: "sqm", material_price: 18000, labor_price: 9000, description: "Eco-friendly PVC sheet flooring, wood print", color: "warm beige", finish: "matte", color_hex: "#D4B896" },
  { sku: "FLR-CRP-TILE", name: "카펫타일 (사무실용)", category: "floor", unit: "sqm", material_price: 35000, labor_price: 14000, description: "Modular carpet tile, charcoal", color: "charcoal grey", finish: "carpet", color_hex: "#3A3A3A" },

  // ═══════════════════════════════════════════════════
  // WALL (벽) — 16종
  // ═══════════════════════════════════════════════════
  // 페인트
  { sku: "WAL-PNT-WHT", name: "친환경 페인트 화이트", brand: "벤자민무어", category: "wall", unit: "sqm", material_price: 8000, labor_price: 12000, description: "Low-VOC eco paint, pure clean white", color: "pure white", finish: "matte", color_hex: "#FAFAFA" },
  { sku: "WAL-PNT-GRG", name: "친환경 페인트 그레이지", brand: "벤자민무어", category: "wall", unit: "sqm", material_price: 9000, labor_price: 12000, description: "Eco paint, warm greige", color: "warm greige", finish: "matte", color_hex: "#C9C0B3" },
  { sku: "WAL-PNT-NAVY", name: "친환경 페인트 네이비", brand: "던에드워드", category: "wall", unit: "sqm", material_price: 10000, labor_price: 12000, description: "Eco paint, deep navy accent wall", color: "deep navy", finish: "matte", color_hex: "#2A3F5F" },
  { sku: "WAL-PNT-GRN", name: "친환경 페인트 세이지그린", brand: "팔리어", category: "wall", unit: "sqm", material_price: 10000, labor_price: 12000, description: "Eco paint, sage green calm tone", color: "sage green", finish: "matte", color_hex: "#9CAE91" },
  // 실크벽지
  { sku: "WAL-WPB-LIN", name: "실크벽지 베이지 린넨", category: "wall", unit: "sqm", material_price: 12000, labor_price: 9000, description: "Korean silk wallpaper, beige linen weave", color: "beige linen", texture: "linen weave", finish: "satin", color_hex: "#E8DCC8" },
  { sku: "WAL-WPB-WHT", name: "실크벽지 화이트 페어", brand: "LX하우시스", category: "wall", unit: "sqm", material_price: 11000, labor_price: 9000, description: "Korean silk wallpaper, soft white", color: "soft white", finish: "satin", color_hex: "#F5F2EB" },
  { sku: "WAL-WPB-PTN", name: "실크벽지 패턴 (식물)", brand: "LX하우시스", category: "wall", unit: "sqm", material_price: 16000, labor_price: 11000, description: "Korean silk wallpaper, botanical pattern", color: "muted green pattern", finish: "satin", color_hex: "#C8D5C0" },
  // 우드패널
  { sku: "WAL-WD-OAK-V", name: "우드패널 오크 세로슬릿", category: "wall", unit: "sqm", material_price: 48000, labor_price: 22000, description: "Vertical oak wood ribbed wall panel", color: "warm oak", texture: "vertical ribbed slats", finish: "natural oil", color_hex: "#C8A77D" },
  { sku: "WAL-WD-WAL", name: "우드패널 월넛", category: "wall", unit: "sqm", material_price: 62000, labor_price: 22000, description: "Walnut wood paneling, premium dark", color: "rich walnut", finish: "natural oil", color_hex: "#5A3A22" },
  { sku: "WAL-WD-MAP", name: "우드패널 메이플", category: "wall", unit: "sqm", material_price: 52000, labor_price: 22000, description: "Maple wood panel, light cream", color: "light maple", finish: "natural oil", color_hex: "#E2C9A0" },
  // 타일
  { sku: "WAL-TILE-SUB", name: "서브웨이 타일 화이트", category: "wall", unit: "sqm", material_price: 35000, labor_price: 32000, description: "Classic white subway tile 75x150", color: "glossy white", finish: "glossy", color_hex: "#FFFFFF" },
  { sku: "WAL-TILE-HEX", name: "헥사곤 모자이크 화이트/그레이", category: "wall", unit: "sqm", material_price: 58000, labor_price: 38000, description: "Hexagon mosaic, white & grey", color: "mixed white grey", finish: "matte", color_hex: "#D8D8D8" },
  { sku: "WAL-TILE-MARB", name: "마블 타일 화이트", category: "wall", unit: "sqm", material_price: 78000, labor_price: 35000, description: "White marble wall tile, premium", color: "white marble", finish: "polished", color_hex: "#F0EDE8" },
  // 석재 / 마이크로시멘트
  { sku: "WAL-LIM-WHT", name: "라임스톤 마이크로시멘트", category: "wall", unit: "sqm", material_price: 72000, labor_price: 38000, description: "Limestone microcement organic finish", color: "off-white limestone", texture: "microcement", finish: "matte mineral", color_hex: "#EDE7DD" },
  { sku: "WAL-MARB-SLAB", name: "대리석 슬랩 (포인트벽)", category: "wall", unit: "sqm", material_price: 280000, labor_price: 95000, description: "Marble slab feature wall", color: "Calacatta marble", finish: "polished", color_hex: "#F5F2EE" },
  // 메탈
  { sku: "WAL-MTL-BLK", name: "블랙 메탈 패널", category: "wall", unit: "sqm", material_price: 95000, labor_price: 32000, description: "Black metal wall panel, industrial", color: "matte black metal", finish: "matte", color_hex: "#2A2A2A" },

  // ═══════════════════════════════════════════════════
  // CEILING (천장) — 8종
  // ═══════════════════════════════════════════════════
  { sku: "CEI-PNT-WHT", name: "천장 페인트 화이트", category: "ceiling", unit: "sqm", material_price: 7000, labor_price: 14000, description: "Flat white ceiling paint, eco low-VOC", color: "flat white", finish: "matte", color_hex: "#FFFFFF" },
  { sku: "CEI-PNT-NAT", name: "천장 페인트 내추럴", category: "ceiling", unit: "sqm", material_price: 7000, labor_price: 14000, description: "Natural off-white ceiling paint", color: "off-white", finish: "matte", color_hex: "#F8F5EC" },
  { sku: "CEI-WUM-S", name: "우물천장 단단", category: "ceiling", unit: "sqm", material_price: 28000, labor_price: 28000, description: "Single-step coffered ceiling with paint", color: "white", finish: "matte", color_hex: "#FFFFFF" },
  { sku: "CEI-WUM-D", name: "우물천장 2단 (간접조명)", category: "ceiling", unit: "sqm", material_price: 38000, labor_price: 42000, description: "Double-step coffered ceiling with cove lighting", color: "white", finish: "matte with hidden LED", color_hex: "#FFFFFF" },
  { sku: "CEI-LIN-MOL", name: "라인몰딩 천장 (간접조명)", category: "ceiling", unit: "sqm", material_price: 28000, labor_price: 32000, description: "Slim line moulding ceiling with cove lighting", color: "white", finish: "matte with LED", color_hex: "#FFFFFF" },
  { sku: "CEI-EXP", name: "노출천장 (인더스트리얼)", category: "ceiling", unit: "sqm", material_price: 18000, labor_price: 22000, description: "Exposed ceiling, industrial style, paint finish", color: "exposed concrete", finish: "matte", color_hex: "#9B9B9B" },
  { sku: "CEI-WD-PAN", name: "우드패널 천장 오크", category: "ceiling", unit: "sqm", material_price: 65000, labor_price: 38000, description: "Oak wood panel ceiling", color: "warm oak", finish: "natural oil", color_hex: "#C8A77D" },
  { sku: "CEI-TEX", name: "텍스 천장 (오피스)", category: "ceiling", unit: "sqm", material_price: 22000, labor_price: 18000, description: "Acoustic tex ceiling, office grade", color: "white", finish: "matte", color_hex: "#F5F5F5" },

  // ═══════════════════════════════════════════════════
  // WINDOW (창호) — 10종, 단위 m
  // ═══════════════════════════════════════════════════
  { sku: "WIN-ALU-BLK", name: "시스템창호 알루미늄 블랙", brand: "LG하우시스", category: "window", unit: "m", material_price: 280000, labor_price: 120000, description: "Black aluminum system window, slim profile", color: "matte black aluminum", finish: "matte", color_hex: "#1F1F1F" },
  { sku: "WIN-ALU-WHT", name: "시스템창호 알루미늄 화이트", brand: "LG하우시스", category: "window", unit: "m", material_price: 260000, labor_price: 120000, description: "White aluminum system window", color: "white aluminum", finish: "matte", color_hex: "#FFFFFF" },
  { sku: "WIN-PVC-WHT", name: "시스템창호 PVC 화이트", brand: "한섬", category: "window", unit: "m", material_price: 220000, labor_price: 110000, description: "PVC system window, white frame", color: "white PVC", finish: "matte", color_hex: "#F5F5F5" },
  { sku: "WIN-WD-OAK", name: "시스템창호 우드클래드 오크", category: "window", unit: "m", material_price: 420000, labor_price: 150000, description: "Wood-clad system window with oak interior", color: "oak wood interior", finish: "natural oil", color_hex: "#C8A77D" },
  { sku: "WIN-DBL", name: "이중창 (단열 강화)", brand: "영림", category: "window", unit: "m", material_price: 350000, labor_price: 130000, description: "Double-glazing insulated window", color: "white frame", finish: "matte", color_hex: "#F0F0F0" },
  { sku: "WIN-TPL", name: "삼중창 (저에너지)", category: "window", unit: "m", material_price: 480000, labor_price: 150000, description: "Triple-glazing low-E window", color: "white frame", finish: "matte", color_hex: "#F0F0F0" },
  { sku: "WIN-FOLD-3", name: "폴딩 도어 3연동", category: "window", unit: "m", material_price: 580000, labor_price: 180000, description: "3-panel folding door", color: "matte black aluminum", finish: "matte", color_hex: "#2A2A2A" },
  { sku: "WIN-FOLD-4", name: "폴딩 도어 4연동", category: "window", unit: "m", material_price: 720000, labor_price: 220000, description: "4-panel folding door", color: "matte black aluminum", finish: "matte", color_hex: "#2A2A2A" },
  { sku: "WIN-PIC-WD", name: "픽쳐창 (고정형) 우드프레임", category: "window", unit: "m", material_price: 320000, labor_price: 110000, description: "Fixed picture window, oak wood frame", color: "warm oak", finish: "natural oil", color_hex: "#C8A77D" },
  { sku: "WIN-MOSQ", name: "방충망 (시스템창호용)", category: "window", unit: "m", material_price: 35000, labor_price: 18000, description: "Insect screen for system window", color: "black mesh", finish: "mesh", color_hex: "#444444" },

  // ═══════════════════════════════════════════════════
  // DOOR (문) — 12종, 단위 EA
  // ═══════════════════════════════════════════════════
  { sku: "DOR-ABS-WHT", name: "ABS 도어 화이트", category: "door", unit: "each", material_price: 180000, labor_price: 80000, description: "ABS interior door, clean white", color: "white", finish: "matte", color_hex: "#F8F8F8" },
  { sku: "DOR-ABS-GRY", name: "ABS 도어 그레이", category: "door", unit: "each", material_price: 190000, labor_price: 80000, description: "ABS interior door, soft grey", color: "soft grey", finish: "matte", color_hex: "#9E9E9E" },
  { sku: "DOR-WD-OAK", name: "우드도어 오크", category: "door", unit: "each", material_price: 320000, labor_price: 100000, description: "Oak wood interior door, vertical grain", color: "warm oak", finish: "natural oil", color_hex: "#C8A77D" },
  { sku: "DOR-WD-WAL", name: "우드도어 월넛", category: "door", unit: "each", material_price: 380000, labor_price: 100000, description: "Walnut wood door, premium dark", color: "rich walnut", finish: "natural oil", color_hex: "#5A3A22" },
  { sku: "DOR-FLU-WHT", name: "플러시 도어 화이트 (히든프레임)", category: "door", unit: "each", material_price: 380000, labor_price: 130000, description: "Hidden frame flush door, white", color: "matte white", finish: "matte", color_hex: "#FFFFFF" },
  { sku: "DOR-PIV-WD", name: "피봇 도어 우드 (대형)", category: "door", unit: "each", material_price: 850000, labor_price: 220000, description: "Pivot door, large oak wood, premium entry", color: "warm oak", finish: "natural oil", color_hex: "#C8A77D" },
  { sku: "DOR-SLD-2PN", name: "중문 2연동 슬라이딩", category: "door", unit: "each", material_price: 480000, labor_price: 180000, description: "2-panel sliding inner door, slim aluminum frame", color: "black frame, frosted glass", finish: "frosted glass", color_hex: "#2A2A2A" },
  { sku: "DOR-SLD-3PN", name: "중문 3연동 슬라이딩", category: "door", unit: "each", material_price: 680000, labor_price: 220000, description: "3-panel sliding inner door, slim frame", color: "matte black frame, frosted glass", finish: "frosted glass", color_hex: "#2A2A2A" },
  { sku: "DOR-SLD-4PN", name: "중문 4연동 슬라이딩", category: "door", unit: "each", material_price: 920000, labor_price: 260000, description: "4-panel sliding inner door", color: "matte black frame, frosted glass", finish: "frosted glass", color_hex: "#2A2A2A" },
  { sku: "DOR-POC", name: "포켓 도어 (벽매립)", category: "door", unit: "each", material_price: 720000, labor_price: 280000, description: "Pocket door (wall-recessed slider)", color: "warm oak", finish: "natural oil", color_hex: "#C8A77D" },
  { sku: "DOR-BRN", name: "헛간문 (Barn Door)", category: "door", unit: "each", material_price: 580000, labor_price: 180000, description: "Barn door with metal track, rustic style", color: "rustic wood", finish: "weathered", color_hex: "#8B6F47" },
  { sku: "DOR-GLS-PIV", name: "유리 피봇 도어 (강화유리)", category: "door", unit: "each", material_price: 920000, labor_price: 250000, description: "Tempered glass pivot door, slim frame", color: "clear glass + black frame", finish: "glossy", color_hex: "#1A1A1A" },

  // ═══════════════════════════════════════════════════
  // CURTAIN (커튼) — 9종, 단위 EA (1창 기준)
  // ═══════════════════════════════════════════════════
  { sku: "CUR-ROL-WHT", name: "롤러쉐이드 화이트", category: "curtain", unit: "each", material_price: 95000, labor_price: 25000, description: "Roller shade in white linen", color: "white linen", finish: "matte", color_hex: "#F5F5F0" },
  { sku: "CUR-ROL-GRY", name: "롤러쉐이드 그레이", category: "curtain", unit: "each", material_price: 95000, labor_price: 25000, description: "Roller shade, sophisticated grey", color: "warm grey", finish: "matte", color_hex: "#9B9B9B" },
  { sku: "CUR-WBL-OAK", name: "우드블라인드 오크 50mm", category: "curtain", unit: "each", material_price: 180000, labor_price: 35000, description: "Oak wood horizontal blinds 50mm slats", color: "warm oak", finish: "natural", color_hex: "#C8A77D" },
  { sku: "CUR-WBL-WHT", name: "우드블라인드 화이트", category: "curtain", unit: "each", material_price: 165000, labor_price: 35000, description: "White wood blinds 50mm", color: "matte white", finish: "matte", color_hex: "#F5F5F5" },
  { sku: "CUR-PVC-BLD", name: "PVC 블라인드 25mm", category: "curtain", unit: "each", material_price: 65000, labor_price: 22000, description: "PVC venetian blinds 25mm slats", color: "warm wood print", finish: "matte", color_hex: "#B58E64" },
  { sku: "CUR-COMBI", name: "콤비 블라인드", category: "curtain", unit: "each", material_price: 120000, labor_price: 28000, description: "Combi blind, modern striped translucent", color: "soft beige stripes", finish: "translucent", color_hex: "#E0D8C8" },
  { sku: "CUR-HONEY", name: "허니콤 블라인드 (단열)", category: "curtain", unit: "each", material_price: 220000, labor_price: 38000, description: "Honeycomb blind, insulating cellular", color: "soft white", finish: "matte", color_hex: "#F0F0F0" },
  { sku: "CUR-FAB-LIN", name: "린넨 패브릭 커튼", category: "curtain", unit: "each", material_price: 180000, labor_price: 45000, description: "Linen fabric curtain with hidden track", color: "natural linen", finish: "soft", color_hex: "#E8DCC8" },
  { sku: "CUR-DBL-CUR", name: "이중 커튼 (속커튼 + 차르륵)", category: "curtain", unit: "each", material_price: 320000, labor_price: 55000, description: "Double-layer curtain, sheer + blackout", color: "white sheer + grey blackout", finish: "soft", color_hex: "#D8D8D8" },
];

/** 카테고리별 fallback 노무비 비율 (자재비 대비, 카탈로그 미상 시) */
export const FALLBACK_LABOR_RATIO: Record<InteriorCategory, number> = {
  floor: 0.45,
  wall: 1.10,
  ceiling: 1.50,
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

export function unitTotal(m: CatalogMaterial): number {
  return m.material_price + m.labor_price;
}

/**
 * 견적 가설비/관리비 표준 항목 (사용자가 수정 가능).
 * 단위 KRW. 정액 또는 % (rate >= 0).
 */
export interface SetupCostItem {
  id: string;
  name: string;
  /** 정액 (KRW) */
  amount: number;
  /** % 비율 — 자재+노무 대비 (0.05 = 5%). amount와 동시 X. */
  rate?: number;
  description?: string;
  editable?: boolean;
}

export const DEFAULT_SETUP_COSTS: SetupCostItem[] = [
  // 가설비
  { id: "elev_protect", name: "엘리베이터 보양", amount: 350000, description: "엘리베이터 내부/입구 보양 자재 + 작업 (1식)", editable: true },
  { id: "entry_protect", name: "출입구·복도 보양", amount: 180000, description: "현관/복도/계단 바닥 보양 (보양지 + 작업)", editable: true },
  { id: "tmp_material", name: "가설 자재", amount: 250000, description: "가설 비계, 작업등, 임시 가림막, 가설 운반대", editable: true },
  { id: "waste", name: "폐기물 처리", amount: 480000, description: "공사 폐기물 마대 처리 + 운반 (평형별 변동)", editable: true },
];

export const DEFAULT_MANAGEMENT_RATE = 0.05;  // 5% 현장관리비
export const DEFAULT_SAFETY_RATE = 0.015;     // 1.5% 안전관리비
export const DEFAULT_EXPENSES_RATE = 0.08;    // 8% 경비
export const DEFAULT_INDIRECT_RATE = 0.12;    // 12% 간접비(이윤)
export const DEFAULT_VAT_RATE = 0.10;          // 10% 부가세
