-- ============================================================
-- 소비자 RFQ ↔ 사업자 입찰 연동을 위한 마이그레이션
-- 2026-02-12
-- ============================================================

-- 1. estimates 테이블에 RFQ 관련 컬럼 추가
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS space_type VARCHAR(50);
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS region VARCHAR(50);
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS rfq_data JSONB DEFAULT '{}';
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS consumer_project_id TEXT;

-- 2. estimates.status CHECK 제약조건에 'confirmed' 추가
-- 기존: draft, in_progress, completed, archived
-- 추가: confirmed (소비자 RFQ 제출 시 사업자에게 노출)
ALTER TABLE estimates DROP CONSTRAINT IF EXISTS estimates_status_check;
ALTER TABLE estimates ADD CONSTRAINT estimates_status_check
  CHECK (status IN ('draft', 'confirmed', 'in_progress', 'completed', 'archived'));

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_estimates_region ON estimates(region);
CREATE INDEX IF NOT EXISTS idx_estimates_consumer_project ON estimates(consumer_project_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);

-- 4. 사업자 알림 테이블 (Mock 대체)
CREATE TABLE IF NOT EXISTS contractor_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES specialty_contractors(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'RFQ_NEW', 'BID_SELECTED', 'BID_REJECTED',
    'PAYMENT_RECEIVED', 'PROJECT_UPDATE', 'SYSTEM'
  )),
  title VARCHAR(200) NOT NULL,
  message TEXT,
  priority VARCHAR(10) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  reference_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_contractor ON contractor_notifications(contractor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON contractor_notifications(contractor_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON contractor_notifications(created_at DESC);
