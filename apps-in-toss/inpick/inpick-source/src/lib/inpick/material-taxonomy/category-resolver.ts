/**
 * Category Resolver — 자연어/SurfacePlan/itemName → category_code 매핑.
 * 가이드: inpick-material-category-taxonomy-base-20260513.md §3, §9
 *
 * AI/Vision은 카테고리만 판단 — 실제 brand/sku는 DB가 결정.
 *
 * 흐름:
 *   1. parseSpecHints("CD관 16mm") → { diameter_mm: 16 }
 *   2. resolveCategoryFromText("CD관 16mm") → { code: "ELE-CND-CD", confidence: 0.95, specHints: { diameter_mm: 16 } }
 */
import {
  CATEGORY_ALIAS_SEED,
  MATERIAL_CATEGORY_SEED,
  getCategoryByCode,
  type MaterialCategorySeed,
} from "./category-seed";

export interface ResolvedCategory {
  categoryCode: string;
  category: MaterialCategorySeed;
  confidence: number;
  specHints: Record<string, unknown>;
  matchedAliases: string[];
}

/**
 * 텍스트에서 자재 spec 자동 추출 (정규식).
 *
 * 예시:
 *   "CD관 16mm"           → { diameter_mm: 16 }
 *   "IV전선 2.5SQ"        → { conductor_sqmm: 2.5 }
 *   "LED 15W 3000K"       → { watt: 15, kelvin: 3000 }
 *   "포세린 600×600"      → { size: "600x600" }
 *   "강마루 7.5T 폭95"    → { thickness_mm: 7.5, width_mm: 95 }
 *   "PVC VG1 50A"         → { diameter_A: 50 }
 *   "2구 콘센트"          → { gang: 2 }
 *   "방수 IP55"           → { ip_rating: "IP55" }
 */
export function parseSpecHints(text: string): Record<string, unknown> {
  if (!text) return {};
  const hints: Record<string, unknown> = {};
  const lower = text.toLowerCase();

  // 두께: 7.5T, 12T, 9.5T
  const thickness = text.match(/(\d+(?:\.\d+)?)\s*T(?:\s|$|×|,)/i);
  if (thickness) hints.thickness_mm = Number(thickness[1]);

  // 직경 mm: CD관 16mm, 다운라이트 75mm
  const diameterMm = text.match(/(\d+)\s*mm/i);
  if (diameterMm) hints.diameter_mm = Number(diameterMm[1]);

  // 직경 A (배관 표준): 15A, 20A, 50A, 100A
  const diameterA = text.match(/(\d+)\s*A(?:\b|배관|관|파이프)/i);
  if (diameterA) hints.diameter_A = Number(diameterA[1]);

  // SQ (전선 단면적): 2.5SQ, 4SQ, 6SQ
  const sq = text.match(/(\d+(?:\.\d+)?)\s*SQ/i);
  if (sq) hints.conductor_sqmm = Number(sq[1]);

  // W (와트): 15W, 30W, 50W
  const watt = text.match(/(\d+(?:\.\d+)?)\s*W(?:\b|와트|소비)/i);
  if (watt) hints.watt = Number(watt[1]);

  // 색온도: 3000K, 6500K
  const kelvin = text.match(/(\d{4})\s*K\b/);
  if (kelvin) hints.kelvin = Number(kelvin[1]);

  // 타일 규격: 600x600, 300×300, 1200x600
  const tileSize = text.match(/(\d{3,4})\s*[×x]\s*(\d{3,4})/);
  if (tileSize) hints.size = `${tileSize[1]}x${tileSize[2]}`;

  // 폭: 폭95, 폭 95mm
  const width = text.match(/폭\s*(\d+)/);
  if (width) hints.width_mm = Number(width[1]);

  // 구수 (스위치/콘센트): 1구/2구/3구
  const gang = text.match(/([1-4])\s*구/);
  if (gang) hints.gang = Number(gang[1]);

  // Cat 카테고리 (UTP): Cat.5e, Cat.6, Cat.6A
  const cat = text.match(/Cat\.?\s*(5e|6A|6|7|8)/i);
  if (cat) hints.category = `Cat.${cat[1]}`;

  // IP 등급
  const ip = text.match(/IP\s*(\d{2})/i);
  if (ip) hints.ip_rating = `IP${ip[1]}`;

  // 풍량 CMH (후드/환풍기)
  const cmh = text.match(/(\d+)\s*(?:CMH|m³\/h|풍량)/i);
  if (cmh) hints.airflow_cmh = Number(cmh[1]);

  // 색상 키워드
  if (/(화이트|white|흰)/i.test(lower)) hints.color = "white";
  else if (/(블랙|black|검정|검은)/i.test(lower)) hints.color = "black";
  else if (/(아이보리|ivory|상아)/i.test(lower)) hints.color = "ivory";
  else if (/(그레이|gray|grey|회색)/i.test(lower)) hints.color = "gray";

  // 마감재 종류
  if (/유광|gloss/.test(lower)) hints.sheen = "gloss";
  else if (/무광|matte/.test(lower)) hints.sheen = "matte";

  // 접지 여부 (콘센트)
  if (/접지/.test(text)) hints.ground = true;
  else if (/비접지/.test(text)) hints.ground = false;

  return hints;
}

