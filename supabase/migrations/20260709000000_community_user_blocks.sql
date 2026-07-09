-- 사용자 차단 (Apple 심사 Guideline 1.2 — UGC 안전장치)
-- 차단하면: ①피드/댓글에서 해당 사용자 콘텐츠 즉시 제외 ②운영팀에 신고 자동 접수
CREATE TABLE IF NOT EXISTS community_user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_user_blocks_blocker
  ON community_user_blocks(blocker_id);

ALTER TABLE community_user_blocks ENABLE ROW LEVEL SECURITY;

-- 본인 차단 목록만 조회/생성/해제 가능
DROP POLICY IF EXISTS "blocks_select_own" ON community_user_blocks;
CREATE POLICY "blocks_select_own" ON community_user_blocks
  FOR SELECT USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocks_insert_own" ON community_user_blocks;
CREATE POLICY "blocks_insert_own" ON community_user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id AND auth.uid() <> blocked_user_id);

DROP POLICY IF EXISTS "blocks_delete_own" ON community_user_blocks;
CREATE POLICY "blocks_delete_own" ON community_user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);
