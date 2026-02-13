-- 도면 인식 로그 테이블
-- 각 도면 파싱 시도를 기록하여 정확도 개선에 활용

CREATE TABLE IF NOT EXISTS drawing_parse_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT,
  user_id UUID REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- pdf, png, jpg, dxf
  file_size_bytes INTEGER,

  -- 파싱 결과
  parse_method TEXT NOT NULL, -- gemini_vision, dxf_parser, mock
  result_json JSONB, -- ParsedFloorPlan JSON
  confidence_score REAL,
  warnings TEXT[],

  -- 성능 메트릭
  processing_time_ms INTEGER,
  gemini_tokens_used INTEGER,

  -- 메타데이터
  known_area_m2 REAL, -- 입력된 전용면적
  detected_area_m2 REAL, -- 감지된 총면적
  room_count INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_drawing_parse_logs_user ON drawing_parse_logs(user_id);
CREATE INDEX idx_drawing_parse_logs_method ON drawing_parse_logs(parse_method);
CREATE INDEX idx_drawing_parse_logs_created ON drawing_parse_logs(created_at DESC);

-- RLS 정책
ALTER TABLE drawing_parse_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own parse logs"
  ON drawing_parse_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own parse logs"
  ON drawing_parse_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 서비스 역할은 모든 로그 접근 가능 (관리자용)
CREATE POLICY "Service role full access"
  ON drawing_parse_logs
  USING (auth.role() = 'service_role');
