-- contractor_schedules 확장 컬럼 추가
ALTER TABLE contractor_schedules DROP CONSTRAINT IF EXISTS contractor_schedules_contractor_id_date_key;
ALTER TABLE contractor_schedules ADD COLUMN IF NOT EXISTS title VARCHAR(200);
ALTER TABLE contractor_schedules ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(30) DEFAULT 'project'
  CHECK (schedule_type IN ('project','meeting','inspection','delivery','personal','other'));
ALTER TABLE contractor_schedules ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE contractor_schedules ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE contractor_schedules ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES contractor_projects(id) ON DELETE SET NULL;
ALTER TABLE contractor_schedules ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE contractor_schedules ADD COLUMN IF NOT EXISTS workers JSONB DEFAULT '[]';
ALTER TABLE contractor_schedules ADD COLUMN IF NOT EXISTS color VARCHAR(20);

-- 기존 status 제약 수정 (기존 체크 유지 + 새 값 추가)
ALTER TABLE contractor_schedules DROP CONSTRAINT IF EXISTS contractor_schedules_status_check;
ALTER TABLE contractor_schedules ADD CONSTRAINT contractor_schedules_status_check
  CHECK (status IN ('available','booked','tentative','unavailable','scheduled','in_progress','completed','cancelled'));

-- 협업 요청 테이블
CREATE TABLE IF NOT EXISTS collaboration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES specialty_contractors(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES specialty_contractors(id) ON DELETE CASCADE,
  project_id UUID REFERENCES contractor_projects(id) ON DELETE SET NULL,
  message TEXT,
  proposed_amount NUMERIC(14,2),
  proposed_start_date DATE,
  proposed_end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','cancelled')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collab_requester ON collaboration_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_collab_target ON collaboration_requests(target_id);
