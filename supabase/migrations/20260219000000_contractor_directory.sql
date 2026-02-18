-- 사업자 디렉토리: 업체 유형 분류 + 공개 프로필 + 문의

-- specialty_contractors 테이블에 컬럼 추가
ALTER TABLE specialty_contractors
  ADD COLUMN IF NOT EXISTS contractor_type VARCHAR(20) DEFAULT 'specialty'
    CHECK (contractor_type IN ('general', 'specialty')),
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'basic', 'premium', 'enterprise')),
  ADD COLUMN IF NOT EXISTS min_project_budget NUMERIC(14,0),
  ADD COLUMN IF NOT EXISTS max_project_budget NUMERIC(14,0),
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inquiry_count INTEGER DEFAULT 0;

-- 디렉토리 쿼리 인덱스
CREATE INDEX IF NOT EXISTS idx_contractors_type ON specialty_contractors(contractor_type);
CREATE INDEX IF NOT EXISTS idx_contractors_public ON specialty_contractors(is_public, is_active);
CREATE INDEX IF NOT EXISTS idx_contractors_featured ON specialty_contractors(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_contractors_rating ON specialty_contractors(rating DESC);

-- 업체 문의 테이블
CREATE TABLE IF NOT EXISTS contractor_inquiries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id   UUID NOT NULL REFERENCES specialty_contractors(id) ON DELETE CASCADE,
  consumer_id     UUID,
  consumer_name   VARCHAR(200),
  consumer_phone  VARCHAR(30),
  consumer_email  VARCHAR(200),
  message         TEXT,
  project_type    VARCHAR(50),
  estimated_budget VARCHAR(50),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'converted', 'closed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_contractor ON contractor_inquiries(contractor_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON contractor_inquiries(status);
