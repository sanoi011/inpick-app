-- 문의사항 테이블
CREATE TABLE IF NOT EXISTS contact_inquiries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(200) NOT NULL,
  subject     VARCHAR(500),
  email       VARCHAR(200) NOT NULL,
  phone       VARCHAR(30),
  message     TEXT NOT NULL,
  status      VARCHAR(20) DEFAULT 'pending'
              CHECK (status IN ('pending', 'replied', 'closed')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
