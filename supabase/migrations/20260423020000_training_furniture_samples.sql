-- 2026-04-23: furniture_synthetic 10K 학습 말뭉치 업로드용 테이블.
-- 각 행 = 합성 가구 이미지 + 9개 메타 (type/style/color/material/shape/details/room_type/price_range/prompt).
-- 딥러닝 학습: 감성·스타일·공간·가격 다중 라벨 분류기 seed.

CREATE TABLE IF NOT EXISTS training_furniture_samples (
  id            bigserial PRIMARY KEY,
  source        text NOT NULL DEFAULT 'furniture_synthetic',
  image_path    text NOT NULL,                          -- 로컬 경로 (Supabase Storage 사전 단계)
  image_view    text,                                   -- 'image' (단일 뷰)

  -- 가구 기본 메타
  furniture_type text,                                  -- bed / chair / sofa / table / desk ...
  style          text,                                  -- modern / traditional / minimalist ...
  color          text,
  material       text,                                  -- wood / fabric / metal / glass / leather
  shape          text,                                  -- rectangular / curved / rounded ...
  details        text,                                  -- nailhead trim / horizontal slat ...

  -- 공간·가격
  room_type      text,                                  -- bedroom / living room / kitchen ...
  space_ko       text,                                  -- 침실 / 거실 / 주방 (한국어 공간)
  price_range    text,                                  -- cheap / moderate / expensive / luxury

  -- 학습용 확장 태그
  emotion_tags   text[] DEFAULT ARRAY[]::text[],        -- ["calm","healing","warm"] 등
  style_tags     text[] DEFAULT ARRAY[]::text[],        -- ["modern","minimal"]

  prompt         text,                                  -- 원본 생성 프롬프트 (있으면)
  created_at     timestamptz DEFAULT now(),

  UNIQUE (source, image_path)
);

CREATE INDEX IF NOT EXISTS idx_training_furniture_type       ON training_furniture_samples (furniture_type);
CREATE INDEX IF NOT EXISTS idx_training_furniture_style      ON training_furniture_samples (style);
CREATE INDEX IF NOT EXISTS idx_training_furniture_room_type  ON training_furniture_samples (room_type);
CREATE INDEX IF NOT EXISTS idx_training_furniture_emotion    ON training_furniture_samples USING gin (emotion_tags);
CREATE INDEX IF NOT EXISTS idx_training_furniture_style_tags ON training_furniture_samples USING gin (style_tags);

COMMENT ON TABLE training_furniture_samples IS 'furniture_synthetic 데이터셋(10K) 학습 말뭉치. 가구 다중 라벨 + 감성·스타일 태그.';
COMMENT ON COLUMN training_furniture_samples.image_path IS '로컬 경로. Supabase Storage 업로드 전 단계. 학습 시 파일 직접 로드.';
