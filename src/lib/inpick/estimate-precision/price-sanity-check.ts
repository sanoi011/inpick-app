/**
 * Price Sanity Check — 카테고리별 정상 단가 범위 검증.
 * 가이드: inpick-ultra-precision-estimate-engine-v3-dev-plan-20260513.md §7-4
 *
 * 너무 낮으면 자재 누락/단가 입력 오류, 너무 높으면 카테고리 매칭 오류 가능성.
 */

export interface PriceBand {
  /** category_code (또는 fallback key) */
  key: string;
  unit: string;
  /** 정상 범위 (KRW) */
  minPrice: number;
  medianPrice: number;
  maxPrice: number;
  notes?: string;
}

/**
 * 한국 시장 기준 자재 단가 band (2026 기준).
 * 향후 admin UI에서 편집 가능하도록 DB로 이관 검토.
 */
export const PRICE_BAND_LOOKUP: Record<string, PriceBand> = {
  // ─── MAT 건자재 ─────────────────────────────────
  "MAT-FLR-ENGINEERED": { key: "MAT-FLR-ENGINEERED", unit: "m2", minPrice: 35_000, medianPrice: 65_000, maxPrice: 180_000 },
  "MAT-FLR-SOLIDWOOD": { key: "MAT-FLR-SOLIDWOOD", unit: "m2", minPrice: 80_000, medianPrice: 180_000, maxPrice: 450_000 },
  "MAT-FLR-LAMINATE": { key: "MAT-FLR-LAMINATE", unit: "m2", minPrice: 25_000, medianPrice: 45_000, maxPrice: 90_000 },
  "MAT-FLR-SHEET": { key: "MAT-FLR-SHEET", unit: "m2", minPrice: 12_000, medianPrice: 22_000, maxPrice: 50_000 },
  "MAT-FLR-LVT": { key: "MAT-FLR-LVT", unit: "m2", minPrice: 35_000, medianPrice: 60_000, maxPrice: 150_000 },
  "MAT-FLR-PORCELAIN": { key: "MAT-FLR-PORCELAIN", unit: "m2", minPrice: 25_000, medianPrice: 55_000, maxPrice: 180_000 },
  "MAT-WAL-WALLPAPER-SILK": { key: "MAT-WAL-WALLPAPER-SILK", unit: "m2", minPrice: 5_000, medianPrice: 11_000, maxPrice: 30_000 },
  "MAT-WAL-WALLPAPER-PAPER": { key: "MAT-WAL-WALLPAPER-PAPER", unit: "m2", minPrice: 3_000, medianPrice: 5_500, maxPrice: 12_000 },
  "MAT-WAL-PAINT": { key: "MAT-WAL-PAINT", unit: "m2", minPrice: 2_500, medianPrice: 5_500, maxPrice: 18_000 },
  "MAT-WAL-FILM": { key: "MAT-WAL-FILM", unit: "m2", minPrice: 15_000, medianPrice: 35_000, maxPrice: 90_000 },
  "MAT-WAL-TILE": { key: "MAT-WAL-TILE", unit: "m2", minPrice: 25_000, medianPrice: 45_000, maxPrice: 150_000 },
  "MAT-MLD-BASEBOARD": { key: "MAT-MLD-BASEBOARD", unit: "m", minPrice: 2_500, medianPrice: 4_500, maxPrice: 12_000 },
  "MAT-DOOR-ABS": { key: "MAT-DOOR-ABS", unit: "ea", minPrice: 220_000, medianPrice: 380_000, maxPrice: 750_000 },
  "MAT-DOOR-WOOD": { key: "MAT-DOOR-WOOD", unit: "ea", minPrice: 350_000, medianPrice: 650_000, maxPrice: 1_800_000 },
  "MAT-WDW-PVC": { key: "MAT-WDW-PVC", unit: "m2", minPrice: 280_000, medianPrice: 450_000, maxPrice: 950_000 },

  // ─── MEC 기계설비 ────────────────────────────────
  "MEC-SAN-TOILET": { key: "MEC-SAN-TOILET", unit: "ea", minPrice: 180_000, medianPrice: 380_000, maxPrice: 1_500_000 },
  "MEC-SAN-BASIN": { key: "MEC-SAN-BASIN", unit: "ea", minPrice: 80_000, medianPrice: 220_000, maxPrice: 900_000 },
  "MEC-SAN-BATHTUB": { key: "MEC-SAN-BATHTUB", unit: "ea", minPrice: 350_000, medianPrice: 850_000, maxPrice: 3_500_000 },
  "MEC-SAN-SHOWERBOOTH": { key: "MEC-SAN-SHOWERBOOTH", unit: "set", minPrice: 480_000, medianPrice: 950_000, maxPrice: 2_500_000 },
  "MEC-FAU-BASIN": { key: "MEC-FAU-BASIN", unit: "ea", minPrice: 35_000, medianPrice: 85_000, maxPrice: 350_000 },
  "MEC-FAU-SHOWER": { key: "MEC-FAU-SHOWER", unit: "ea", minPrice: 65_000, medianPrice: 180_000, maxPrice: 650_000 },
  "MEC-FAU-KITCHEN": { key: "MEC-FAU-KITCHEN", unit: "ea", minPrice: 55_000, medianPrice: 150_000, maxPrice: 550_000 },
  "MEC-VNT-FAN": { key: "MEC-VNT-FAN", unit: "ea", minPrice: 25_000, medianPrice: 55_000, maxPrice: 220_000 },
  "MEC-VNT-HOOD": { key: "MEC-VNT-HOOD", unit: "ea", minPrice: 280_000, medianPrice: 650_000, maxPrice: 2_500_000 },
  "MEC-HVAC-AC": { key: "MEC-HVAC-AC", unit: "ea", minPrice: 850_000, medianPrice: 1_650_000, maxPrice: 4_500_000 },
  "MEC-HEAT-BOILER": { key: "MEC-HEAT-BOILER", unit: "ea", minPrice: 650_000, medianPrice: 1_250_000, maxPrice: 3_500_000 },

  // ─── ELE 전기 ────────────────────────────────────
  "ELE-LGT-DOWNLIGHT": { key: "ELE-LGT-DOWNLIGHT", unit: "ea", minPrice: 18_000, medianPrice: 45_000, maxPrice: 180_000 },
  "ELE-LGT-CEILING": { key: "ELE-LGT-CEILING", unit: "ea", minPrice: 35_000, medianPrice: 85_000, maxPrice: 450_000 },
  "ELE-LGT-PENDANT": { key: "ELE-LGT-PENDANT", unit: "ea", minPrice: 45_000, medianPrice: 150_000, maxPrice: 950_000 },
  "ELE-LGT-RAIL": { key: "ELE-LGT-RAIL", unit: "set", minPrice: 120_000, medianPrice: 320_000, maxPrice: 1_200_000 },
  "ELE-LGT-STRIP": { key: "ELE-LGT-STRIP", unit: "m", minPrice: 8_000, medianPrice: 18_000, maxPrice: 65_000 },
  "ELE-SWT-1G": { key: "ELE-SWT-1G", unit: "ea", minPrice: 3_500, medianPrice: 8_500, maxPrice: 35_000 },
  "ELE-SWT-2G": { key: "ELE-SWT-2G", unit: "ea", minPrice: 4_500, medianPrice: 11_000, maxPrice: 45_000 },
  "ELE-SWT-3G": { key: "ELE-SWT-3G", unit: "ea", minPrice: 6_000, medianPrice: 15_000, maxPrice: 55_000 },
  "ELE-SWT-DIMMER": { key: "ELE-SWT-DIMMER", unit: "ea", minPrice: 18_000, medianPrice: 45_000, maxPrice: 180_000 },
  "ELE-OUT-1G": { key: "ELE-OUT-1G", unit: "ea", minPrice: 3_500, medianPrice: 8_000, maxPrice: 35_000 },
  "ELE-OUT-2G": { key: "ELE-OUT-2G", unit: "ea", minPrice: 4_500, medianPrice: 10_000, maxPrice: 45_000 },
  "ELE-OUT-USB": { key: "ELE-OUT-USB", unit: "ea", minPrice: 25_000, medianPrice: 55_000, maxPrice: 180_000 },
  "ELE-CND-CD": { key: "ELE-CND-CD", unit: "m", minPrice: 1_200, medianPrice: 2_500, maxPrice: 8_000 },
  "ELE-WIR-IV": { key: "ELE-WIR-IV", unit: "m", minPrice: 800, medianPrice: 1_800, maxPrice: 6_000 },
  "ELE-COM-UTP": { key: "ELE-COM-UTP", unit: "m", minPrice: 800, medianPrice: 1_800, maxPrice: 5_500 },
  "ELE-PNL-DIST": { key: "ELE-PNL-DIST", unit: "ea", minPrice: 280_000, medianPrice: 650_000, maxPrice: 2_500_000 },
  "ELE-BRK-MCCB": { key: "ELE-BRK-MCCB", unit: "ea", minPrice: 15_000, medianPrice: 35_000, maxPrice: 120_000 },
  "ELE-SEC-DOORLOCK": { key: "ELE-SEC-DOORLOCK", unit: "ea", minPrice: 180_000, medianPrice: 320_000, maxPrice: 850_000 },

  // ─── FUR 가구 ────────────────────────────────────
  "FUR-KIT-LOWER-CAB": { key: "FUR-KIT-LOWER-CAB", unit: "m", minPrice: 280_000, medianPrice: 480_000, maxPrice: 1_500_000 },
  "FUR-KIT-UPPER-CAB": { key: "FUR-KIT-UPPER-CAB", unit: "m", minPrice: 220_000, medianPrice: 380_000, maxPrice: 1_200_000 },
  "FUR-KIT-TALL-CAB": { key: "FUR-KIT-TALL-CAB", unit: "ea", minPrice: 350_000, medianPrice: 580_000, maxPrice: 1_800_000 },
  "FUR-KIT-COUNTERTOP": { key: "FUR-KIT-COUNTERTOP", unit: "m", minPrice: 180_000, medianPrice: 320_000, maxPrice: 950_000 },
  "FUR-KIT-SINKBOWL": { key: "FUR-KIT-SINKBOWL", unit: "ea", minPrice: 80_000, medianPrice: 220_000, maxPrice: 850_000 },
  "FUR-KIT-HOOD": { key: "FUR-KIT-HOOD", unit: "ea", minPrice: 280_000, medianPrice: 650_000, maxPrice: 2_500_000 },
  "FUR-KIT-COOKTOP": { key: "FUR-KIT-COOKTOP", unit: "ea", minPrice: 350_000, medianPrice: 850_000, maxPrice: 3_500_000 },
  "FUR-KIT-BACKSPLASH": { key: "FUR-KIT-BACKSPLASH", unit: "m2", minPrice: 35_000, medianPrice: 65_000, maxPrice: 180_000 },
  "FUR-STO-WARDROBE": { key: "FUR-STO-WARDROBE", unit: "m", minPrice: 280_000, medianPrice: 580_000, maxPrice: 1_800_000 },
  "FUR-STO-SHOERACK": { key: "FUR-STO-SHOERACK", unit: "ea", minPrice: 180_000, medianPrice: 380_000, maxPrice: 1_200_000 },
};

