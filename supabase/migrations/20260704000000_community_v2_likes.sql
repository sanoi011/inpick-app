-- 2026-07-04: 커뮤니티 v2 — 좋아요 토글 테이블
-- (service-feedback 보드는 REST로 이미 시드됨 — 아래 INSERT는 신규 환경용 멱등 보증)

CREATE TABLE IF NOT EXISTS community_post_likes (
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_post_likes_user
  ON community_post_likes(user_id, created_at DESC);

ALTER TABLE community_post_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "likes_read_all" ON community_post_likes
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "likes_insert_own" ON community_post_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "likes_delete_own" ON community_post_likes
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 서비스 피드백 보드 (멱등)
INSERT INTO community_boards (slug, name, description, board_type, sort_order, is_active, is_public, allow_user_posts, allow_comments)
VALUES ('service-feedback', '서비스 피드백', '인픽 기능 제안·불편 신고 — 팀이 직접 읽고 답합니다', 'general', 90, true, true, true, true)
ON CONFLICT (slug) DO NOTHING;
