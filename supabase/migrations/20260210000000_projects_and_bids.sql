-- bids 메타데이터 컬럼 추가
ALTER TABLE bids ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 프로젝트 테이블
CREATE TABLE IF NOT EXISTS contractor_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  contractor_id UUID NOT NULL REFERENCES specialty_contractors(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning','in_progress','on_hold','completed','cancelled')),
  total_budget NUMERIC(14,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  progress_pct INTEGER DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 프로젝트 공정
CREATE TABLE IF NOT EXISTS project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES contractor_projects(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  phase_order INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','skipped')),
  start_date DATE,
  end_date DATE,
  dependencies JSONB DEFAULT '[]',
  checklist JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 프로젝트 이슈
CREATE TABLE IF NOT EXISTS project_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES contractor_projects(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low','medium','high','critical')),
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','resolved','closed')),
  assigned_to VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 프로젝트 활동 로그
CREATE TABLE IF NOT EXISTS project_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES contractor_projects(id) ON DELETE CASCADE,
  activity_type VARCHAR(30) NOT NULL,
  description TEXT NOT NULL,
  actor VARCHAR(200),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_projects_contractor ON contractor_projects(contractor_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON contractor_projects(status);
CREATE INDEX IF NOT EXISTS idx_project_phases_project ON project_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_project_issues_project ON project_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activities_project ON project_activities(project_id);
