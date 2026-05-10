-- Vision Material Matcher — 6개 신규 테이블
-- 가이드: c:\Users\user\Downloads\inpick-vision-material-estimate-dev-plan-20260510.md §5
-- 작성일: 2026-05-11

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1) material_product_images
--    제품 대표 이미지 + CLIP/OpenCLIP embedding
--    (material_products의 thumbnail_url을 정규화)
-- ============================================================
CREATE TABLE IF NOT EXISTS material_product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_product_id UUID NOT NULL REFERENCES material_products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_kind TEXT NOT NULL DEFAULT 'reference' CHECK (
    image_kind IN ('reference', 'catalog', 'texture', 'package', 'user_confirmed')
  ),
  viewpoint TEXT, -- front, angled, texture_closeup, room_context, unknown
  source TEXT,
  source_license TEXT,
  width INT,
  height INT,
  perceptual_hash TEXT,
  -- CLIP / OpenCLIP ViT-B/32 embedding (512 dim)
  clip_embedding vector(512),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mpi_product
  ON material_product_images(material_product_id);

CREATE INDEX IF NOT EXISTS idx_mpi_clip
  ON material_product_images USING ivfflat (clip_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_mpi_perceptual
  ON material_product_images(perceptual_hash) WHERE perceptual_hash IS NOT NULL;


-- ============================================================
-- 2) material_vision_observations
--    이미지에서 탐지된 표면/객체 단위 observation
-- ============================================================
CREATE TABLE IF NOT EXISTS material_vision_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  room_id TEXT,
  source_image_url TEXT NOT NULL,
  source_image_kind TEXT NOT NULL CHECK (
    source_image_kind IN ('user_photo', 'ai_render', 'floorplan', 'reference')
  ),
  surface_type TEXT NOT NULL CHECK (
    surface_type IN (
      'floor','wall','ceiling','tile','cabinet','countertop',
      'baseboard','door','window','fixture','lighting','sanitary','unknown'
    )
  ),
  room_type TEXT,
  bbox JSONB,                          -- { x, y, width, height }
  mask_url TEXT,                       -- Supabase Storage URL
  crop_url TEXT,                       -- 표면 crop 이미지 URL
  area_ratio NUMERIC,                  -- 0~1
  dominant_colors JSONB,               -- [{ hex, ratio }]
  texture_features JSONB,
  ocr_text TEXT,
  coarse_labels JSONB,                 -- [{ label, confidence }]
  clip_embedding vector(512),
  detector_model TEXT,                 -- "grounding-dino-tiny"
  segmenter_model TEXT,                -- "sam2"
  vision_model TEXT,                   -- "claude-sonnet-4-6" or null
  confidence NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'matched', 'fallback', 'rejected', 'confirmed')
  ),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mvo_project
  ON material_vision_observations(project_id);

CREATE INDEX IF NOT EXISTS idx_mvo_room
  ON material_vision_observations(project_id, room_id);

CREATE INDEX IF NOT EXISTS idx_mvo_status
  ON material_vision_observations(status);

CREATE INDEX IF NOT EXISTS idx_mvo_clip
  ON material_vision_observations USING ivfflat (clip_embedding vector_cosine_ops)
  WITH (lists = 100);


-- ============================================================
-- 3) material_match_candidates
--    observation별 제품 후보 Top-K
-- ============================================================
CREATE TABLE IF NOT EXISTS material_match_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES material_vision_observations(id) ON DELETE CASCADE,
  material_product_id UUID NOT NULL REFERENCES material_products(id),
  rank INT NOT NULL,
  category_score NUMERIC NOT NULL DEFAULT 0,
  visual_score NUMERIC NOT NULL DEFAULT 0,
  texture_score NUMERIC NOT NULL DEFAULT 0,
  color_score NUMERIC NOT NULL DEFAULT 0,
  ocr_score NUMERIC NOT NULL DEFAULT 0,
  price_score NUMERIC NOT NULL DEFAULT 0,
  room_rule_score NUMERIC NOT NULL DEFAULT 0,
  budget_style_score NUMERIC NOT NULL DEFAULT 0,
  total_score NUMERIC NOT NULL DEFAULT 0,
  confidence NUMERIC NOT NULL DEFAULT 0,
  reasons JSONB,                       -- ["category match: FLOORING", "visual sim 0.82"]
  warnings JSONB,                      -- ["CATEGORY_ROOM_INCOMPATIBLE"]
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mmc_observation
  ON material_match_candidates(observation_id, rank);

