-- 2026-04-23: Vision 라벨된 감성 참고 이미지 저장 테이블.
-- 소스: Gemini 2.5 Flash로 라벨된 vision_labels_*.jsonl
-- 용도: 사용자 자연어 감성 쿼리 → 참고 이미지 retrieve (UX 미리보기용)
--       실제 설치 자재는 material_products/training_furniture_samples가 담당

CREATE TABLE IF NOT EXISTS emotion_reference_images (
  id              bigserial PRIMARY KEY,

  -- 이미지 식별
  source          text NOT NULL,                         -- 'unsplash','pexels','pinterest','pinterest_hf','pexels_kitchen' 등
  source_id       text,                                  -- 원본 ID (있으면)
  original_url    text,                                  -- 원본 URL (있으면)
  local_path      text NOT NULL,                         -- 로컬 경로 (학습/뷰어용)
  public_url      text,                                  -- Supabase Storage 또는 외부 공개 URL (추후)

  -- 수집 컨텍스트
  track           text,                                  -- '01_korean_healing' / '02_color_palette' / '03_biophilic_wellness'
  keyword         text,                                  -- 수집 키워드

  -- Vision 라벨 (6속성)
  space           text,                                  -- 거실/침실/안방/주방/욕실/현관/발코니/드레스룸/서재/다용도실/외부/기타
  style           text,                                  -- modern/minimal/scandinavian/japandi/...
  emotion_tags    text[] DEFAULT ARRAY[]::text[],        -- calm/healing/warm/natural/...
  materials       text[] DEFAULT ARRAY[]::text[],        -- wood/stone/tile/fabric/...
  dominant_colors text[] DEFAULT ARRAY[]::text[],        -- ['#F3EFE7','#D7CFC1','#B8C9A9']
  quality         text CHECK (quality IN ('A','B','C','F')),
  elements        text[] DEFAULT ARRAY[]::text[],        -- sofa/chair/bed/lamp/...

  -- 라벨 메타
  model_name      text DEFAULT 'gemini-2.5-flash',
  labeled_at      timestamptz DEFAULT now(),
  raw_metadata    jsonb,                                 -- 원본 metadata (alt text, photographer, license 등)

  created_at      timestamptz DEFAULT now(),
  UNIQUE (source, local_path)
);

CREATE INDEX IF NOT EXISTS idx_eri_space        ON emotion_reference_images (space);
CREATE INDEX IF NOT EXISTS idx_eri_style        ON emotion_reference_images (style);
CREATE INDEX IF NOT EXISTS idx_eri_quality      ON emotion_reference_images (quality);
CREATE INDEX IF NOT EXISTS idx_eri_track        ON emotion_reference_images (track);
CREATE INDEX IF NOT EXISTS idx_eri_source       ON emotion_reference_images (source);
CREATE INDEX IF NOT EXISTS idx_eri_emotion_tags ON emotion_reference_images USING gin (emotion_tags);
CREATE INDEX IF NOT EXISTS idx_eri_materials    ON emotion_reference_images USING gin (materials);
CREATE INDEX IF NOT EXISTS idx_eri_elements     ON emotion_reference_images USING gin (elements);

COMMENT ON TABLE emotion_reference_images IS 'Vision 라벨된 감성 참고 이미지. 사용자 감성 쿼리에 매칭되는 분위기 레퍼런스 제공 (실 자재 아님).';
COMMENT ON COLUMN emotion_reference_images.local_path IS '원본 로컬 경로. 학습용. Vercel에서는 public_url 또는 Supabase Storage 통해 접근.';
COMMENT ON COLUMN emotion_reference_images.emotion_tags IS '팔레트 매칭용. mood_to_palette_map의 emotion_tags 와 overlap 연산.';
