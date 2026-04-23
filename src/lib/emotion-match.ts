// 감성 매칭 로직 — knowledge.json + palettes.json 로드 후 자연어 쿼리 → 팔레트·자재 후보.
// 서버 컴포넌트/API 라우트에서 사용. 딥러닝 모델 완성 전 placeholder 역할이지만 API 슬롯·DB 접근 패턴은 재활용.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@/lib/supabase/server";

export interface EmotionPalette {
  id: string;
  emotion_tags: string[];
  use_case: string;
  colors: Array<{ hex: string; name: string; ncs?: string; ratio: number }>;
  evidence?: string;
}

export interface EmotionMatchResult {
  query: string;
  detectedMoods: string[];
  palettes: EmotionPalette[];
  materialCandidates: Array<{
    id?: string | number;
    name?: string;
    category_code?: string;
    palette_id?: string;
    emotion_tags?: string[];
    thumbnail_url?: string | null;
    source: "furniture_synthetic" | "material_products" | "archetype";
  }>;
  archetypes: Array<{ archetype: string; materials: string[]; emotion_tags: string[]; reference_brands?: string[] }>;
}

const DATA_ROOT = "D:/InPick/data/materials/sources/emotion_palette";

let _paletteCache: { palettes: EmotionPalette[]; moodMap: Record<string, string[]> } | null = null;
let _archetypeCache: Array<{ archetype: string; materials: string[]; emotion_tags: string[]; reference_brands?: string[] }> | null = null;

function loadPalettes() {
  if (_paletteCache) return _paletteCache;
  try {
    const raw = readFileSync(join(DATA_ROOT, "02_color_palette/palettes.json"), "utf-8");
    const parsed = JSON.parse(raw);
    _paletteCache = {
      palettes: parsed.emotion_palettes as EmotionPalette[],
      moodMap:  parsed.mood_to_palette_map as Record<string, string[]>,
    };
  } catch {
    _paletteCache = { palettes: [], moodMap: {} };
  }
  return _paletteCache;
}

function loadArchetypes(): NonNullable<typeof _archetypeCache> {
  if (_archetypeCache) return _archetypeCache;
  try {
    const raw = readFileSync(join(DATA_ROOT, "01_korean_healing/knowledge.json"), "utf-8");
    const parsed = JSON.parse(raw);
    _archetypeCache = parsed.material_archetypes || [];
  } catch {
    _archetypeCache = [];
  }
  return _archetypeCache!;
}

// 자연어 쿼리에서 감성 키워드 감지
export function detectMoods(query: string): string[] {
  const { moodMap } = loadPalettes();
  const moods = new Set<string>();
  const q = query.trim();
  for (const mood of Object.keys(moodMap)) {
    if (q.includes(mood)) moods.add(mood);
  }
  // 한 번 더 느슨하게: 특수 트리거
  if (/아픈|회복|환자|힐링|치유/.test(q)) { moods.add("치유"); moods.add("힐링"); moods.add("아픈 사람"); }
  if (/집중|공부|서재|몰입/.test(q))       { moods.add("집중"); }
  if (/잠|수면|숙면|침실/.test(q))          { moods.add("숙면"); }
  if (/활기|생기|밝|산뜻/.test(q))          { moods.add("생기"); }
  if (/따뜻|포근|아늑/.test(q))              { moods.add("따뜻한"); }
  if (/깨끗|위생|청결|병원/.test(q))         { moods.add("깨끗한"); }
  if (/제주|바다/.test(q))                   { moods.add("제주풍"); }
  if (/아이|아기|키즈|어린이/.test(q))       { moods.add("아이 방"); }
  return Array.from(moods);
}

export async function matchEmotion(query: string, limit = 20): Promise<EmotionMatchResult> {
  const { palettes, moodMap } = loadPalettes();
  const archetypes = loadArchetypes();

  const moods = detectMoods(query);
  const paletteIds = new Set<string>();
  for (const mood of moods) {
    for (const pid of (moodMap[mood] || [])) paletteIds.add(pid);
  }
  // 모드 매칭 없으면 HEALING_QUIET 기본
  if (paletteIds.size === 0) paletteIds.add("HEALING_QUIET");

  const matchedPalettes = palettes.filter((p) => paletteIds.has(p.id));
  const paletteEmotionTags = new Set(matchedPalettes.flatMap((p) => p.emotion_tags));

  // 아키타입 필터 (감성 태그 overlap)
  const matchedArchetypes = archetypes.filter((a) =>
    a.emotion_tags.some((t) => paletteEmotionTags.has(t))
  );

  // Supabase 자재 후보
  const candidates: EmotionMatchResult["materialCandidates"] = [];
  try {
    const supabase = createClient();

    // 1) training_furniture_samples — emotion_tags 배열 overlap
    const emotionTagsArr = Array.from(paletteEmotionTags);
    if (emotionTagsArr.length > 0) {
      const { data: furn } = await supabase
        .from("training_furniture_samples")
        .select("id, furniture_type, style, color, material, room_type, space_ko, emotion_tags")
        .overlaps("emotion_tags", emotionTagsArr)
        .limit(Math.max(1, Math.floor(limit / 2)));
      for (const row of furn || []) {
        candidates.push({
          id:            row.id,
          name:          `${row.style || ""} ${row.furniture_type || ""}`.trim(),
          category_code: row.room_type || undefined,
          palette_id:    matchedPalettes[0]?.id,
          emotion_tags:  (row.emotion_tags as string[]) || [],
          source:        "furniture_synthetic",
        });
      }
    }

    // 2) material_products — 카테고리 + 이름 키워드 매칭 (있으면)
    // 아키타입의 대표 자재 이름을 OR 로 검색
    const archetypeMaterials = matchedArchetypes.flatMap((a) => a.materials).slice(0, 5);
    if (archetypeMaterials.length > 0) {
      const orClauses = archetypeMaterials
        .map((m) => m.replace(/[,%_\\]/g, "").split(/\s+/)[0])
        .filter((s) => s && s.length >= 2)
        .map((kw) => `name_ko.ilike.%${kw}%`)
        .join(",");
      if (orClauses) {
        const { data: mps } = await supabase
          .from("material_products")
          .select("id, name_ko, category_code, image_url")
          .or(orClauses)
          .limit(Math.max(1, Math.ceil(limit / 2)));
        for (const row of mps || []) {
          candidates.push({
            id:            row.id,
            name:          row.name_ko || undefined,
            category_code: row.category_code || undefined,
            palette_id:    matchedPalettes[0]?.id,
            thumbnail_url: row.image_url || null,
            source:        "material_products",
          });
        }
      }
    }
  } catch {
    // DB 없거나 실패 시 아키타입 fallback
  }

  // 아키타입 자체도 후보로 포함 (시각적으로 보여줄 레퍼런스)
  for (const a of matchedArchetypes) {
    candidates.push({
      name:         a.archetype,
      emotion_tags: a.emotion_tags,
      palette_id:   matchedPalettes[0]?.id,
      source:       "archetype",
    });
  }

  return {
    query,
    detectedMoods: moods,
    palettes:      matchedPalettes,
    materialCandidates: candidates.slice(0, limit),
    archetypes:    matchedArchetypes,
  };
}
