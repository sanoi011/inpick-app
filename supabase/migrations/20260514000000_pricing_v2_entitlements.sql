-- INPICK Pricing v2: 토큰 1개=500원 + 회원가입 10토큰 + PDF 9,900원 + entitlements
-- 가이드: 2026-05-14 — 토스페이먼츠 입점 심사 대응 단가 단일화
--
-- 호환 환경:
--   * 적용 가정: user_credits (20260211) + token_wallets/token_ledger (20260512) — 모두 운영 DB에 존재
--   * user_tokens (20260426) 은 *적용되지 않은* 상태로 가정. 참조 자체를 하지 않음.
--
-- 정책:
--   * payment_products 기존 행 UPDATE (단가만 변경)
--   * 견적서 PDF 단발 다운로드 상품 신규 (estimate_pdf_single, 9,900원 부가세 포함)
--   * 회원가입 시 token_wallets + user_credits 양쪽에 +10 보너스
--   * 기존 사용자 backfill: wallet balance 10 미만이면 10까지 보충 (idempotency_key 'signup:{userId}')
--   * user_entitlements 신규 (pdf_unlimited / estimate_pdf_single)

-- ─── §1. payment_products: 가격 v2 반영 (기존 행 UPDATE) ─────────────
UPDATE payment_products SET
  name_ko = '토큰 10개',
  description_ko = '이미지 10장 생성 (1장 = 1토큰, 1개당 500원)',
  amount_krw = 5000,
  credit_amount = 10,
  bonus_credit_amount = 0,
  sort_order = 10,
  is_active = TRUE
WHERE code = 'ai_credit_10';

UPDATE payment_products SET
  name_ko = '토큰 30개 + 보너스 3개',
  description_ko = '인기 — 보너스 3개 (총 33개)',
  amount_krw = 15000,
  credit_amount = 30,
  bonus_credit_amount = 3,
  sort_order = 20,
  is_active = TRUE
WHERE code = 'ai_credit_30';

UPDATE payment_products SET
  name_ko = '토큰 100개 + 보너스 15개',
  description_ko = '상가/사무실 추천 — 보너스 15개 (총 115개)',
  amount_krw = 50000,
  credit_amount = 100,
  bonus_credit_amount = 15,
  sort_order = 30,
  is_active = TRUE
WHERE code = 'ai_credit_100';

-- 신규 패키지: 300개 (대량) — 기존에 없으면 INSERT
INSERT INTO payment_products
  (code, product_type, name_ko, description_ko, amount_krw, credit_amount, bonus_credit_amount, sort_order, is_active)
VALUES
  ('ai_credit_300', 'ai_credit_pack', '토큰 300개 + 보너스 60개', '대규모 프로젝트용 — 보너스 60개', 150000, 300, 60, 40, TRUE)
ON CONFLICT (code) DO UPDATE SET
  name_ko = EXCLUDED.name_ko,
  description_ko = EXCLUDED.description_ko,
  amount_krw = EXCLUDED.amount_krw,
  credit_amount = EXCLUDED.credit_amount,
  bonus_credit_amount = EXCLUDED.bonus_credit_amount,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- 신규 상품: 견적서 PDF 단발 다운로드 (9,900원 부가세 포함)
INSERT INTO payment_products
  (code, product_type, name_ko, description_ko, amount_krw, credit_amount, bonus_credit_amount, sort_order, is_active, metadata)
VALUES
  ('estimate_pdf_single', 'pdf_estimate_single', '견적서 PDF 다운로드', '단일 견적서 1회 다운로드 권한 (부가세 포함)', 9900, 0, 0, 100, TRUE,
   '{"entitlement_type":"estimate_pdf_single","includes_vat":true}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name_ko = EXCLUDED.name_ko,
  description_ko = EXCLUDED.description_ko,
  amount_krw = EXCLUDED.amount_krw,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata;

-- ─── §2. 회원가입 보너스 토큰 10개 자동 지급 함수 ─────────────────
-- token_wallets + user_credits 양쪽에 +10 (idempotent)
CREATE OR REPLACE FUNCTION grant_signup_tokens_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_idempotency_key TEXT := 'signup:' || NEW.id::text;
  v_existing_count INT;
BEGIN
  -- 중복 방지: 이미 signup 보너스 받았는지 token_ledger로 확인
  SELECT COUNT(*) INTO v_existing_count
    FROM token_ledger
    WHERE idempotency_key = v_idempotency_key;
  IF v_existing_count > 0 THEN
    RETURN NEW;
  END IF;

  -- 1) token_wallets에 +10 (promo balance)
  INSERT INTO token_wallets (user_id, balance, paid_balance, promo_balance, total_purchased)
    VALUES (NEW.id, 10, 0, 10, 10)
    ON CONFLICT (user_id) DO UPDATE SET
      promo_balance = token_wallets.promo_balance + 10,
      balance = token_wallets.balance + 10,
      total_purchased = token_wallets.total_purchased + 10,
      updated_at = NOW();

  -- 2) token_ledger 기록 (idempotency_key UNIQUE로 중복 차단)
  INSERT INTO token_ledger
    (user_id, entry_type, delta, paid_delta, promo_delta, balance_after,
     source_type, idempotency_key, reason_ko, metadata)
  VALUES
    (NEW.id, 'bonus_credit', 10, 0, 10,
     (SELECT balance FROM token_wallets WHERE user_id = NEW.id),
     'promo', v_idempotency_key, '회원가입 보너스 토큰 10개',
     '{"event":"signup","version":"pricing_v2"}'::jsonb);

  -- 3) 레거시 user_credits 동기화 (useCredits 훅 + enforceConsume 폴백 경로)
  INSERT INTO user_credits (user_id, balance, free_generations_used)
    VALUES (NEW.id, 10, 0)
    ON CONFLICT (user_id) DO UPDATE SET
      balance = user_credits.balance + 10,
      updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION grant_signup_tokens_v2() IS
  '회원가입 시 토큰 10개 자동 지급 (2026-05-14 pricing v2). token_wallets + user_credits 양쪽 갱신.';

