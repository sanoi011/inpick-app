-- InPick 커뮤니티 시스템 — 네이버 카페급 구조
-- 가이드: inpick-community-naver-cafe-style-dev-plan-20260514.md
--
-- 목표:
--   * Step3 견적 완료 후 개인정보 제거한 디자인/견적을 공유
--   * 소비자 의견 + 검증 사업자의 견적 제안 + 관리자 모더레이션
--   * 커뮤니티 → 정식 RFQ 전환 경로
--
-- 10 테이블 + RLS + 8 기본 게시판 seed

-- ─── §1. community_boards ─────────────────────────────────
CREATE TABLE IF NOT EXISTS community_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  board_type TEXT NOT NULL DEFAULT 'general',
  -- notice | estimate_share | design_share | apartment | commercial | materials | contractor_qna | review | general
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  allow_user_posts BOOLEAN NOT NULL DEFAULT TRUE,
  allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
  allow_contractor_replies BOOLEAN NOT NULL DEFAULT TRUE,
  require_admin_approval BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_boards_active_sort
  ON community_boards(is_active, sort_order)
  WHERE is_active = TRUE;

-- ─── §2. community_profiles ───────────────────────────────
CREATE TABLE IF NOT EXISTS community_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role_label TEXT NOT NULL DEFAULT '소비자',
  avatar_url TEXT,
  bio TEXT,
  region_label TEXT,
  is_contractor BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified_contractor BOOLEAN NOT NULL DEFAULT FALSE,
  post_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_profiles_contractor
  ON community_profiles(is_verified_contractor)
  WHERE is_verified_contractor = TRUE;

-- ─── §3. community_public_snapshots ──────────────────────
-- Step3 견적의 개인정보 제거된 공개용 스냅샷
CREATE TABLE IF NOT EXISTS community_public_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source_project_id UUID,
  source_estimate_context_id UUID,
  source_estimate_id UUID,
  snapshot_type TEXT NOT NULL,
  -- 'estimate_share' | 'design_share'
  project_mode TEXT NOT NULL,
  -- 'apartment' | 'commercial' | 'photo_only'
  redacted_project JSONB NOT NULL DEFAULT '{}'::jsonb,
  redacted_design_outputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  redacted_estimate_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  redacted_trade_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  redacted_material_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  privacy_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  visibility_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_snapshots_owner
  ON community_public_snapshots(owner_id, created_at DESC);

-- ─── §4. community_posts ──────────────────────────────────
CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES community_boards(id) ON DELETE SET NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_role TEXT NOT NULL DEFAULT 'consumer',
  -- consumer | contractor | verified_contractor | admin
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  -- draft | pending_review | published | hidden | reported | deleted
  visibility TEXT NOT NULL DEFAULT 'public',
  -- public | members_only
  post_type TEXT NOT NULL DEFAULT 'general',
  -- general | estimate_share | design_share | contractor_qna | review | admin_notice
  project_mode TEXT,
  source_project_id UUID,
  source_estimate_context_id UUID,
  source_estimate_id UUID,
  public_snapshot_id UUID REFERENCES community_public_snapshots(id) ON DELETE SET NULL,
  region_label TEXT,
  area_label TEXT,
  building_type TEXT,
  business_type TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  view_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  like_count INT NOT NULL DEFAULT 0,
  bookmark_count INT NOT NULL DEFAULT 0,
  quote_offer_count INT NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_notice BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  converted_rfq_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_posts_board_published
  ON community_posts(board_id, status, is_deleted, created_at DESC)
  WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_community_posts_author
  ON community_posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_pinned
  ON community_posts(board_id, is_pinned, created_at DESC)
  WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_community_posts_type
  ON community_posts(post_type, created_at DESC);

-- ─── §5. community_attachments ────────────────────────────
CREATE TABLE IF NOT EXISTS community_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  attachment_type TEXT NOT NULL,
  -- image | design_output | estimate_preview | pdf_preview | video | file
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  storage_path TEXT,
  width INT,
  height INT,
  file_size INT,
  mime_type TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_attachments_post
  ON community_attachments(post_id, sort_order);

