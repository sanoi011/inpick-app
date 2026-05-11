-- Commercial 모드 + Editable Render Layer (V2-A/B)
-- 가이드: c:\Users\user\Downloads\inpick-commercial-editable-render-workflow-plan-20260511.md §9
-- 작성일: 2026-05-11

-- ============================================================
-- 1) commercial_project_specs — 상가 프로그램 (Step1 입력)
-- ============================================================
CREATE TABLE IF NOT EXISTS commercial_project_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id UUID,
  business_type TEXT NOT NULL,
  area_m2 NUMERIC,
  ceiling_height_mm INTEGER,
  front_width_mm INTEGER,
  depth_mm INTEGER,
  spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commercial_specs_project ON commercial_project_specs(project_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_commercial_specs') THEN
    CREATE TRIGGER set_updated_at_commercial_specs
      BEFORE UPDATE ON commercial_project_specs
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;


-- ============================================================
-- 2) editable_renders — 1차 AI 렌더 + 메타
-- ============================================================
CREATE TABLE IF NOT EXISTS editable_renders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  render_id TEXT,
  target_id TEXT NOT NULL,
  target_name_ko TEXT,
  project_mode TEXT NOT NULL CHECK (project_mode IN ('residential', 'commercial')),
  image_url TEXT NOT NULL,
  image_width INTEGER,
  image_height INTEGER,
  render_spec JSONB DEFAULT '{}'::jsonb,
  layer_summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_editable_renders_project ON editable_renders(project_id);


-- ============================================================
-- 3) editable_render_layers — 부위별 polygon/mask
-- ============================================================
CREATE TABLE IF NOT EXISTS editable_render_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  editable_render_id UUID NOT NULL REFERENCES editable_renders(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  target_id TEXT NOT NULL,
  surface_type TEXT NOT NULL,           -- floor / wall / ceiling / window / door / counter / signage 등
  label_ko TEXT NOT NULL,
  label_en TEXT,
  instance_index INTEGER DEFAULT 0,      -- wall_back_001 같은 고유 ID 만들 때 사용
  polygon JSONB NOT NULL,                -- [{x, y}, ...] normalized 0~1
  bbox JSONB NOT NULL,                   -- { x, y, width, height }
  mask_url TEXT,                         -- Supabase Storage
  z_index INTEGER DEFAULT 0,
  plane TEXT,                            -- 'floor' | 'left_wall' | 'right_wall' | 'back_wall' | 'ceiling' | 'object'
  area_m2 NUMERIC,
  confidence NUMERIC NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'merged',
  material_product_id UUID,
  material_label TEXT,
  estimate_line_ids JSONB DEFAULT '[]'::jsonb,
  locked BOOLEAN DEFAULT FALSE,
  warnings JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_editable_layers_render ON editable_render_layers(editable_render_id);
CREATE INDEX IF NOT EXISTS idx_editable_layers_surface ON editable_render_layers(surface_type);
CREATE INDEX IF NOT EXISTS idx_editable_layers_project ON editable_render_layers(project_id);


-- ============================================================
-- 4) render_material_edits — 자재 변경 audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS render_material_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  editable_render_id UUID NOT NULL REFERENCES editable_renders(id) ON DELETE CASCADE,
  layer_id UUID NOT NULL REFERENCES editable_render_layers(id) ON DELETE CASCADE,
  material_product_id UUID,
  previous_material_product_id UUID,
  preview_image_url TEXT,
  method TEXT NOT NULL,                  -- 'texture_warp' | 'inpaint' | 'replace'
  estimate_delta JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_render_material_edits_layer ON render_material_edits(layer_id);
CREATE INDEX IF NOT EXISTS idx_render_material_edits_project ON render_material_edits(project_id);


-- ============================================================
-- RLS — service_role admin client 사용
-- ============================================================
ALTER TABLE commercial_project_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE editable_renders ENABLE ROW LEVEL SECURITY;
ALTER TABLE editable_render_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE render_material_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY cps_service ON commercial_project_specs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY er_service ON editable_renders FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY erl_service ON editable_render_layers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY rme_service ON render_material_edits FOR ALL USING (auth.role() = 'service_role');

-- 소비자 본인 read
CREATE POLICY er_consumer_read ON editable_renders
  FOR SELECT USING (project_id IN (SELECT id FROM consumer_projects WHERE user_id = auth.uid()));
CREATE POLICY erl_consumer_read ON editable_render_layers
  FOR SELECT USING (project_id IN (SELECT id FROM consumer_projects WHERE user_id = auth.uid()));


-- ============================================================
-- Comment
-- ============================================================
COMMENT ON TABLE commercial_project_specs IS
  'V2-A — Step1 상가 모드 입력 (업종/면적/층고/시스템 요구사항).';
COMMENT ON TABLE editable_renders IS
  'V2-B — 1차 AI 렌더 이미지 + project_mode + render_spec 메타.';
COMMENT ON TABLE editable_render_layers IS
  'V2-B — 부위별 polygon/mask. 사용자 클릭 hit-test + 자재 변경.';
COMMENT ON TABLE render_material_edits IS
  'V2-B — 자재 변경 audit log + preview/method/estimate_delta.';