-- consumer_profiles INSERT 시 자동 호출
DROP TRIGGER IF EXISTS trg_grant_signup_tokens_v2 ON consumer_profiles;
CREATE TRIGGER trg_grant_signup_tokens_v2
  AFTER INSERT ON consumer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION grant_signup_tokens_v2();

-- ─── §3. 기존 사용자 backfill: 보너스 10개 일괄 지급 ───────────────
-- 이미 token_ledger에 'signup:{userId}' 기록 있는 사용자는 skip
-- 없는 사용자는 +10 부여 (token_wallets + token_ledger + user_credits 동기화)
DO $$
DECLARE
  r RECORD;
  v_new_balance INT;
BEGIN
  FOR r IN
    SELECT cp.id AS user_id
    FROM consumer_profiles cp
    WHERE NOT EXISTS (
      SELECT 1 FROM token_ledger tl
       WHERE tl.idempotency_key = 'signup:' || cp.id::text
    )
  LOOP
    BEGIN
      -- token_wallets에 +10
      INSERT INTO token_wallets (user_id, balance, paid_balance, promo_balance, total_purchased)
        VALUES (r.user_id, 10, 0, 10, 10)
        ON CONFLICT (user_id) DO UPDATE SET
          promo_balance = token_wallets.promo_balance + 10,
          balance = token_wallets.balance + 10,
          total_purchased = token_wallets.total_purchased + 10,
          updated_at = NOW();

      SELECT balance INTO v_new_balance FROM token_wallets WHERE user_id = r.user_id;

      INSERT INTO token_ledger
        (user_id, entry_type, delta, paid_delta, promo_delta, balance_after,
         source_type, idempotency_key, reason_ko, metadata)
      VALUES
        (r.user_id, 'bonus_credit', 10, 0, 10, v_new_balance,
         'promo', 'signup:' || r.user_id::text,
         '회원가입 보너스 토큰 10개 (소급)',
         '{"event":"signup_backfill","version":"pricing_v2"}'::jsonb);

      -- user_credits에도 +10
      INSERT INTO user_credits (user_id, balance, free_generations_used)
        VALUES (r.user_id, 10, 0)
        ON CONFLICT (user_id) DO UPDATE SET
          balance = user_credits.balance + 10,
          updated_at = NOW();
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'signup backfill failed for user %: %', r.user_id, SQLERRM;
    END;
  END LOOP;
END $$;

-- ─── §4. user_entitlements 테이블 (PDF 다운로드 권한 등) ───
CREATE TABLE IF NOT EXISTS user_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entitlement_type TEXT NOT NULL,
  -- 'pdf_unlimited' (관리자/구독 부여, 무제한)
  -- 'estimate_pdf_single' (1회 결제, 특정 estimate_id 또는 consumer_project_id에 묶임)
  -- 추후: 'rfq_unlimited', 'priority_support' 등 확장
  source TEXT NOT NULL DEFAULT 'payment',
  -- 'payment' | 'admin_grant' | 'subscription' | 'promo'
  source_id UUID,
  -- payment_id | admin user_id | subscription_id
  scope_type TEXT,
  -- 'estimate' | 'project' | 'global' | NULL
  scope_id UUID,
  -- estimate_id | consumer_project_id | NULL
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  -- NULL = 영구
  consumed_at TIMESTAMPTZ,
  -- 단발성(estimate_pdf_single) 다운로드 후 채워짐. 무제한은 NULL 유지
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_user_active
  ON user_entitlements(user_id, entitlement_type)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_entitlements_scope
  ON user_entitlements(scope_type, scope_id)
  WHERE revoked_at IS NULL;

DROP TRIGGER IF EXISTS trg_user_entitlements_updated_at ON user_entitlements;
CREATE TRIGGER trg_user_entitlements_updated_at
  BEFORE UPDATE ON user_entitlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_entitlements_select_own ON user_entitlements;
CREATE POLICY user_entitlements_select_own
  ON user_entitlements FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE user_entitlements IS
  '사용자 권한 entitlement — PDF 다운로드, 무제한 권한, 구독 등. 추후 구독시스템 기반.';
COMMENT ON COLUMN user_entitlements.scope_type IS
  '권한이 적용되는 범위 (estimate / project / global). single 타입은 scope_id로 특정 견적에 묶임.';
