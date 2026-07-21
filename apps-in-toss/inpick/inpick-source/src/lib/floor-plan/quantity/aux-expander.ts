// 부자재 자동 확장: 주자재 견적 라인 + aux_material_coefficients → 부자재 라인 생성
// (주자재 수량 × 계수 × (1 + 손실률/100)) × material_price_lookup.median

import type { EstimateLine } from "./estimate-calculator";
import type { TradeCode, QtyUnit } from "./types";
import { round } from "./types";

export interface AuxCoefficient {
  trade_code: string;
  main_material: string;
  main_material_cat: string | null;
  main_material_unit: string | null;
  sub_material: string;
  sub_material_cat: string | null;
  sub_material_unit: string | null;
  coefficient: number | null;
  loss_pct: number | null;
  formula_text: string | null;
}

export interface PriceLookupRow {
  prdct_clsfc_no: string;
  product_name: string;
  unit: string;
  category_code: string | null;
  confidence: string | null;
  n_samples: number;
  median_price: number;
  p10_price: number | null;
  p90_price: number | null;
}

// 공종 itemName/itemCode에 포함될 주자재 키워드 → 엑셀상 main_material 카테고리
// (엑셀의 주자재는 "일반 석고보드 9.5T" 형태 vs 견적 엔진은 "석고보드 천장")
const MAIN_MATERIAL_KEYWORDS: Array<{ keywords: string[]; matchCats: string[] }> = [
  { keywords: ["석고보드", "석고"],       matchCats: ["석고보드"] },
  { keywords: ["다루끼", "각재"],         matchCats: ["다루끼"] },
  { keywords: ["MDF"],                    matchCats: ["MDF"] },
  { keywords: ["합판"],                   matchCats: ["합판"] },
  { keywords: ["타일", "도기질", "포세린"], matchCats: ["타일"] },
  { keywords: ["벽지", "도배", "실크"],   matchCats: ["벽지"] },
  { keywords: ["마루", "바닥", "강마루", "SPC"], matchCats: ["마루"] },
  { keywords: ["페인트", "도장"],         matchCats: ["페인트"] },
  { keywords: ["단열", "스티로폼", "EPS", "XPS"], matchCats: ["단열재"] },
  { keywords: ["방수"],                   matchCats: ["방수"] },
];

function findMatchingCoefs(line: EstimateLine, coefs: AuxCoefficient[]): AuxCoefficient[] {
  const name = (line.itemName + " " + line.specification).toLowerCase();
  const matches: AuxCoefficient[] = [];
  for (const { keywords, matchCats } of MAIN_MATERIAL_KEYWORDS) {
    if (keywords.some((k) => name.includes(k.toLowerCase()))) {
      for (const c of coefs) {
        if (c.main_material_cat && matchCats.some((cat) => c.main_material_cat!.includes(cat))) {
          matches.push(c);
        }
      }
      break; // 첫 번째 매칭 카테고리만 사용
    }
  }
  return matches;
}

function findAuxPrice(coef: AuxCoefficient, priceLookup: PriceLookupRow[]): number | null {
  // sub_material_cat 또는 sub_material 이름에 키워드 매칭
  const tokens = [coef.sub_material_cat, coef.sub_material]
    .filter(Boolean)
    .map((s) => s!.toLowerCase());
  for (const row of priceLookup) {
    const pname = (row.product_name || "").toLowerCase();
    if (tokens.some((t) => pname.includes(t) || t.includes(pname))) {
      return row.median_price;
    }
  }
  return null;
}

// ─── 공종 코드 매핑 (엑셀 trade_code → 견적 TradeCode) ───
const TRADE_CODE_MAP: Record<string, TradeCode> = {
  DEMO: "01_DEMOLITION",
  CARP: "06_WOODWORK",
  GYPS: "06_WOODWORK",
  TILE: "05_TILE",
  FLOR: "07_FLOORING",
  WPAP: "08_WALLPAPER_PAINT",
  PAIN: "08_WALLPAPER_PAINT",
  INSL: "04_WATERPROOF",
  MECH: "12_PLUMBING",
  ELEC: "14_ELECTRICAL",
  WIN:  "10_DOOR_WINDOW",
  KIT:  "15_FIXTURE",
  BATH: "13_SANITARY",
  FURN: "15_FIXTURE",
  LGHT: "14_ELECTRICAL",
  PLAS: "03_PLASTER",
  FINI: "17_CLEANUP",
  CLN:  "17_CLEANUP",
};

