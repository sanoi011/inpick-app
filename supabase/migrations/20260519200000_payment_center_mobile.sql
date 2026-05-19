-- 2026-05-19: 결제센터 + 모바일 결제 인프라
-- 가이드: §10 (DB 보강), §11 (orchestrator), §12 (mobile API)
--
-- 원칙:
--   * web/ios/android 결제 채널 통합 관리
--   * 앱마켓 transaction 검증 후 finalizer 지급
--   * payment_provider_events에 모든 webhook + RTDN + ASN 기록
--   * payment_intents에 channel/platform snapshot

-- ─── §1. payment_products 보강 ──────────────────────
ALTER TABLE payment_products
  ADD COLUMN IF NOT EXISTS product_kind TEXT,
  ADD COLUMN IF NOT EXISTS sale_channels JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS app_store_product_id TEXT,
  ADD COLUMN IF NOT EXISTS google_play_product_id TEXT,
  ADD COLUMN IF NOT EXISTS toss_product_code TEXT,
  ADD COLUMN IF NOT EXISTS portone_product_code TEXT,
  ADD COLUMN IF NOT EXISTS bootpay_product_code TEXT,
  ADD COLUMN IF NOT EXISTS policy_risk_level TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS policy_notes TEXT;

COMMENT ON COLUMN payment_products.product_kind IS 'digital_token | digital_entitlement | digital_subscription | offline_service | construction_payment | contractor_service | admin_grant';
COMMENT ON COLUMN payment_products.sale_channels IS '{web,ios_storekit,ios_external_kr,android_play_billing,android_alternative_billing_kr,offline_pg}';

-- 기존 상품에 product_kind 추론 적용
UPDATE payment_products SET product_kind = 'digital_token' WHERE product_type IN ('token_pack', 'ai_credit_pack') AND product_kind IS NULL;
UPDATE payment_products SET product_kind = 'digital_entitlement' WHERE product_type IN ('pdf_estimate_single', 'pdf_entitlement') AND product_kind IS NULL;
UPDATE payment_products SET sale_channels = '{"web":true,"ios_storekit":false,"ios_external_kr":false,"android_play_billing":false,"android_alternative_billing_kr":false,"offline_pg":false}'::jsonb WHERE sale_channels = '{}'::jsonb;
UPDATE payment_products SET policy_risk_level = 'app_market_review_required' WHERE product_kind IN ('digital_token', 'digital_entitlement') AND policy_risk_level = 'unknown';
UPDATE payment_products SET policy_risk_level = 'offline_pg_safe' WHERE product_kind = 'offline_service' AND policy_risk_level = 'unknown';

-- 앱마켓 productId 기본 매핑 (대표 결정 가능)
UPDATE payment_products SET app_store_product_id = 'kr.inpick.token.10', google_play_product_id = 'kr.inpick.token.10' WHERE code = 'ai_credit_10';
UPDATE payment_products SET app_store_product_id = 'kr.inpick.token.33', google_play_product_id = 'kr.inpick.token.33' WHERE code = 'ai_credit_30';
UPDATE payment_products SET app_store_product_id = 'kr.inpick.token.115', google_play_product_id = 'kr.inpick.token.115' WHERE code = 'ai_credit_100';
UPDATE payment_products SET app_store_product_id = 'kr.inpick.token.360', google_play_product_id = 'kr.inpick.token.360' WHERE code = 'ai_credit_300';
UPDATE payment_products SET app_store_product_id = 'kr.inpick.pdf.single', google_play_product_id = 'kr.inpick.pdf.single' WHERE product_type IN ('pdf_estimate_single', 'pdf_entitlement');

-- ─── §2. payment_intents 보강 ───────────────────────
ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS channel TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS provider_mode TEXT,
  ADD COLUMN IF NOT EXISTS app_build_version TEXT,
  ADD COLUMN IF NOT EXISTS app_installation_id TEXT,
  ADD COLUMN IF NOT EXISTS policy_snapshot JSONB;

CREATE INDEX IF NOT EXISTS payment_intents_channel_idx ON payment_intents(channel, created_at DESC) WHERE channel IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_intents_platform_idx ON payment_intents(platform, created_at DESC) WHERE platform IS NOT NULL;

-- ─── §3. payment_provider_configs ───────────────────
CREATE TABLE IF NOT EXISTS payment_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'test',
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  display_name TEXT NOT NULL,
  supports_web BOOLEAN NOT NULL DEFAULT FALSE,
  supports_ios BOOLEAN NOT NULL DEFAULT FALSE,
  supports_android BOOLEAN NOT NULL DEFAULT FALSE,
  supports_digital_goods BOOLEAN NOT NULL DEFAULT FALSE,
  supports_offline_services BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_url TEXT,
  last_health_check_at TIMESTAMPTZ,
  last_successful_payment_at TIMESTAMPTZ,
  last_webhook_at TIMESTAMPTZ,
  health_status TEXT NOT NULL DEFAULT 'unknown',
  risk_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, mode)
);

CREATE TRIGGER trg_payment_provider_configs_updated_at
  BEFORE UPDATE ON payment_provider_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 기본 provider seed
