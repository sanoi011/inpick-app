-- 시공도면 생성 시스템 테이블
-- construction_drawing_sets: 도면 세트 (계약당 1개)
-- construction_drawings: 개별 도면 (세트당 6~10개)

CREATE TABLE IF NOT EXISTS construction_drawing_sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES contracts(id),
  consumer_project_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  pdf_url TEXT,
  total_pages INT NOT NULL DEFAULT 0,
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message TEXT,
  processing_time_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_contract_drawing_set UNIQUE (contract_id)
);

CREATE TABLE IF NOT EXISTS construction_drawings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  set_id UUID NOT NULL REFERENCES construction_drawing_sets(id) ON DELETE CASCADE,
  drawing_type TEXT NOT NULL CHECK (drawing_type IN (
    'cover_page', 'furniture_layout', 'electrical_plan',
    'elevation_living', 'elevation_kitchen', 'elevation_master_bed',
    'elevation_bathroom1', 'elevation_bathroom2', 'elevation_bed'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  svg_url TEXT,
  ai_enhanced_url TEXT,
  final_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  processing_time_ms INT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_drawing_sets_contract ON construction_drawing_sets(contract_id);
CREATE INDEX IF NOT EXISTS idx_drawings_set_id ON construction_drawings(set_id);
CREATE INDEX IF NOT EXISTS idx_drawings_type ON construction_drawings(drawing_type);

-- RLS
ALTER TABLE construction_drawing_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_drawings ENABLE ROW LEVEL SECURITY;

-- 서비스 키로 전체 접근
CREATE POLICY "Service key full access to drawing sets"
  ON construction_drawing_sets FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service key full access to drawings"
  ON construction_drawings FOR ALL
  USING (true) WITH CHECK (true);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_drawing_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_drawing_set_updated_at
  BEFORE UPDATE ON construction_drawing_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_drawing_set_updated_at();
