-- 2026-05-19: 자체 회원관리 안전 인프라
-- 가이드: INPICK_MOBILE_APP_STORE_PAYMENT_CENTRAL_TOWER_AUTH_INCLUDED_DEV_PLAN_20260519.md §0-A
--
-- 원칙:
--   * 주민등록번호 입력/저장/대조 금지
--   * OTP 미사용 회원DB 대조형 복구 (이메일+이름+휴대폰)
--   * 모든 시도 audit log
--   * 2-step recovery: verify → challenge → reset
--   * rate limit + lock
--   * 계정 존재 여부 노출 X

-- ─── §1. auth_audit_events ──────────────────────────
-- 회원가입/로그인/복구/프로필 변경 등 모든 인증 이벤트 기록

CREATE TABLE IF NOT EXISTS auth_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'consumer',
  provider TEXT,
  email_hash TEXT,
  phone_hash TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  result TEXT NOT NULL,
  error_code TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_audit_events_user_idx ON auth_audit_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_audit_events_event_idx ON auth_audit_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_audit_events_email_hash_idx ON auth_audit_events(email_hash, created_at DESC) WHERE email_hash IS NOT NULL;

COMMENT ON TABLE auth_audit_events IS '인증 이벤트 audit log — signup/login/recovery 모든 시도 기록. PII는 hash로 저장';

-- ─── §2. password_recovery_challenges ───────────────
-- 2-step recovery flow의 임시 토큰 저장 (verify 성공 시 발급, reset 시 검증)

CREATE TABLE IF NOT EXISTS password_recovery_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_hash TEXT NOT NULL UNIQUE,
  email_hash TEXT,
  phone_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT password_recovery_challenges_status_check
    CHECK (status IN ('pending', 'used', 'expired', 'revoked'))
);

CREATE INDEX IF NOT EXISTS password_recovery_challenges_user_idx ON password_recovery_challenges(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS password_recovery_challenges_expires_idx ON password_recovery_challenges(expires_at) WHERE status = 'pending';

COMMENT ON TABLE password_recovery_challenges IS '비밀번호 복구 챌린지 — verify 단계 성공 후 발급, reset 시 검증. 유효시간 10분, 1회 사용';

-- ─── §3. member_reconciliation_cases ────────────────
-- 회원 데이터 정합성 이슈 (auth/profile 불일치, RLS 거부, 복구 시도 abuse 등)

CREATE TABLE IF NOT EXISTS member_reconciliation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  case_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  email_hash TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT member_reconciliation_severity_check
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT member_reconciliation_status_check
    CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS member_reconciliation_status_idx ON member_reconciliation_cases(status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS member_reconciliation_user_idx ON member_reconciliation_cases(user_id, created_at DESC) WHERE user_id IS NOT NULL;

COMMENT ON TABLE member_reconciliation_cases IS '회원 정합성 이슈 case 큐 — 관리자가 /admin/members에서 처리';

-- ─── §4. consumer_profiles 보강 ─────────────────────

ALTER TABLE consumer_profiles
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS recovery_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS self_signup_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_status TEXT NOT NULL DEFAULT 'active';

UPDATE consumer_profiles SET self_signup_completed_at = created_at WHERE self_signup_completed_at IS NULL;

COMMENT ON COLUMN consumer_profiles.recovery_enabled IS '자체 비밀번호 복구 가능 여부 (관리자가 abuse 의심 사용자 차단 가능)';
COMMENT ON COLUMN consumer_profiles.profile_status IS 'active / blocked / pending_recovery 등';

-- ─── §5. RLS — audit/challenge는 service role only ─

ALTER TABLE auth_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_recovery_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_reconciliation_cases ENABLE ROW LEVEL SECURITY;

-- 사용자는 본인 audit event만 SELECT
CREATE POLICY "auth_audit_events_select_own"
  ON auth_audit_events FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자는 본인 challenge SELECT만 (관리용)
CREATE POLICY "password_recovery_challenges_select_own"
  ON password_recovery_challenges FOR SELECT
  USING (auth.uid() = user_id);

-- member_reconciliation_cases는 service role만 (관리자 API 통해서만)
-- 정책 미생성 = 차단

-- ─── §6. 트리거 — auth_audit_events updated_at 없음 (immutable) ──

-- 완료 알림
DO $$
DECLARE
  v_audit INT; v_ch INT; v_mr INT;
BEGIN
  SELECT COUNT(*) INTO v_audit FROM auth_audit_events;
  SELECT COUNT(*) INTO v_ch FROM password_recovery_challenges;
  SELECT COUNT(*) INTO v_mr FROM member_reconciliation_cases;
  RAISE NOTICE '[migration 20260519100000] audit=%, challenges=%, member_cases=%', v_audit, v_ch, v_mr;
END $$;
