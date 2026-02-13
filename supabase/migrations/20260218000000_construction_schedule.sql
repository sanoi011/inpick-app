-- 공정표 스케줄 확장

-- project_phases에 스케줄 컬럼 추가
ALTER TABLE project_phases
  ADD COLUMN IF NOT EXISTS duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS weight NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS trade_codes JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS color VARCHAR(20),
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]';

-- contractor_projects에 스케줄 생성 시점
ALTER TABLE contractor_projects
  ADD COLUMN IF NOT EXISTS schedule_generated_at TIMESTAMPTZ;

-- 공종별 세부 작업 (공정 하위)
CREATE TABLE IF NOT EXISTS schedule_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES project_phases(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES contractor_projects(id) ON DELETE CASCADE,
  trade_code VARCHAR(30),
  name VARCHAR(200) NOT NULL,
  start_date DATE,
  end_date DATE,
  duration_days INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_tasks_phase ON schedule_tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_schedule_tasks_project ON schedule_tasks(project_id);

-- RLS
ALTER TABLE schedule_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on schedule_tasks"
  ON schedule_tasks USING (auth.role() = 'service_role');
