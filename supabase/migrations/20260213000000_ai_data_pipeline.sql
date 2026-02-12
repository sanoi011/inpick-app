-- AI 데이터 수집 파이프라인 테이블
-- Phase 1.0: 대화 로깅 + 파싱 이력 + 물량산출 이력 + 시공 사례 + 지식베이스

-- 1. AI 대화 로깅 (RLHF/Fine-tuning용)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_type TEXT NOT NULL DEFAULT 'consumer_design', -- consumer_design, contractor_ai, consult

  -- 대화 내용
  user_message TEXT NOT NULL,
  assistant_response TEXT NOT NULL,

  -- 컨텍스트
  context_type TEXT, -- floor_plan, estimate, project, general
  context_id TEXT, -- 관련 프로젝트/견적 ID
  context_data JSONB DEFAULT '{}', -- 추가 컨텍스트 (이미지 포함 여부, 도면 데이터 등)

  -- 피드백 (사용자 평가)
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  was_helpful BOOLEAN,
  was_accurate BOOLEAN,
  feedback_text TEXT,

  -- 메타
  model_name TEXT DEFAULT 'gemini-2.0-flash',
  response_time_ms INTEGER,
  token_count INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 도면 파싱 이력
CREATE TABLE IF NOT EXISTS floor_plan_parse_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- 입력
  source_type TEXT NOT NULL, -- upload, api, drawing_db
  source_id TEXT, -- drawing ID or file name
  image_url TEXT,

  -- 결과
  parsed_data JSONB, -- ParsedFloorPlan JSON
  room_count INTEGER,
  total_area NUMERIC(10,2),
  parse_method TEXT, -- coco, ai_vision, manual
  confidence_score NUMERIC(4,2),

  -- 품질
  was_corrected BOOLEAN DEFAULT FALSE,
  corrected_data JSONB,
  correction_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 물량산출 이력 (실제비용 추적)
CREATE TABLE IF NOT EXISTS quantity_calculations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id TEXT,
  estimate_id UUID,

  -- 입력 데이터
  floor_plan_data JSONB NOT NULL, -- FloorPlanProject snapshot
  demolition_scope JSONB,

  -- 산출 결과
  quantity_result JSONB NOT NULL, -- QuantityResult
  estimate_result JSONB NOT NULL, -- EstimateResult
  total_items INTEGER,
  grand_total NUMERIC(15,0),

  -- 실제 비용 추적 (시공 완료 후)
  actual_cost NUMERIC(15,0),
  cost_variance_pct NUMERIC(5,2), -- (actual - estimate) / estimate × 100
  variance_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 시공 사례 (Before/After)
CREATE TABLE IF NOT EXISTS construction_cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID,

  -- 프로젝트 정보
  project_name TEXT NOT NULL,
  address TEXT,
  area_sqm NUMERIC(10,2),
  apartment_type TEXT, -- 아파트명 + 평형
  construction_type TEXT, -- 올수리, 부분수리, 확장

  -- 비용
  total_cost NUMERIC(15,0),
  cost_per_sqm NUMERIC(10,0),

  -- Before/After 이미지
  before_images TEXT[] DEFAULT '{}',
  after_images TEXT[] DEFAULT '{}',

  -- 상세
  scope_description TEXT,
  duration_days INTEGER,
  materials_used JSONB DEFAULT '[]',

  -- 메타
  is_verified BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 건설 지식베이스 (LH 표준시방 + 설비 도면)
CREATE TABLE IF NOT EXISTS construction_knowledge (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 소스
  source_type TEXT NOT NULL, -- lh_standard, equipment_drawing, regulation, manual
  source_file TEXT NOT NULL, -- 원본 파일명
  source_page INTEGER, -- 페이지 번호

  -- 내용
  title TEXT,
  content TEXT NOT NULL, -- 텍스트 청크
  category TEXT, -- 건축, 기계, 전기, 설비, 품질
  subcategory TEXT,

  -- 검색용
  keywords TEXT[] DEFAULT '{}',

  -- 메타
  chunk_index INTEGER,
  total_chunks INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ai_conversations_session ON ai_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_agent ON ai_conversations(agent_type);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_rating ON ai_conversations(user_rating) WHERE user_rating IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quantity_calculations_project ON quantity_calculations(project_id);
CREATE INDEX IF NOT EXISTS idx_quantity_calculations_user ON quantity_calculations(user_id);

CREATE INDEX IF NOT EXISTS idx_construction_knowledge_source ON construction_knowledge(source_type);
CREATE INDEX IF NOT EXISTS idx_construction_knowledge_category ON construction_knowledge(category);

-- RLS 정책 (기본적으로 INSERT는 허용, SELECT는 인증 사용자)
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plan_parse_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quantity_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_knowledge ENABLE ROW LEVEL SECURITY;

-- 서비스 역할은 모든 접근 가능
CREATE POLICY "Service role full access" ON ai_conversations FOR ALL USING (true);
CREATE POLICY "Service role full access" ON floor_plan_parse_logs FOR ALL USING (true);
CREATE POLICY "Service role full access" ON quantity_calculations FOR ALL USING (true);
CREATE POLICY "Service role full access" ON construction_cases FOR ALL USING (true);
CREATE POLICY "Service role full access" ON construction_knowledge FOR ALL USING (true);
