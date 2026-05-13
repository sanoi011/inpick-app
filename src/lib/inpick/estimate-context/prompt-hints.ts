/**
 * 프롬프트에서 MaterialHint 추출 — vision 분석 전 1차 evidence.
 * 가이드: inpick-step2-estimate-evidence-pipeline-fix-20260512.md §8-1
 *
 * 휴리스틱 (한국어 + 영어 키워드):
 *   - "오크 마루" → { surfaceType: "floor", materialCategory: "engineered_wood" }
 *   - "포세린 타일" → { surfaceType: "floor", materialCategory: "porcelain_tile" }
 *   - "실크 벽지" → { surfaceType: "wall", materialCategory: "silk_wallpaper" }
 *   - "도장" → { surfaceType: "wall", materialCategory: "paint" }
 *
 * 추출 못 하면 빈 배열 — 견적은 scope/standard 폴백에 의존.
 */
import type {
  MaterialHint,
  ProjectMode,
  SurfaceTypeKind,
} from "./types";

interface PatternRule {
  surfaceType: SurfaceTypeKind;
  category: string;
  patterns: RegExp[];
  nameKo?: string;
  confidence: number;
}

const RULES: PatternRule[] = [
  // 바닥
  {
    surfaceType: "floor",
    category: "porcelain_tile",
    patterns: [/포세린/i, /포세린타일/i, /porcelain/i],
    nameKo: "포세린 타일",
    confidence: 0.5,
  },
  {
    surfaceType: "floor",
    category: "engineered_wood",
    patterns: [/강마루/i, /강화마루/i, /오크 ?마루/i, /엔지니어드 ?우드/i],
    nameKo: "강마루",
    confidence: 0.5,
  },
  {
    surfaceType: "floor",
    category: "solid_wood",
    patterns: [/원목마루/i, /원목 ?바닥/i, /solid wood/i],
    nameKo: "원목마루",
    confidence: 0.55,
  },
  {
    surfaceType: "floor",
    category: "vinyl_sheet",
    patterns: [/장판/i, /비닐 ?시트/i, /lvt/i],
    nameKo: "장판",
    confidence: 0.4,
  },
  // 벽
  {
    surfaceType: "wall",
    category: "silk_wallpaper",
    patterns: [/실크 ?벽지/i, /실크 ?도배/i],
    nameKo: "실크 벽지",
    confidence: 0.55,
  },
  {
    surfaceType: "wall",
    category: "paint",
    patterns: [/도장/i, /페인트/i, /paint/i],
    nameKo: "친환경 도장",
    confidence: 0.5,
  },
  {
    surfaceType: "wall",
    category: "wallpaper",
    patterns: [/벽지/i, /도배/i, /wallpaper/i],
    nameKo: "벽지",
    confidence: 0.45,
  },
  {
    surfaceType: "wall",
    category: "wall_tile",
    patterns: [/벽 ?타일/i, /wall tile/i],
    nameKo: "벽 타일",
    confidence: 0.5,
  },
  // 천장
  {
    surfaceType: "ceiling",
    category: "ceiling_paint",
    patterns: [/천장 ?도장/i, /천장 ?페인트/i],
    nameKo: "천장 도장",
    confidence: 0.5,
  },
  {
    surfaceType: "ceiling",
    category: "gypsum_ceiling",
    patterns: [/우물 ?천장/i, /석고 ?천장/i],
    nameKo: "석고 천장",
    confidence: 0.5,
  },
  // 가구/설비
  {
    surfaceType: "counter",
    category: "kitchen_cabinet",
    patterns: [/싱크대/i, /주방 ?가구/i, /상부장/i, /하부장/i],
    nameKo: "싱크대",
    confidence: 0.5,
  },
  {
    surfaceType: "built_in_furniture",
    category: "built_in_closet",
    patterns: [/붙박이장/i, /드레스룸 ?장/i, /built-?in/i],
    nameKo: "붙박이장",
    confidence: 0.5,
  },
  {
    surfaceType: "lighting",
    category: "pendant_light",
    patterns: [/펜던트 ?조명/i, /pendant/i],
    nameKo: "펜던트 조명",
    confidence: 0.5,
  },
  {
    surfaceType: "lighting",
    category: "led_recessed",
    patterns: [/매입등/i, /다운라이트/i, /led/i],
    nameKo: "LED 매입등",
    confidence: 0.45,
  },
  // 상가
  {
    surfaceType: "signage",
    category: "exterior_signage",
    patterns: [/간판/i, /signage/i, /파사드 ?사인/i],
    nameKo: "외부 간판",
    confidence: 0.5,
  },
  {
    surfaceType: "partition",
    category: "glass_partition",
    patterns: [/유리 ?파티션/i, /glass partition/i],
    nameKo: "유리 파티션",
    confidence: 0.55,
  },
];

export function extractMaterialHintsFromPrompt(input: {
  prompt?: string | null;
  projectMode?: ProjectMode;
  targetName?: string;
}): MaterialHint[] {
  const text = `${input.prompt ?? ""} ${input.targetName ?? ""}`.trim();
  if (!text) return [];

  const seen = new Set<string>();
  const hints: MaterialHint[] = [];
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      const key = `${rule.surfaceType}::${rule.category}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hints.push({
        surfaceType: rule.surfaceType,
        materialCategory: rule.category,
        materialNameKo: rule.nameKo,
        confidence: rule.confidence,
        source: "prompt_extract",
        assumptions: [`prompt 매칭: "${rule.patterns[0].source}"`],
      });
    }
  }
  return hints;
}
