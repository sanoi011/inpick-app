-- Apps in Toss 결제 상품의 원자적 지급 함수
--
-- 목적:
--   * 결제 지급 중 일부 테이블만 갱신된 뒤 재시도에서 멱등 처리되는 문제를 차단한다.
--   * 같은 사용자의 동시 충전이 서로의 잔액을 덮어쓰지 않도록 직렬화한다.
--   * service_role 외에는 지급 RPC를 직접 호출할 수 없도록 실행 권한을 닫는다.

CREATE OR REPLACE FUNCTION public.provision_apps_in_toss_tokens_v1(
  p_user_id UUID,
  p_payment_id UUID,
  p_product_code TEXT,
  p_product_name_ko TEXT,
  p_paid_credits INTEGER,
  p_bonus_credits INTEGER,
  p_channel TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_marker TEXT := 'payment:' || p_payment_id::TEXT || ':credit';
  v_mirror_marker TEXT := 'payment:' || p_payment_id::TEXT || ':mirror';
  v_paid INTEGER := COALESCE(p_paid_credits, 0);
  v_bonus INTEGER := COALESCE(p_bonus_credits, 0);
  v_total INTEGER;
  v_old_balance INTEGER;
  v_new_balance INTEGER;
  v_existing_balance INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_payment_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_PROVISION_ID' USING ERRCODE = 'P0001';
  END IF;
  IF p_product_code IS NULL OR p_product_name_ko IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_PRODUCT' USING ERRCODE = 'P0001';
  END IF;
  IF v_paid <= 0 OR v_bonus < 0 OR v_paid > 1000000 OR v_bonus > 1000000 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_CREDIT_AMOUNT' USING ERRCODE = 'P0001';
  END IF;
  IF p_channel IS NULL OR
     p_channel NOT IN ('apps_in_toss_pay', 'apps_in_toss_iap') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_CHANNEL' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.payments
    WHERE id = p_payment_id
      AND user_id = p_user_id
      AND provider IN ('apps_in_toss_pay', 'apps_in_toss_iap')
  ) THEN
    RAISE EXCEPTION 'PAYMENT_OWNERSHIP_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  v_total := v_paid + v_bonus;

  -- token_wallets와 user_credits 양쪽의 사용자 단위 변경을 한 트랜잭션으로 직렬화한다.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::TEXT, 0)
  );

  SELECT balance_after
    INTO v_existing_balance
  FROM public.token_ledger
  WHERE idempotency_key = v_marker;

  IF FOUND THEN
    SELECT balance
      INTO v_new_balance
    FROM public.token_wallets
    WHERE user_id = p_user_id;

    RETURN pg_catalog.jsonb_build_object(
      'creditsAdded', 0,
      'balanceAfter', COALESCE(v_new_balance, v_existing_balance),
      'idempotent', TRUE
    );
  END IF;

  INSERT INTO public.token_wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance
    INTO v_old_balance
  FROM public.token_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOKEN_WALLET_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.token_wallets
  SET
    balance = balance + v_total,
    paid_balance = paid_balance + v_paid,
    promo_balance = promo_balance + v_bonus,
    total_purchased = total_purchased + v_total,
    updated_at = pg_catalog.now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.token_ledger (
    user_id,
    entry_type,
    delta,
    paid_delta,
    promo_delta,
    balance_after,
    source_type,
    source_id,
    idempotency_key,
    reason_ko,
    metadata
  )
  VALUES (
    p_user_id,
    'purchase_credit',
    v_paid,
    v_paid,
    0,
    v_old_balance + v_paid,
    'payment',
    p_payment_id,
    v_marker,
    p_product_name_ko || ' 구매 (' ||
      CASE
        WHEN p_channel = 'apps_in_toss_iap' THEN '앱인토스 인앱결제'
        ELSE '앱인토스 페이'
      END || ')',
    pg_catalog.jsonb_build_object(
      'productCode', p_product_code,
      'channel', p_channel
    )
  );

  IF v_bonus > 0 THEN
    INSERT INTO public.token_ledger (
      user_id,
      entry_type,
      delta,
      paid_delta,
      promo_delta,
      balance_after,
      source_type,
      source_id,
      idempotency_key,
      reason_ko,
      metadata
    )
    VALUES (
      p_user_id,
      'bonus_credit',
      v_bonus,
      0,
      v_bonus,
      v_new_balance,
      'payment',
      p_payment_id,
      'payment:' || p_payment_id::TEXT || ':bonus',
      p_product_code || ' 보너스',
      pg_catalog.jsonb_build_object(
        'productCode', p_product_code,
        'channel', p_channel
      )
    );
  END IF;

  INSERT INTO public.user_credits (user_id, balance)
  VALUES (p_user_id, v_total)
  ON CONFLICT (user_id) DO UPDATE
  SET
    balance = public.user_credits.balance + EXCLUDED.balance,
    updated_at = pg_catalog.now();

  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    description,
    idempotency_key
  )
  VALUES (
    p_user_id,
    'CHARGE',
    v_total,
    '토큰 충전 (payment:' || p_payment_id::TEXT || ', ' ||
      pg_catalog.replace(p_channel, '_', '-') || ')',
    v_mirror_marker
  );

  RETURN pg_catalog.jsonb_build_object(
    'creditsAdded', v_total,
    'balanceAfter', v_new_balance,
    'idempotent', FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provision_apps_in_toss_tokens_v1(
  UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_apps_in_toss_tokens_v1(
  UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.provision_apps_in_toss_pdf_v1(
  p_user_id UUID,
  p_payment_id UUID,
  p_estimate_id UUID,
  p_consumer_project_id UUID,
  p_channel TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entitlement_id UUID;
  v_scope_type TEXT;
  v_scope_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_payment_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_PROVISION_ID' USING ERRCODE = 'P0001';
  END IF;
  IF p_estimate_id IS NOT NULL AND p_consumer_project_id IS NOT NULL THEN
    RAISE EXCEPTION 'AMBIGUOUS_PDF_SCOPE' USING ERRCODE = 'P0001';
  END IF;
  IF p_channel IS NULL OR
     p_channel NOT IN ('apps_in_toss_pay', 'apps_in_toss_iap') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_CHANNEL' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.payments
    WHERE id = p_payment_id
      AND user_id = p_user_id
      AND provider IN ('apps_in_toss_pay', 'apps_in_toss_iap')
  ) THEN
    RAISE EXCEPTION 'PAYMENT_OWNERSHIP_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_payment_id::TEXT, 0)
  );

  SELECT id
    INTO v_entitlement_id
  FROM public.user_entitlements
  WHERE source = 'payment'
    AND source_id = p_payment_id
    AND entitlement_type = 'estimate_pdf_single'
  LIMIT 1;

  IF FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'entitlementId', v_entitlement_id,
      'idempotent', TRUE
    );
  END IF;

  v_scope_type := CASE
    WHEN p_estimate_id IS NOT NULL THEN 'estimate'
    WHEN p_consumer_project_id IS NOT NULL THEN 'project'
    ELSE NULL
  END;
  v_scope_id := COALESCE(p_estimate_id, p_consumer_project_id);

  INSERT INTO public.user_entitlements (
    user_id,
    entitlement_type,
    source,
    source_id,
    scope_type,
    scope_id,
    metadata
  )
  VALUES (
    p_user_id,
    'estimate_pdf_single',
    'payment',
    p_payment_id,
    v_scope_type,
    v_scope_id,
    pg_catalog.jsonb_build_object(
      'granted_via', 'estimate_pdf_purchase',
      'channel', p_channel
    )
  )
  RETURNING id INTO v_entitlement_id;

  RETURN pg_catalog.jsonb_build_object(
    'entitlementId', v_entitlement_id,
    'idempotent', FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provision_apps_in_toss_pdf_v1(
  UUID, UUID, UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_apps_in_toss_pdf_v1(
  UUID, UUID, UUID, UUID, TEXT
) TO service_role;

COMMENT ON FUNCTION public.provision_apps_in_toss_tokens_v1(
  UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT
) IS 'Apps in Toss 결제 토큰을 wallet/ledger/live balance에 원자적·멱등 지급';
COMMENT ON FUNCTION public.provision_apps_in_toss_pdf_v1(
  UUID, UUID, UUID, UUID, TEXT
) IS 'Apps in Toss 결제 PDF 권한을 payment_id 기준 원자적·멱등 지급';
