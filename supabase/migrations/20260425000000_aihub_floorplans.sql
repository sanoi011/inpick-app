-- 2026-04-25: AI Hub 239 건축도면 데이터 라벨 JSON 인덱스.
-- TL_SPA 9,645 + TL_STR 11,643 + TL_OBJ 8,099 + TL_OCR 9,018 = 약 21~38K 도면 메타.
-- 이미지 풀린 상태는 image_extracted 플래그로 추적.

CREATE TABLE IF NOT EXISTS aihub_floorplans (
  id                bigserial PRIMARY KEY,
  file_id           text NOT NULL,                         -- APT_CS_SPA_001893381 등
  source_dataset    text NOT NULL DEFAULT 'aihub_239',     -- AI Hub 239
  source_type       text NOT NULL,                         -- SPA / STR / OBJ / OCR
  apt_type          text,                                  -- CS / FP / OTHER

  -- 이미지 메타
  width             integer,
  height            integer,
  image_file_name   text,

  -- COCO 집계
  categories_count      integer,
  annotations_count     integer,
  category_counts       jsonb,                             -- {"공간_거실": 2, ...}

  -- 파일 경로 (로컬)
  local_label_path  text,                                  -- JSON 파일 위치
  local_image_path  text,                                  -- 이미지 zip 내 or 풀린 위치
  image_extracted   boolean DEFAULT false,

  created_at        timestamptz DEFAULT now(),
  UNIQUE (source_dataset, file_id, source_type)
);

CREATE INDEX IF NOT EXISTS idx_aihub_source_type     ON aihub_floorplans (source_type);
CREATE INDEX IF NOT EXISTS idx_aihub_apt_type        ON aihub_floorplans (apt_type);
CREATE INDEX IF NOT EXISTS idx_aihub_image_extracted ON aihub_floorplans (image_extracted);
CREATE INDEX IF NOT EXISTS idx_aihub_category_counts ON aihub_floorplans USING gin (category_counts);

COMMENT ON TABLE aihub_floorplans IS 'AI Hub 239 한국 아파트 건축도면 라벨 메타 (COCO 포맷 기반). 이미지는 zip에 보관, image_extracted 플래그로 추적.';
COMMENT ON COLUMN aihub_floorplans.apt_type IS 'CS = 단면도 / FP = 평면도 / OTHER';
