-- 소비자 프로젝트 Supabase 동기화

CREATE TABLE IF NOT EXISTS consumer_projects (
  id UUID PRIMARY KEY,                           -- 클라이언트 UUID 그대로 사용
  user_id UUID REFERENCES auth.users(id),
  status VARCHAR(30) DEFAULT 'ADDRESS_SELECTION',
  address JSONB,                                  -- ProjectAddress
  drawing_id VARCHAR(100),
  estimate_id UUID,
  design_state JSONB,                             -- decisions, chat 메타 (이미지 base64 제외)
  rendering_state JSONB,                          -- materials, confirmed rooms
  estimate_state JSONB,                           -- ProjectEstimate
  rfq_state JSONB,                                -- ProjectRfq
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE consumer_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consumer projects"
  ON consumer_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own consumer projects"
  ON consumer_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own consumer projects"
  ON consumer_projects FOR UPDATE
  USING (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_consumer_projects_user_id ON consumer_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_consumer_projects_status ON consumer_projects(status);
