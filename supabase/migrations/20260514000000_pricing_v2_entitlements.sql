-- INPICK Pricing v2: 토큰 1개=500원 + 회원가입 보너스 5→10 + PDF 9,900원 + entitlements
-- 가이드: 2026-05-14 — 토스페이먼츠 입점 심사 대응 단가 단일화
-- 정책:
--   * 기존 `payment_products` 행을 UPDATE (가격 단가만 변경)
--   * 기존 `grant_signup_bonus` 함수의 5토큰을 10토큰으로 변경 (REPLACE)
--   * 이미 5토큰만 받은 기존 사용자에게 +5 backfill (idempotent: 'signup_topup_to_10' metadata로 1회만)
--   * PDF 다운로드는 단일 견적당 9,900원 (부가세 포함) 또는 관리자 무제한 권한

-- ─── §1. payment_products: 가격 v2 반영 (기존 행 UPDATE) ─────────────
-- 정책: 토큰 1개 = 500원
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

-- 신규 패키지: 300개 (대량) — 기존에 없으므로 INSERT 또는 활성화
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

-- ─── §2. 회원가입 보너스 5 → 10 변경 (기존 grant_signup_bonus REPLACE) ───
CREATE OR REPLACE FUNCTION grant_signup_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_tokens (user_id, balance) VALUES (NEW.id, 10)
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO token_transactions (user_id, type, feature, amount, balance_after, metadata)
  VALUES (NEW.id, 'signup_bonus', 'welcome', 10, 10, jsonb_build_object('source', 'signup_trigger', 'version', 'pricing_v2'));
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION grant_signup_bonus() IS
  '회원가입 시 토큰 10개 자동 지급 (2026-05-14 pricing v2). 기존 5개에서 10개로 상향.';

-- user_tokens 기본값도 10으로 변경 (트리거에서 명시 INSERT하므로 안전망)
ALTER TABLE user_tokens ALTER COLUMN balance SET DEFAULT 10;

-- ─── §3. 기존 5토큰 받은 사용자에게 +5 backfill (idempotent) ───
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT ut.user_id, ut.balance
    FROM user_tokens ut
    WHERE NOT EXISTS (
      -- 이미 v2 backfill 받은 사용자 제외
      SELECT 1 FROM token_transactions tt
       WHERE tt.user_id = ut.user_id
         AND tt.type = 'signup_bonus'
         AND tt.metadata->>'version' IN ('pricing_v2', 'pricing_v2_backfill')
    )
    AND EXISTS (
      -- 기존 signup_bonus를 받은 적이 있어야 함 (소급 대상)
      SELECT 1 FROM token_transactions tt2
       WHERE tt2.user_id = ut.user_id
         AND tt2.type = 'signup_bonus'
    )
  LOOP
    BEGIN
      UPDATE user_tokens
        SET balance = balance + 5,
            updated_at = NOW()
        WHERE user_id = r.user_id;

      INSERT INTO token_transactions
        (user_id, type, feature, amount, balance_after, metadata)
      VALUES
        (r.user_id, 'signup_bonus', 'welcome', 5, r.balance + 5,
         jsonb_build_object('source', 'signup_topup_to_10', 'version', 'pricing_v2_backfill', 'reason', '신규 회원가입 보너스 5→10 상향 소급'));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'signup topup failed for user %: %', r.user_id, SQLERRM;
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

-- updated_at 트리거
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
