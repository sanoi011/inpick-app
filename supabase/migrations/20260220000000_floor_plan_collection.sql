-- 도면확보시스템 (Track A) 인프라
-- apartments: 아파트 단지 + 동 + 타입 정보
-- floor_plan_library: 수집된 도면 라이브러리
-- collection_jobs: 수집 작업 이력

-- ─── 아파트 단지 ───
CREATE TABLE IF NOT EXISTS apartments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  complex_name TEXT NOT NULL,             -- 단지명 (예: 대전용산4블럭)
  address TEXT,                           -- 주소
  region TEXT,                            -- 지역 (서울/경기/대전 등)
  dong_count INT,                         -- 동 수
  household_count INT,                    -- 세대 수
  completion_year INT,                    -- 준공년도
  developer TEXT,                         -- 시행사
  constructor TEXT,                       -- 시공사
  source TEXT DEFAULT 'manual',           -- 데이터 출처 (manual/crawl/api)
  metadata JSONB DEFAULT '{}',            -- 추가 메타데이터
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 단지명 + 지역으로 유니크 (중복 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_apartments_name_region ON apartments(complex_name, region);

-- ─── 평면도 타입 ───
CREATE TABLE IF NOT EXISTS floor_plan_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
  type_name TEXT NOT NULL,                -- 타입명 (예: 59A, 84A, 84B)
  area_sqm NUMERIC(8,2),                 -- 전용면적 (m²)
  supply_area_sqm NUMERIC(8,2),          -- 공급면적 (m²)
  room_count INT,                        -- 방 수
  bathroom_count INT,                    -- 욕실 수
  is_expanded BOOLEAN DEFAULT false,     -- 확장형 여부
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fpt_apartment ON floor_plan_types(apartment_id);

-- ─── 도면 라이브러리 ───
CREATE TABLE IF NOT EXISTS floor_plan_library (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  floor_plan_type_id UUID REFERENCES floor_plan_types(id) ON DELETE SET NULL,
  apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,

  -- 원본 파일
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'image', 'dwg', 'dxf', 'roomplan', 'photo', 'hand_drawing')),
  source_url TEXT,                        -- Supabase Storage URL 또는 외부 URL
  source_file_name TEXT,
  source_file_size INT,

  -- 파싱 결과
  parsed_data JSONB,                      -- ParsedFloorPlan JSON
  parse_method TEXT,                      -- gemini_vision / pymupdf_hybrid / dxf_parser / roomplan 등
  confidence NUMERIC(3,2) DEFAULT 0,      -- 0.0 ~ 1.0

  -- 품질 평가
  quality_score NUMERIC(3,2) DEFAULT 0,   -- 0.0 ~ 1.0 (종합 품질 점수)
  quality_details JSONB DEFAULT '{}',     -- { wallClosure, areaAccuracy, roomDetection, fixtureDetection }
  is_verified BOOLEAN DEFAULT false,      -- 수동 검증 완료

  -- 메타데이터
  area_sqm NUMERIC(8,2),
  room_count INT,
  wall_count INT,
  door_count INT,
  window_count INT,
  fixture_count INT,

  -- 중복 검사
  fingerprint TEXT,                       -- 구조 핑거프린트 (중복 감지용)
  is_duplicate BOOLEAN DEFAULT false,
  duplicate_of UUID REFERENCES floor_plan_library(id),

  -- 타임스탬프
  collected_at TIMESTAMPTZ DEFAULT now(),
  parsed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,

  -- 수집 출처
  collection_job_id UUID,
  collector_type TEXT                     -- manual_upload / crawl / api / batch
);

CREATE INDEX IF NOT EXISTS idx_fpl_apartment ON floor_plan_library(apartment_id);
CREATE INDEX IF NOT EXISTS idx_fpl_type ON floor_plan_library(floor_plan_type_id);
CREATE INDEX IF NOT EXISTS idx_fpl_fingerprint ON floor_plan_library(fingerprint);
CREATE INDEX IF NOT EXISTS idx_fpl_quality ON floor_plan_library(quality_score DESC);

-- ─── 수집 작업 ───
CREATE TABLE IF NOT EXISTS collection_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL CHECK (job_type IN ('manual_upload', 'batch_parse', 'crawl', 'api_fetch')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  -- 작업 설정
  config JSONB DEFAULT '{}',              -- 수집기 설정 (URL, 필터 등)
  target_apartment_id UUID REFERENCES apartments(id),

  -- 진행 상태
  total_items INT DEFAULT 0,
  processed_items INT DEFAULT 0,
  success_items INT DEFAULT 0,
  failed_items INT DEFAULT 0,

  -- 결과
  result_summary JSONB DEFAULT '{}',       -- 결과 요약
  error_message TEXT,
  logs TEXT[],                            -- 로그 메시지 배열

  -- 타임스탬프
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID                         -- admin user id
);

CREATE INDEX IF NOT EXISTS idx_cj_status ON collection_jobs(status);

-- ─── RLS ───
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plan_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plan_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_jobs ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자가 읽기 가능 (도면 라이브러리는 공개)
CREATE POLICY "apartments_read_all" ON apartments FOR SELECT USING (true);
CREATE POLICY "fpt_read_all" ON floor_plan_types FOR SELECT USING (true);
CREATE POLICY "fpl_read_all" ON floor_plan_library FOR SELECT USING (true);
CREATE POLICY "cj_read_all" ON collection_jobs FOR SELECT USING (true);

-- 쓰기는 service_role만 (서버사이드)
CREATE POLICY "apartments_insert_service" ON apartments FOR INSERT WITH CHECK (true);
CREATE POLICY "apartments_update_service" ON apartments FOR UPDATE USING (true);
CREATE POLICY "fpt_insert_service" ON floor_plan_types FOR INSERT WITH CHECK (true);
CREATE POLICY "fpl_insert_service" ON floor_plan_library FOR INSERT WITH CHECK (true);
CREATE POLICY "fpl_update_service" ON floor_plan_library FOR UPDATE USING (true);
CREATE POLICY "cj_insert_service" ON collection_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "cj_update_service" ON collection_jobs FOR UPDATE USING (true);
