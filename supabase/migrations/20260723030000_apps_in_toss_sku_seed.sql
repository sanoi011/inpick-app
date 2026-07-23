-- Apps in Toss 콘솔 발급 SKU 매핑 (2026-07-23 등록)
--
-- 콘솔 등록 결과 (workspace 60693 / miniApp 54678, 전부 CONSUMABLE·APPROVED):
--   * 판매 상태는 콘솔에서 INACTIVE로 생성 — 샌드박스 검증 후 ACTIVE 전환.
--   * 콘솔 입력가(netPrice) = 공급가, 사용자 결제가(grossPrice) = 공급가 + VAT 10%.
--   * grossPrice가 20260723020000의 apps_in_toss_sale_amount_krw와 5건 모두 일치 확인.
--
-- 선행 마이그레이션:
--   20260723020000_apps_in_toss_iap.sql (컬럼/주문 테이블)
--   20260723025000_apps_in_toss_atomic_provisioning.sql (지급 RPC)

UPDATE payment_products
SET
  apps_in_toss_sku = 'ait.0000054678.fc566614.91bf5d42a7.4784195098',
  apps_in_toss_enabled = TRUE,
  updated_at = NOW()
WHERE code = 'ai_credit_10';

UPDATE payment_products
SET
  apps_in_toss_sku = 'ait.0000054678.d57be621.82bdabde37.4784222376',
  apps_in_toss_enabled = TRUE,
  updated_at = NOW()
WHERE code = 'ai_credit_30';

UPDATE payment_products
SET
  apps_in_toss_sku = 'ait.0000054678.8b1b039f.49f239ad06.4784226012',
  apps_in_toss_enabled = TRUE,
  updated_at = NOW()
WHERE code = 'ai_credit_100';

UPDATE payment_products
SET
  apps_in_toss_sku = 'ait.0000054678.e85005be.c6315980dd.4784229549',
  apps_in_toss_enabled = TRUE,
  updated_at = NOW()
WHERE code = 'ai_credit_300';

UPDATE payment_products
SET
  apps_in_toss_sku = 'ait.0000054678.59ad311c.fc8658665b.4784235788',
  apps_in_toss_enabled = TRUE,
  updated_at = NOW()
WHERE code = 'estimate_pdf_single';

-- 검증: SKU가 채워진 활성 상품이 정확히 5건이어야 한다.
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
    INTO v_count
  FROM payment_products
  WHERE apps_in_toss_enabled = TRUE
    AND apps_in_toss_sku IS NOT NULL;
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'APPS_IN_TOSS_SKU_SEED_MISMATCH: expected 5, got %', v_count;
  END IF;
END $$;