export interface PriceSanityResult {
  status: "in_range" | "below_min" | "above_max" | "unknown_category";
  band?: PriceBand;
  warning?: string;
}

/**
 * categoryCode 기반 단가 sanity check.
 * 단가가 정상 범위 벗어나면 warning 메시지 반환.
 */
export function validatePriceBand(input: {
  categoryCode?: string;
  unitPrice: number;
  unit: string;
}): PriceSanityResult {
  if (!input.categoryCode || !input.unitPrice) {
    return { status: "unknown_category" };
  }
  const band = PRICE_BAND_LOOKUP[input.categoryCode];
  if (!band) return { status: "unknown_category" };
  // 단위 불일치는 경고만 — 단가 비교 부정확하므로 unknown 처리
  if (band.unit !== input.unit) {
    return {
      status: "unknown_category",
      band,
      warning: `단위 불일치 (band=${band.unit}, line=${input.unit}) — 단가 범위 검증 skip`,
    };
  }
  if (input.unitPrice < band.minPrice) {
    const ratio = (input.unitPrice / band.medianPrice) * 100;
    return {
      status: "below_min",
      band,
      warning: `⚠️ 단가가 비정상적으로 낮음 (₩${input.unitPrice.toLocaleString()}/${band.unit} — 시장 중앙값의 ${Math.round(ratio)}%, 최소 ₩${band.minPrice.toLocaleString()}). 자재 누락 또는 단가 입력 오류 가능성.`,
    };
  }
  if (input.unitPrice > band.maxPrice) {
    const ratio = (input.unitPrice / band.medianPrice) * 100;
    return {
      status: "above_max",
      band,
      warning: `⚠️ 단가가 비정상적으로 높음 (₩${input.unitPrice.toLocaleString()}/${band.unit} — 시장 중앙값의 ${Math.round(ratio)}%, 최대 ₩${band.maxPrice.toLocaleString()}). 카테고리 매칭 오류 또는 프리미엄 자재.`,
    };
  }
  return { status: "in_range", band };
}