/**
 * 텍스트 → category 후보 매칭. 점수 높은 순으로 반환.
 *
 * 매칭 알고리즘:
 *   1. CATEGORY_ALIAS_SEED 직접 매칭 (alias.weight 적용)
 *   2. category.keywords 매칭 (가중치 0.5)
 *   3. category.displayNameKo 부분 매칭 (가중치 0.7)
 *   4. spec hints 정합성 보정 (예: gang=2 + ELE-OUT-2G → bonus)
 */
export function resolveCategoryFromText(
  text: string,
  options?: { tradeCode?: string; maxResults?: number },
): ResolvedCategory[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const specHints = parseSpecHints(text);
  const maxResults = options?.maxResults ?? 5;

  // 점수 누적
  const scores = new Map<string, { score: number; aliases: string[] }>();

  function addScore(code: string, points: number, matchedText: string) {
    const cur = scores.get(code) || { score: 0, aliases: [] };
    cur.score += points;
    if (matchedText && !cur.aliases.includes(matchedText)) cur.aliases.push(matchedText);
    scores.set(code, cur);
  }

  // 1) alias seed 직접 매칭
  for (const a of CATEGORY_ALIAS_SEED) {
    if (lower.includes(a.alias.toLowerCase())) {
      addScore(a.categoryCode, a.weight ?? 1.0, a.alias);
    }
  }

  // 2) keywords 매칭
  for (const cat of MATERIAL_CATEGORY_SEED) {
    if (options?.tradeCode && cat.tradeCodes.length > 0 && !cat.tradeCodes.includes(options.tradeCode)) {
      continue;
    }
    for (const kw of cat.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        addScore(cat.categoryCode, 0.5, kw);
      }
    }
    // displayNameKo 부분 매칭
    if (lower.includes(cat.displayNameKo.toLowerCase().slice(0, 4))) {
      addScore(cat.categoryCode, 0.7, cat.displayNameKo);
    }
  }

  // 3) specHints 정합성 보정
  if (specHints.gang === 1) addScore("ELE-SWT-1G", 0.3, "gang=1");
  if (specHints.gang === 2) {
    addScore("ELE-SWT-2G", 0.3, "gang=2");
    addScore("ELE-OUT-2G", 0.3, "gang=2");
  }
  if (specHints.gang === 3) addScore("ELE-SWT-3G", 0.3, "gang=3");

  // 결과 ranking
  const ranked: ResolvedCategory[] = [];
  for (const [code, v] of Array.from(scores.entries())) {
    const cat = getCategoryByCode(code);
    if (!cat) continue;
    ranked.push({
      categoryCode: code,
      category: cat,
      confidence: Math.min(1.0, v.score),
      specHints,
      matchedAliases: v.aliases,
    });
  }
  ranked.sort((a, b) => b.confidence - a.confidence);
  return ranked.slice(0, maxResults);
}

/** SurfacePlan/itemName에서 단일 categoryCode 추정 (최고 confidence) */
export function resolveCategoryFromEstimateLine(input: {
  itemName?: string;
  spec?: string;
  materialCategory?: string;
  tradeCode?: string;
}): ResolvedCategory | null {
  const text = [input.materialCategory, input.itemName, input.spec].filter(Boolean).join(" ");
  if (!text) return null;
  const candidates = resolveCategoryFromText(text, {
    tradeCode: input.tradeCode,
    maxResults: 1,
  });
  return candidates[0] ?? null;
}
