-- Phase 8: 토큰 시스템 — 가입 시 5토큰 자동 증정 + 차감/충전 RPC + 거래 이력
-- localStorage 임시 구현(useTokens.ts) → Supabase로 이관

-- 1. user_tokens (잔액 캐시)
CREATE TABLE IF NOT EXISTS user_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance int NOT NULL DEFAULT 5,
  total_purchased int NOT NULL DEFAULT 0,
  total_used int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. token_transactions (거래 이력)
CREATE TYPE token_tx_type AS ENUM ('signup_bonus', 'purchase', 'use', 'refund', 'admin_adjust');
CREATE TYPE token_feature AS ENUM ('ai_render', 'ar_session', 'drawing_option', 'welcome', 'manual');

CREATE TABLE IF NOT EXISTS token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type token_tx_type NOT NULL,
  feature token_feature,
  amount int NOT NULL,                 -- 양수=증가, 음수=차감
  balance_after int NOT NULL,
  session_id uuid,                     -- workflow_sessions 참조 자리 (FK는 추후)
  payment_id text,                     -- PG 결제 transaction id (토스페이먼츠 paymentKey 등)
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_tx_user_at ON token_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_tx_type ON token_transactions(type);

-- 3. 가입 시 5토큰 자동 증정 트리거
CREATE OR REPLACE FUNCTION grant_signup_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_tokens (user_id, balance) VALUES (NEW.id, 5)
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO token_transactions (user_id, type, feature, amount, balance_after, metadata)
  VALUES (NEW.id, 'signup_bonus', 'welcome', 5, 5, jsonb_build_object('source', 'signup_trigger'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_signup_grant_bonus ON auth.users;
CREATE TRIGGER on_user_signup_grant_bonus
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION grant_signup_bonus();

-- 4. 차감 RPC (잔액 부족 시 success=false)
CREATE OR REPLACE FUNCTION deduct_tokens(
  p_user_id uuid,
  p_amount int,
  p_feature token_feature,
  p_session_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance int;
BEGIN
  SELECT balance INTO v_balance FROM user_tokens WHERE user_id = p_user_id FOR UPDATE;

  IF v_balance IS NULL THEN
    INSERT INTO user_tokens (user_id, balance) VALUES (p_user_id, 0);
    v_balance := 0;
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'reason', 'insufficient_tokens', 'balance', v_balance);
  END IF;

  UPDATE user_tokens
    SET balance = balance - p_amount,
        total_used = total_used + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;

  INSERT INTO token_transactions (user_id, type, feature, amount, balance_after, session_id)
  VALUES (p_user_id, 'use', p_feature, -p_amount, v_balance - p_amount, p_session_id);

  RETURN jsonb_build_object('success', true, 'new_balance', v_balance - p_amount);
END;
$$;

-- 5. 충전 RPC (PG 결제 콜백에서 호출)
CREATE OR REPLACE FUNCTION purchase_tokens(
  p_user_id uuid,
  p_amount int,
  p_payment_id text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance int;
  v_existing int;
BEGIN
  -- 동일 payment_id 중복 방지 (idempotency)
  SELECT count(*) INTO v_existing FROM token_transactions
    WHERE payment_id = p_payment_id AND type = 'purchase';
  IF v_existing > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate_payment');
  END IF;

  SELECT balance INTO v_balance FROM user_tokens WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance IS NULL THEN
    INSERT INTO user_tokens (user_id, balance) VALUES (p_user_id, 0);
    v_balance := 0;
  END IF;

  UPDATE user_tokens
    SET balance = balance + p_amount,
        total_purchased = total_purchased + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;

  INSERT INTO token_transactions (user_id, type, feature, amount, balance_after, payment_id, metadata)
  VALUES (p_user_id, 'purchase', 'manual', p_amount, v_balance + p_amount, p_payment_id, p_metadata);

  RETURN jsonb_build_object('success', true, 'new_balance', v_balance + p_amount);
END;
$$;

-- 6. RLS
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_tokens_select_own" ON user_tokens;
CREATE POLICY "user_tokens_select_own" ON user_tokens
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "token_tx_select_own" ON token_transactions;
CREATE POLICY "token_tx_select_own" ON token_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- 차감/충전은 RPC를 통해서만 — 직접 INSERT/UPDATE 막음
DROP POLICY IF EXISTS "user_tokens_no_direct_write" ON user_tokens;
CREATE POLICY "user_tokens_no_direct_write" ON user_tokens
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "token_tx_no_direct_write" ON token_transactions;
CREATE POLICY "token_tx_no_direct_write" ON token_transactions
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- service_role/RPC는 SECURITY DEFINER로 우회

GRANT EXECUTE ON FUNCTION deduct_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION purchase_tokens TO authenticated, service_role;
