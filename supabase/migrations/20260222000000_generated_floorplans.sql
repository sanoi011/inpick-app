-- Generated floorplans: 실시간 Gemini Pro 파이프라인으로 생성된 도면 캐시
CREATE TABLE IF NOT EXISTS generated_floorplans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  complex_no TEXT NOT NULL,
  complex_name TEXT,
  pyeong_no INTEGER NOT NULL,
  pyeong_name TEXT,
  exclusive_area NUMERIC(8,2),
  original_url TEXT NOT NULL,
  final_url TEXT,
  final_mirror_url TEXT,
  clean_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(complex_no, pyeong_no)
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_generated_floorplans_lookup
  ON generated_floorplans (complex_no, pyeong_no);

CREATE INDEX IF NOT EXISTS idx_generated_floorplans_status
  ON generated_floorplans (status);

-- RLS
ALTER TABLE generated_floorplans ENABLE ROW LEVEL SECURITY;

-- Public read (anyone can see completed floorplans)
CREATE POLICY "generated_floorplans_read" ON generated_floorplans
  FOR SELECT USING (true);

-- Service role insert/update
CREATE POLICY "generated_floorplans_insert" ON generated_floorplans
  FOR INSERT WITH CHECK (true);

CREATE POLICY "generated_floorplans_update" ON generated_floorplans
  FOR UPDATE USING (true);
