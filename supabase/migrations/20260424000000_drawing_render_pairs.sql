-- 2026-04-24: 도면·렌더 관계 저장 (Loom Drawings post_id 기반 다면 전개 학습용).
-- 같은 post_id 안의 여러 이미지는 한 프로젝트의 다각도 = 간접 페어.

CREATE TABLE IF NOT EXISTS drawing_render_pairs (
  id            bigserial PRIMARY KEY,
  post_id       text NOT NULL,              -- 인스타 포스트 id (같은 post=같은 프로젝트)
  source        text NOT NULL DEFAULT 'loom_drawings',
  image_count   integer NOT NULL,

  -- 이 포스트가 포함하는 공종 목록 (distinct)
  trade_codes   text[] DEFAULT ARRAY[]::text[],
  drawing_types text[] DEFAULT ARRAY[]::text[],
  spaces        text[] DEFAULT ARRAY[]::text[],

  -- 관계 플래그
  has_plan      boolean DEFAULT false,
  has_elevation boolean DEFAULT false,
  has_section   boolean DEFAULT false,
  has_detail    boolean DEFAULT false,
  has_render    boolean DEFAULT false,
  elevation_count integer DEFAULT 0,         -- 같은 공간 다면 전개 수

  -- 이미지 경로 배열 (emotion_reference_images.id도 좋지만 간단히 path로)
  image_paths   text[] DEFAULT ARRAY[]::text[],

  -- 메타
  caption       text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (source, post_id)
);

CREATE INDEX IF NOT EXISTS idx_drp_source        ON drawing_render_pairs (source);
CREATE INDEX IF NOT EXISTS idx_drp_has_render    ON drawing_render_pairs (has_render);
CREATE INDEX IF NOT EXISTS idx_drp_has_elevation ON drawing_render_pairs (has_elevation);
CREATE INDEX IF NOT EXISTS idx_drp_trade_codes   ON drawing_render_pairs USING gin (trade_codes);
CREATE INDEX IF NOT EXISTS idx_drp_spaces        ON drawing_render_pairs USING gin (spaces);

COMMENT ON TABLE drawing_render_pairs IS 'Loom Drawings 포스트 기반 도면·렌더 간접 페어. 다면 입면 전개 학습용.';
COMMENT ON COLUMN drawing_render_pairs.elevation_count IS '같은 공간의 N면 전개 수. 211개 포스트가 이 >= 2';
