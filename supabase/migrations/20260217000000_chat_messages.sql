-- 실시간 채팅 메시지 테이블
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL, -- contract_id or estimate_id 기반
  sender_id TEXT NOT NULL, -- user_id or contractor_id
  sender_type TEXT NOT NULL CHECK (sender_type IN ('consumer', 'contractor')),
  sender_name TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_chat_messages_room ON chat_messages(room_id, created_at DESC);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_unread ON chat_messages(room_id, is_read) WHERE is_read = FALSE;

-- 채팅 방 테이블 (메타데이터)
CREATE TABLE IF NOT EXISTS chat_rooms (
  id TEXT PRIMARY KEY, -- contract_id or estimate_id
  consumer_id UUID REFERENCES auth.users(id),
  contractor_id UUID,
  contract_id UUID,
  estimate_id UUID,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_rooms_consumer ON chat_rooms(consumer_id);
CREATE INDEX idx_chat_rooms_contractor ON chat_rooms(contractor_id);

-- RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;

-- 서비스 역할 전체 접근
CREATE POLICY "Service role full access on chat_messages"
  ON chat_messages USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on chat_rooms"
  ON chat_rooms USING (auth.role() = 'service_role');

-- 참여자만 메시지 조회
CREATE POLICY "Participants can view chat messages"
  ON chat_messages FOR SELECT
  USING (
    room_id IN (
      SELECT id FROM chat_rooms
      WHERE consumer_id = auth.uid()
         OR contractor_id = auth.uid()::uuid
    )
  );

-- 참여자만 메시지 작성
CREATE POLICY "Participants can insert chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    room_id IN (
      SELECT id FROM chat_rooms
      WHERE consumer_id = auth.uid()
         OR contractor_id = auth.uid()::uuid
    )
  );

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