-- ─── §6. community_comments ──────────────────────────────
CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_role TEXT NOT NULL DEFAULT 'consumer',
  content TEXT NOT NULL,
  comment_type TEXT NOT NULL DEFAULT 'comment',
  -- comment | contractor_opinion | admin_reply | quote_interest
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post
  ON community_comments(post_id, created_at)
  WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_community_comments_parent
  ON community_comments(parent_id);

-- ─── §7. community_quote_offers ──────────────────────────
-- 검증 사업자가 커뮤니티 게시글에 남기는 비정식 견적 제안
CREATE TABLE IF NOT EXISTS community_quote_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  contractor_id UUID,
  contractor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  offer_status TEXT NOT NULL DEFAULT 'submitted',
  -- submitted | accepted_by_consumer | rejected_by_consumer | hidden_by_admin | converted_to_rfq
  offer_type TEXT NOT NULL DEFAULT 'rough_opinion',
  -- rough_opinion | range_estimate | site_visit_required | rfq_invite
  amount_min NUMERIC,
  amount_max NUMERIC,
  amount_fixed NUMERIC,
  message TEXT NOT NULL,
  suggested_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  admin_review_status TEXT NOT NULL DEFAULT 'not_required',
  -- not_required | pending | approved | rejected
  admin_reviewed_by UUID,
  admin_reviewed_at TIMESTAMPTZ,
  converted_rfq_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_quote_offers_post
  ON community_quote_offers(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_quote_offers_contractor
  ON community_quote_offers(contractor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_quote_offers_admin_pending
  ON community_quote_offers(admin_review_status)
  WHERE admin_review_status = 'pending';

-- ─── §8. community_reports ───────────────────────────────
CREATE TABLE IF NOT EXISTS community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,
  -- post | comment | quote_offer | profile
  target_id UUID NOT NULL,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  -- open | resolved | dismissed
  handled_by UUID,
  handled_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_reports_open
  ON community_reports(status, created_at DESC)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_community_reports_target
  ON community_reports(target_type, target_id);

-- ─── §9. community_admin_settings ────────────────────────
CREATE TABLE IF NOT EXISTS community_admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기본 설정 seed
INSERT INTO community_admin_settings (key, value) VALUES
  ('postApprovalRequired', 'false'::jsonb),
  ('contractorOfferApprovalRequired', 'true'::jsonb),
  ('allowAnonymousDisplayName', 'true'::jsonb),
  ('maxImagesPerPost', '10'::jsonb),
  ('forbiddenWords', '[]'::jsonb),
  ('privacyAutoScan', 'true'::jsonb),
  ('defaultEstimateShareVisibility', '{"showTotalAmount":true,"showTradeSummary":true,"showDetailedLines":false,"showBrandSku":false,"showDesignImages":true}'::jsonb),
  ('rateLimit', '{"postPerHour":5,"commentPerHour":30,"quoteOfferPerDay":20,"reportPerDay":20,"imagePerPost":10}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─── §10. community_moderation_actions ───────────────────
CREATE TABLE IF NOT EXISTS community_moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID,
  target_type TEXT NOT NULL,
  -- board | post | comment | quote_offer | profile | report
  target_id UUID NOT NULL,
  action TEXT NOT NULL,
  -- hide | delete | restore | pin | unpin | approve | reject | warn
  reason TEXT,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_moderation_target
  ON community_moderation_actions(target_type, target_id, created_at DESC);

-- ─── §11. updated_at 트리거 일괄 ─────────────────────────
DROP TRIGGER IF EXISTS trg_community_boards_updated ON community_boards;
CREATE TRIGGER trg_community_boards_updated
  BEFORE UPDATE ON community_boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_community_profiles_updated ON community_profiles;
CREATE TRIGGER trg_community_profiles_updated
  BEFORE UPDATE ON community_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_community_posts_updated ON community_posts;
CREATE TRIGGER trg_community_posts_updated
  BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_community_comments_updated ON community_comments;
CREATE TRIGGER trg_community_comments_updated
  BEFORE UPDATE ON community_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_community_quote_offers_updated ON community_quote_offers;
CREATE TRIGGER trg_community_quote_offers_updated
  BEFORE UPDATE ON community_quote_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_community_admin_settings_updated ON community_admin_settings;
CREATE TRIGGER trg_community_admin_settings_updated
  BEFORE UPDATE ON community_admin_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── §12. RLS ──────────────────────────────────────────────
ALTER TABLE community_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_quote_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_public_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_moderation_actions ENABLE ROW LEVEL SECURITY;

-- boards: public SELECT, admin write
DROP POLICY IF EXISTS community_boards_public_read ON community_boards;
CREATE POLICY community_boards_public_read
  ON community_boards FOR SELECT
  USING (is_active = TRUE AND is_public = TRUE);

-- profiles: public SELECT, own write
DROP POLICY IF EXISTS community_profiles_public_read ON community_profiles;
CREATE POLICY community_profiles_public_read
  ON community_profiles FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS community_profiles_self_upsert ON community_profiles;
CREATE POLICY community_profiles_self_upsert
  ON community_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS community_profiles_self_update ON community_profiles;
CREATE POLICY community_profiles_self_update
  ON community_profiles FOR UPDATE USING (auth.uid() = user_id);

-- posts: published 공개 + 본인 글 / authenticated INSERT / 본인 UPDATE+DELETE
DROP POLICY IF EXISTS community_posts_public_read ON community_posts;
CREATE POLICY community_posts_public_read
  ON community_posts FOR SELECT
  USING (
    is_deleted = FALSE
    AND status IN ('published', 'pending_review')
    AND (visibility = 'public' OR auth.uid() = author_id)
  );
DROP POLICY IF EXISTS community_posts_author_insert ON community_posts;
CREATE POLICY community_posts_author_insert
  ON community_posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS community_posts_author_update ON community_posts;
CREATE POLICY community_posts_author_update
  ON community_posts FOR UPDATE
  USING (auth.uid() = author_id);
DROP POLICY IF EXISTS community_posts_author_delete ON community_posts;
CREATE POLICY community_posts_author_delete
  ON community_posts FOR DELETE
  USING (auth.uid() = author_id);

-- attachments: public_only READ + uploader 본인
DROP POLICY IF EXISTS community_attachments_public_read ON community_attachments;
CREATE POLICY community_attachments_public_read
  ON community_attachments FOR SELECT
  USING (is_public = TRUE OR auth.uid() = uploader_id);
DROP POLICY IF EXISTS community_attachments_uploader_insert ON community_attachments;
CREATE POLICY community_attachments_uploader_insert
  ON community_attachments FOR INSERT
  WITH CHECK (auth.uid() = uploader_id);
DROP POLICY IF EXISTS community_attachments_uploader_delete ON community_attachments;
CREATE POLICY community_attachments_uploader_delete
  ON community_attachments FOR DELETE
  USING (auth.uid() = uploader_id);

-- comments: 미삭제 공개 READ, 본인 작성/삭제
DROP POLICY IF EXISTS community_comments_public_read ON community_comments;
CREATE POLICY community_comments_public_read
  ON community_comments FOR SELECT
  USING (is_deleted = FALSE);
DROP POLICY IF EXISTS community_comments_author_insert ON community_comments;
CREATE POLICY community_comments_author_insert
  ON community_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS community_comments_author_update ON community_comments;
CREATE POLICY community_comments_author_update
  ON community_comments FOR UPDATE
  USING (auth.uid() = author_id);
DROP POLICY IF EXISTS community_comments_author_delete ON community_comments;
CREATE POLICY community_comments_author_delete
  ON community_comments FOR DELETE
  USING (auth.uid() = author_id);

-- quote_offers: post 작성자 + 본인 사업자 + 관리자 READ, 본인만 작성/수정
DROP POLICY IF EXISTS community_quote_offers_visible_read ON community_quote_offers;
CREATE POLICY community_quote_offers_visible_read
  ON community_quote_offers FOR SELECT
  USING (
    offer_status != 'hidden_by_admin'
    AND (
      auth.uid() = contractor_user_id
      OR auth.uid() IN (
        SELECT author_id FROM community_posts WHERE id = post_id
      )
    )
  );
DROP POLICY IF EXISTS community_quote_offers_contractor_insert ON community_quote_offers;
CREATE POLICY community_quote_offers_contractor_insert
  ON community_quote_offers FOR INSERT
  WITH CHECK (auth.uid() = contractor_user_id);
DROP POLICY IF EXISTS community_quote_offers_contractor_update ON community_quote_offers;
CREATE POLICY community_quote_offers_contractor_update
  ON community_quote_offers FOR UPDATE
  USING (auth.uid() = contractor_user_id);

-- reports: 본인 작성 READ, 본인만 INSERT (해결은 admin service role)
DROP POLICY IF EXISTS community_reports_self_read ON community_reports;
CREATE POLICY community_reports_self_read
  ON community_reports FOR SELECT
  USING (auth.uid() = reporter_id);
DROP POLICY IF EXISTS community_reports_self_insert ON community_reports;
CREATE POLICY community_reports_self_insert
  ON community_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- snapshots: 본인 작성 + post 공개 시 READ
DROP POLICY IF EXISTS community_snapshots_owner_read ON community_public_snapshots;
CREATE POLICY community_snapshots_owner_read
  ON community_public_snapshots FOR SELECT
  USING (
    auth.uid() = owner_id
    OR id IN (
      SELECT public_snapshot_id FROM community_posts
      WHERE is_deleted = FALSE AND status = 'published' AND visibility = 'public'
    )
  );
DROP POLICY IF EXISTS community_snapshots_owner_insert ON community_public_snapshots;
CREATE POLICY community_snapshots_owner_insert
  ON community_public_snapshots FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- admin_settings + moderation_actions: 모든 작업 service role 전용 (RLS 비공개)
-- (RLS 활성화만 + 정책 없음 → 클라이언트 차단)

COMMENT ON TABLE community_boards IS '커뮤니티 게시판 — 8 기본 + 관리자 추가';
COMMENT ON TABLE community_posts IS '커뮤니티 게시글 — Step3 견적 공유 게시글 포함';
COMMENT ON TABLE community_public_snapshots IS 'Step3 견적의 개인정보 제거된 공개 스냅샷';
COMMENT ON TABLE community_quote_offers IS '검증 사업자의 비정식 견적 제안';

-- ─── §13. 기본 게시판 8개 seed ───────────────────────────
INSERT INTO community_boards (slug, name, description, board_type, sort_order, allow_user_posts, allow_contractor_replies) VALUES
  ('notice',          '공지사항',         'INPICK 공식 공지', 'notice',          10,  FALSE, FALSE),
  ('estimate-share',  '견적 공유',        'AI 견적을 공유하고 의견 받기 (개인정보 자동 제거)', 'estimate_share',  20,  TRUE,  TRUE),
  ('design-share',    'AI 디자인 공유',   'AI로 만든 디자인 시안 공유', 'design_share',    30,  TRUE,  TRUE),
  ('apartment',       '아파트 인테리어',   '평형/확장/방별 질문과 사례', 'apartment',       40,  TRUE,  TRUE),
  ('commercial',      '상가·사무실',       '카페/식당/미용실/학원/오피스', 'commercial',      50,  TRUE,  TRUE),
  ('materials',       '자재·브랜드 질문', '강마루/타일/도배/싱크대/수전 등', 'materials',       60,  TRUE,  TRUE),
  ('contractor-qna',  '업체에게 물어보기', '검증 사업자에게 공개 상담', 'contractor_qna',  70,  TRUE,  TRUE),
  ('reviews',         '시공 후기',         '실제 시공 후기와 사진', 'review',          80,  TRUE,  TRUE)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  board_type = EXCLUDED.board_type,
  sort_order = EXCLUDED.sort_order,
  allow_user_posts = EXCLUDED.allow_user_posts,
  allow_contractor_replies = EXCLUDED.allow_contractor_replies;