CREATE INDEX IF NOT EXISTS idx_mmc_product
  ON material_match_candidates(material_product_id);


-- ============================================================
-- 4) material_match_decisions
--    사용자/시스템 최종 선택
-- ============================================================
CREATE TABLE IF NOT EXISTS material_match_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES material_vision_observations(id) ON DELETE CASCADE,
  selected_material_product_id UUID REFERENCES material_products(id),
  decision_type TEXT NOT NULL CHECK (
    decision_type IN (
      'auto_high_confidence','user_selected','contractor_selected',
      'fallback_generic','rejected'
    )
  ),
  confidence NUMERIC NOT NULL DEFAULT 0,
  fallback_reason TEXT,
  decided_by UUID,                     -- user_id 또는 contractor_id
  decided_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB                       -- active learning용 (rejected_reasons 등)
);

CREATE INDEX IF NOT EXISTS idx_mmd_observation
  ON material_match_decisions(observation_id);

CREATE INDEX IF NOT EXISTS idx_mmd_decided
  ON material_match_decisions(decided_at DESC);


-- ============================================================
-- 5) material_estimate_line_links
--    견적 line item ↔ 자재 매칭 연결
-- ============================================================
CREATE TABLE IF NOT EXISTS material_estimate_line_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  estimate_id UUID,
  estimate_line_id TEXT NOT NULL,      -- 클라이언트가 부여한 line ID (consolidated row)
  observation_id UUID REFERENCES material_vision_observations(id),
  material_product_id UUID REFERENCES material_products(id),
  trade_code TEXT,                     -- 17공종 코드
  room_id TEXT,
  room_name TEXT,
  surface_type TEXT,
  quantity NUMERIC,
  unit TEXT,
  unit_price NUMERIC,
  price_source TEXT,
  confidence NUMERIC,
  match_status TEXT NOT NULL CHECK (
    match_status IN ('confirmed','recommended','fallback')
  ),
  fallback_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mell_project
  ON material_estimate_line_links(project_id);

CREATE INDEX IF NOT EXISTS idx_mell_estimate
  ON material_estimate_line_links(estimate_id);


-- ============================================================
-- 6) vision_eval_cases / vision_eval_results
--    평가 harness 데이터셋
-- ============================================================
CREATE TABLE IF NOT EXISTS vision_eval_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_name TEXT NOT NULL,
  project_id UUID,
  room_id TEXT,
  image_url TEXT NOT NULL,
  expected_surfaces JSONB NOT NULL,    -- ground truth surface labels
  expected_materials JSONB,            -- {surface_id: {category, brand, productName, sku}}
  expected_products JSONB,             -- material_product_id list
  expected_estimate_lines JSONB,
  split TEXT NOT NULL DEFAULT 'test' CHECK (split IN ('train','val','test')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vec_dataset
  ON vision_eval_cases(dataset_name, split);

CREATE TABLE IF NOT EXISTS vision_eval_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eval_case_id UUID NOT NULL REFERENCES vision_eval_cases(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  model_versions JSONB,                -- {detector, segmenter, embedding, ocr, vision}
  metrics JSONB NOT NULL,              -- {mAP, IoU, top1, top5, hallucination_rate, ...}
  output JSONB,                        -- 실제 분석 결과 (이미지 + observations + candidates)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ver_run
  ON vision_eval_results(run_id);

CREATE INDEX IF NOT EXISTS idx_ver_case
  ON vision_eval_results(eval_case_id);


-- ============================================================
-- updated_at 트리거 (material_product_images만 — 다른 테이블은 created_at 고정)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_mpi'
  ) THEN
    CREATE TRIGGER set_updated_at_mpi
      BEFORE UPDATE ON material_product_images
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;


-- ============================================================
-- RLS 정책 (service_role만 접근 — 클라이언트는 API 경유)
-- ============================================================
ALTER TABLE material_product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_vision_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_match_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_match_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_estimate_line_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_eval_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_eval_results ENABLE ROW LEVEL SECURITY;

-- material_product_images는 read-only 공개 (제품 카탈로그)
CREATE POLICY mpi_select_public ON material_product_images
  FOR SELECT USING (true);

-- 그 외는 service_role만
CREATE POLICY mvo_service ON material_vision_observations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY mmc_service ON material_match_candidates
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY mmd_service ON material_match_decisions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY mell_service ON material_estimate_line_links
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY vec_service ON vision_eval_cases
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY ver_service ON vision_eval_results
  FOR ALL USING (auth.role() = 'service_role');