INSERT INTO payment_provider_configs (provider, mode, display_name, supports_web, supports_digital_goods, supports_offline_services, enabled, health_status) VALUES
  ('toss', 'test', '토스페이먼츠 (테스트)', TRUE, TRUE, TRUE, FALSE, 'unknown'),
  ('toss', 'live', '토스페이먼츠 (운영)', TRUE, TRUE, TRUE, FALSE, 'unknown'),
  ('portone', 'test', '포트원 (테스트)', TRUE, TRUE, TRUE, FALSE, 'unknown'),
  ('bootpay', 'test', '부트페이 (테스트)', TRUE, TRUE, TRUE, FALSE, 'unknown'),
  ('nicepay', 'test', '나이스페이 (테스트)', TRUE, TRUE, TRUE, FALSE, 'unknown'),
  ('kcp', 'test', 'KCP (테스트)', TRUE, TRUE, TRUE, FALSE, 'unknown'),
  ('app_store', 'live', 'Apple App Store (StoreKit)', FALSE, TRUE, FALSE, FALSE, 'unknown'),
  ('google_play', 'live', 'Google Play Billing', FALSE, TRUE, FALSE, FALSE, 'unknown'),
  ('mock', 'test', 'Mock (개발)', TRUE, TRUE, TRUE, TRUE, 'healthy')
ON CONFLICT (provider, mode) DO NOTHING;

UPDATE payment_provider_configs SET supports_ios = TRUE WHERE provider = 'app_store';
UPDATE payment_provider_configs SET supports_android = TRUE WHERE provider = 'google_play';

-- ─── §4. app_purchase_transactions ──────────────────
CREATE TABLE IF NOT EXISTS app_purchase_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_intent_id UUID REFERENCES payment_intents(id) ON DELETE SET NULL,
  internal_product_id TEXT,
  app_product_id TEXT NOT NULL,
  transaction_id TEXT,
  original_transaction_id TEXT,
  purchase_token TEXT,
  order_id TEXT,
  purchase_state TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  entitlement_status TEXT NOT NULL DEFAULT 'pending',
  raw_payload JSONB,
  verified_payload JSONB,
  idempotency_key TEXT NOT NULL UNIQUE,
  purchased_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  provisioned_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_purchase_platform_check CHECK (platform IN ('ios', 'android')),
  CONSTRAINT app_purchase_verification_check CHECK (verification_status IN ('pending', 'verified', 'failed', 'refunded')),
  CONSTRAINT app_purchase_entitlement_check CHECK (entitlement_status IN ('pending', 'granted', 'revoked', 'failed'))
);

CREATE INDEX IF NOT EXISTS app_purchase_user_idx ON app_purchase_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_purchase_intent_idx ON app_purchase_transactions(payment_intent_id) WHERE payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_purchase_status_idx ON app_purchase_transactions(verification_status, entitlement_status, created_at DESC);
CREATE INDEX IF NOT EXISTS app_purchase_transaction_id_idx ON app_purchase_transactions(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_purchase_purchase_token_idx ON app_purchase_transactions(purchase_token) WHERE purchase_token IS NOT NULL;

CREATE TRIGGER trg_app_purchase_transactions_updated_at
  BEFORE UPDATE ON app_purchase_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE app_purchase_transactions IS '앱스토어/구글플레이 구매 transaction 검증 결과. transaction_id/purchase_token은 민감 데이터';

-- ─── §5. payment_provider_events ────────────────────
CREATE TABLE IF NOT EXISTS payment_provider_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_key TEXT NOT NULL,
  related_payment_intent_id UUID REFERENCES payment_intents(id) ON DELETE SET NULL,
  related_app_purchase_transaction_id UUID REFERENCES app_purchase_transactions(id) ON DELETE SET NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processing_error TEXT,
  raw_payload JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE(provider, event_key)
);

CREATE INDEX IF NOT EXISTS payment_provider_events_provider_idx ON payment_provider_events(provider, received_at DESC);
CREATE INDEX IF NOT EXISTS payment_provider_events_processed_idx ON payment_provider_events(processed, received_at DESC) WHERE processed = FALSE;

COMMENT ON TABLE payment_provider_events IS '모든 결제 provider event 통합 (Toss webhook + ASN + RTDN)';

-- ─── §6. mobile_app_releases ────────────────────────
CREATE TABLE IF NOT EXISTS mobile_app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  version_name TEXT NOT NULL,
  build_number TEXT NOT NULL,
  release_track TEXT NOT NULL DEFAULT 'internal',
  status TEXT NOT NULL DEFAULT 'draft',
  bundle_id TEXT,
  package_name TEXT,
  store_url TEXT,
  notes TEXT,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(platform, build_number),
  CONSTRAINT mobile_app_releases_platform_check CHECK (platform IN ('ios', 'android')),
  CONSTRAINT mobile_app_releases_status_check CHECK (status IN ('draft', 'submitted', 'in_review', 'approved', 'released', 'rejected', 'archived'))
);

CREATE TRIGGER trg_mobile_app_releases_updated_at
  BEFORE UPDATE ON mobile_app_releases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── §7. RLS ────────────────────────────────────────
ALTER TABLE payment_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_purchase_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_app_releases ENABLE ROW LEVEL SECURITY;

-- 사용자는 본인 app_purchase 만 SELECT
CREATE POLICY "app_purchase_transactions_select_own"
  ON app_purchase_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- 다른 테이블은 service role만 (정책 미생성)

-- 완료 알림
DO $$
DECLARE
  v_p INT; v_pc INT;
BEGIN
  SELECT COUNT(*) INTO v_p FROM payment_products;
  SELECT COUNT(*) INTO v_pc FROM payment_provider_configs;
  RAISE NOTICE '[migration 20260519200000] products=%, provider_configs=%', v_p, v_pc;
END $$;
