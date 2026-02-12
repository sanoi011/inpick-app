-- 소비자 알림 테이블
CREATE TABLE IF NOT EXISTS consumer_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'BID_RECEIVED', 'BID_SELECTED_CONFIRM', 'CONTRACT_CREATED',
    'CONTRACT_SIGNED', 'PAYMENT_DUE', 'PAYMENT_CONFIRMED',
    'PROJECT_UPDATE', 'PROJECT_COMPLETED', 'SYSTEM'
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

-- RLS
ALTER TABLE consumer_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON consumer_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON consumer_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- 서버 API에서 INSERT 허용 (service_role 사용)
CREATE POLICY "Service can insert notifications"
  ON consumer_notifications FOR INSERT
  WITH CHECK (true);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_consumer_noti_user ON consumer_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_consumer_noti_unread ON consumer_notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_consumer_noti_created ON consumer_notifications(created_at DESC);