function unitToQtyUnit(u: string | null | undefined): QtyUnit {
  const s = (u || "").toLowerCase();
  if (s.includes("m²") || s.includes("㎡") || s.includes("sqm")) return "SQM";
  if (s === "m" || s.includes("미터") || s.includes("lm"))      return "LM";
  if (s.includes("kg"))                                           return "KG";
  if (s.includes("l"))                                            return "KG"; // 볼륨 근사
  if (s.includes("포") || s.includes("봉"))                       return "BAG";
  if (s.includes("롤"))                                           return "ROLL";
  if (s.includes("캔"))                                           return "CAN";
  return "EA";
}

/**
 * 주자재 견적 라인에 대해 부자재 계수 매칭 → 부자재 라인 생성.
 * 반환: 생성된 auxLines. 비용은 material_price_lookup median 기반 (없으면 0 + unknownPriceFlag).
 */
export function expandAuxMaterials(
  mainLines: EstimateLine[],
  coefficients: AuxCoefficient[],
  priceLookup: PriceLookupRow[]
): EstimateLine[] {
  const auxLines: EstimateLine[] = [];

  for (const line of mainLines) {
    const matched = findMatchingCoefs(line, coefficients);
    if (matched.length === 0) continue;

    for (const coef of matched) {
      if (coef.coefficient == null) continue;
      const lossFactor = 1 + (coef.loss_pct || 0) / 100;
      const rawQty = line.quantity * coef.coefficient * lossFactor;
      const qty = round(rawQty, 3);
      const matUnit = findAuxPrice(coef, priceLookup) ?? 0;
      const matAmt = round(qty * matUnit);

      auxLines.push({
        tradeCode: TRADE_CODE_MAP[coef.trade_code] || line.tradeCode,
        itemCode: `AUX.${coef.trade_code}.${coef.sub_material_cat || "MISC"}`,
        itemName: `[부자재] ${coef.sub_material}`,
        specification: `주자재: ${line.itemName} / 계수: ${coef.coefficient} ${coef.sub_material_unit || ""} / 손실률: ${coef.loss_pct || 0}%`,
        unit: unitToQtyUnit(coef.sub_material_unit),
        quantity: qty,
        materialCost: matUnit,
        laborCost: 0,
        unitCost: matUnit,
        materialAmount: matAmt,
        laborAmount: 0,
        totalAmount: matAmt,
        roomName: line.roomName,
        priceSource: matUnit > 0 ? `G2B median (aux)` : `부자재 단가 미매칭`,
      });
    }
  }
  return auxLines;
}

/**
 * material_price_lookup 기반 fallback 단가 조회.
 * 카테고리 코드(ARCH_*)가 견적 itemCode와 연관 있을 때 median을 반환.
 */
export function findFallbackPrice(
  itemCode: string,
  priceLookup: PriceLookupRow[]
): { materialCost: number; laborCost: number; source: string } | null {
  // itemCode 예: "07.MAIN" (바닥재), "05.FLOOR" (타일) 등 → category_code prefix 매칭
  // 간이 매핑: 견적 itemCode 카테고리 → ARCH_* 후보
  const prefix = itemCode.split(".")[0];
  const candidates: Record<string, string[]> = {
    "05": ["ARCH_FLOOR_TILE", "ARCH_TILE"],
    "07": ["ARCH_FLOOR"],
    "08": ["ARCH_WALL", "ARCH_PAINT"],
    "09": ["ARCH_CEIL"],
    "10": ["ARCH_DOOR", "ARCH_WINDOW"],
    "13": ["ARCH_SANITARY"],
    "14": ["ELEC"],
    "15": ["ARCH_KITCHEN", "ARCH_FURN"],
  };
  const wanted = candidates[prefix] || [];
  if (wanted.length === 0) return null;

  const matched = priceLookup.filter(
    (r) => r.category_code && wanted.some((w) => r.category_code!.startsWith(w))
  );
  if (matched.length === 0) return null;

  // 가장 A/B confidence + 샘플 많은 항목 선택
  matched.sort((a, b) => {
    const rank = (r: PriceLookupRow) =>
      ({ A: 0, B: 1, C: 2, D: 3, E: 4 }[r.confidence || "E"] ?? 5);
    return rank(a) - rank(b) || (b.n_samples || 0) - (a.n_samples || 0);
  });
  const best = matched[0];

  return {
    materialCost: best.median_price,
    laborCost: 0,
    source: `G2B lookup ${best.prdct_clsfc_no} (${best.confidence}, n=${best.n_samples})`,
  };
}
