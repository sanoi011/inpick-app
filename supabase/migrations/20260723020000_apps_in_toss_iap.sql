-- Apps in Toss 정식 인앱결제(IAP) 상품/SKU 매핑과 지급 추적
--
-- 안전 원칙:
--   1. 콘솔이 발급한 SKU를 입력하기 전에는 apps_in_toss_enabled=false로 유지한다.
--   2. 클라이언트가 보낸 orderId/sku만 믿지 않고, mTLS 주문 상태 API로 검증한다.
--   3. order_id와 payment/token ledger idempotency key로 중복 지급을 차단한다.

ALTER TABLE payment_products
  ADD COLUMN IF NOT EXISTS apps_in_toss_sku TEXT,
  ADD COLUMN IF NOT EXISTS apps_in_toss_product_type TEXT,
  ADD COLUMN IF NOT EXISTS apps_in_toss_supply_amount_krw INTEGER,
  ADD COLUMN IF NOT EXISTS apps_in_toss_sale_amount_krw INTEGER,
  ADD COLUMN IF NOT EXISTS apps_in_toss_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS payment_products_apps_in_toss_sku_unique
  ON payment_products(apps_in_toss_sku)
  WHERE apps_in_toss_sku IS NOT NULL;

COMMENT ON COLUMN payment_products.apps_in_toss_sku IS
  'Apps in Toss 콘솔에서 상품 생성 후 발급된 SKU. 등록 전 NULL 유지';
COMMENT ON COLUMN payment_products.apps_in_toss_supply_amount_krw IS
  'Apps in Toss 콘솔 입력 공급가(VAT 별도)';
COMMENT ON COLUMN payment_products.apps_in_toss_sale_amount_krw IS
  '콘솔이 공급가+VAT로 확정한 실제 사용자 결제액';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_products_apps_in_toss_type_check'
  ) THEN
    ALTER TABLE payment_products
      ADD CONSTRAINT payment_products_apps_in_toss_type_check
      CHECK (
        apps_in_toss_product_type IS NULL OR
        apps_in_toss_product_type IN ('CONSUMABLE', 'NON_CONSUMABLE', 'SUBSCRIPTION')
      );
  END IF;
END $$;

-- 기존 최종 판매가에 가장 가깝도록 10원 단위의 공급가를 설정했다.
-- 콘솔에서 자동 계산된 판매가를 다시 확인한 뒤 sale_amount를 최종 확정한다.
UPDATE payment_products
SET
  apps_in_toss_product_type = 'CONSUMABLE',
  apps_in_toss_supply_amount_krw = 4550,
  apps_in_toss_sale_amount_krw = 5005,
  apps_in_toss_enabled = FALSE,
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'apps_in_toss_catalog_key', 'inpick.token.10',
    'apps_in_toss_icon', '/iap/inpick-token-1024.png'
  ),
  updated_at = NOW()
WHERE code = 'ai_credit_10';

UPDATE payment_products
SET
  apps_in_toss_product_type = 'CONSUMABLE',
  apps_in_toss_supply_amount_krw = 13640,
  apps_in_toss_sale_amount_krw = 15004,
  apps_in_toss_enabled = FALSE,
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'apps_in_toss_catalog_key', 'inpick.token.33',
    'apps_in_toss_icon', '/iap/inpick-token-1024.png'
  ),
  updated_at = NOW()
WHERE code = 'ai_credit_30';

UPDATE payment_products
SET
  apps_in_toss_product_type = 'CONSUMABLE',
  apps_in_toss_supply_amount_krw = 45450,
  apps_in_toss_sale_amount_krw = 49995,
  apps_in_toss_enabled = FALSE,
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'apps_in_toss_catalog_key', 'inpick.token.115',
    'apps_in_toss_icon', '/iap/inpick-token-1024.png'
  ),
  updated_at = NOW()
WHERE code = 'ai_credit_100';

UPDATE payment_products
SET
  apps_in_toss_product_type = 'CONSUMABLE',
  apps_in_toss_supply_amount_krw = 136360,
  apps_in_toss_sale_amount_krw = 149996,
  apps_in_toss_enabled = FALSE,
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'apps_in_toss_catalog_key', 'inpick.token.360',
    'apps_in_toss_icon', '/iap/inpick-token-1024.png'
  ),
  updated_at = NOW()
WHERE code = 'ai_credit_300';

UPDATE payment_products
SET
  apps_in_toss_product_type = 'CONSUMABLE',
  apps_in_toss_supply_amount_krw = 9000,
  apps_in_toss_sale_amount_krw = 9900,
  apps_in_toss_enabled = FALSE,
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'apps_in_toss_catalog_key', 'inpick.pdf.single',
    'apps_in_toss_icon', '/iap/inpick-token-1024.png'
  ),
  updated_at = NOW()
WHERE code = 'estimate_pdf_single';

CREATE TABLE IF NOT EXISTS apps_in_toss_iap_orders (
  order_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES payment_products(id),
  sku TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'payment_completed',
  remote_status TEXT NOT NULL,
  payment_intent_id UUID REFERENCES payment_intents(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  estimate_id UUID,
  consumer_project_id UUID,
  status_determined_at TIMESTAMPTZ,
  granted_at TIMESTAMPTZ,
  provisioning_attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  raw_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT apps_in_toss_iap_orders_status_check CHECK (
    status IN (
      'payment_completed',
      'grant_failed',
      'granted',
      'completed_without_local_grant',
      'refunded'
    )
  )
);

CREATE INDEX IF NOT EXISTS apps_in_toss_iap_orders_user_created_idx
  ON apps_in_toss_iap_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS apps_in_toss_iap_orders_status_idx
  ON apps_in_toss_iap_orders(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS apps_in_toss_iap_orders_payment_idx
  ON apps_in_toss_iap_orders(payment_id)
  WHERE payment_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_apps_in_toss_iap_orders_updated_at
  ON apps_in_toss_iap_orders;
CREATE TRIGGER trg_apps_in_toss_iap_orders_updated_at
  BEFORE UPDATE ON apps_in_toss_iap_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE apps_in_toss_iap_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "apps_in_toss_iap_orders_select_own"
  ON apps_in_toss_iap_orders;
CREATE POLICY "apps_in_toss_iap_orders_select_own"
  ON apps_in_toss_iap_orders FOR SELECT
  USING (auth.uid() = user_id);

INSERT INTO payment_provider_configs (
  provider,
  mode,
  display_name,
  supports_web,
  supports_ios,
  supports_android,
  supports_digital_goods,
  supports_offline_services,
  enabled,
  health_status,
  risk_notes
)
VALUES
  (
    'apps_in_toss_iap',
    'test',
    'Apps in Toss IAP (샌드박스)',
    FALSE,
    TRUE,
    TRUE,
    TRUE,
    FALSE,
    FALSE,
    'unknown',
    '콘솔 SKU와 mTLS 인증서 설정 후 활성화'
  ),
  (
    'apps_in_toss_iap',
    'live',
    'Apps in Toss IAP',
    FALSE,
    TRUE,
    TRUE,
    TRUE,
    FALSE,
    FALSE,
    'unknown',
    '샌드박스 성공/실패/복구 3개 시나리오 통과 후 활성화'
  )
ON CONFLICT (provider, mode) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  supports_ios = EXCLUDED.supports_ios,
  supports_android = EXCLUDED.supports_android,
  supports_digital_goods = EXCLUDED.supports_digital_goods,
  risk_notes = EXCLUDED.risk_notes,
  updated_at = NOW();
