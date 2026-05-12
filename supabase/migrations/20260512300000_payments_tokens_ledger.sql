-- INPICK 결제 + 크레딧 ledger 통합
-- 가이드: c:\Users\user\Downloads\inpick-auth-payment-token-admin-dev-plan-20260512.md §5

-- ─── 1. 결제 상품 ───────────────────────────────
CREATE TABLE IF NOT EXISTS payment_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  product_type TEXT NOT NULL,
  name_ko TEXT NOT NULL,
  description_ko TEXT,
  amount_krw INT NOT NULL,
  credit_amount INT NOT NULL DEFAULT 0,
  bonus_credit_amount INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO payment_products (code, product_type, name_ko, description_ko, amount_krw, credit_amount, bonus_credit_amount, sort_order)
VALUES
  ('ai_credit_10', 'ai_credit_pack', 'AI 크레딧 10개', '간단한 방 10장 생성', 9900, 10, 0, 10),
  ('ai_credit_30', 'ai_credit_pack', 'AI 크레딧 30개 + 3개', '인기 — 3개 보너스', 27000, 30, 3, 20),
  ('ai_credit_100', 'ai_credit_pack', 'AI 크레딧 100개 + 20개', '상가/사무실 추천 — 20개 보너스', 79000, 100, 20, 30)
ON CONFLICT (code) DO NOTHING;

-- ─── 2. 결제 의도 (orderId 발급 + Toss widget 호출 준비) ───
CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID,
  product_id UUID REFERENCES payment_products(id),
  order_id TEXT NOT NULL UNIQUE,
  order_name TEXT NOT NULL,
  product_type TEXT NOT NULL,
  amount_krw INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KRW',
  status TEXT NOT NULL DEFAULT 'created',
  provider TEXT NOT NULL DEFAULT 'toss',
  customer_key TEXT,
  success_url TEXT,
  fail_url TEXT,
  requested_payment_method TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_user_id ON payment_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_created_at ON payment_intents(created_at DESC);

ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_intents_select_own"
  ON payment_intents FOR SELECT USING (auth.uid() = user_id);

-- ─── 3. 실제 결제 (Toss 승인 후) ────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'toss',
  payment_key TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL UNIQUE,
  method TEXT,
  easy_pay_provider TEXT,
  amount_krw INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KRW',
  status TEXT NOT NULL,
  approved_at TIMESTAMPTZ,
  requested_at TIMESTAMPTZ,
  raw_payment JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_user_payment_key
  ON payments(user_id, payment_key);
CREATE INDEX IF NOT EXISTS idx_payments_user_created ON payments(user_id, created_at DESC);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_select_own"
  ON payments FOR SELECT USING (auth.uid() = user_id);

-- ─── 4. 결제 이벤트 (webhook + confirm 트래킹) ──────
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id UUID REFERENCES payment_intents(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'toss',
  event_type TEXT NOT NULL,
  event_key TEXT NOT NULL,
  order_id TEXT,
  payment_key TEXT,
  amount_krw INT,
  raw_event JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_events_event_key
  ON payment_events(provider, event_key);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_created
  ON payment_events(payment_id, created_at DESC);

-- ─── 5. 크레딧 지갑 ────────────────────────────────
CREATE TABLE IF NOT EXISTS token_wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 0,
  paid_balance INT NOT NULL DEFAULT 0,
  promo_balance INT NOT NULL DEFAULT 0,
  locked_balance INT NOT NULL DEFAULT 0,
  total_purchased INT NOT NULL DEFAULT 0,
  total_consumed INT NOT NULL DEFAULT 0,
  total_refunded INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE token_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "token_wallets_select_own"
  ON token_wallets FOR SELECT USING (auth.uid() = user_id);

-- ─── 6. 크레딧 ledger (idempotency 강제) ───────────
CREATE TABLE IF NOT EXISTS token_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  delta INT NOT NULL,
  paid_delta INT NOT NULL DEFAULT 0,
  promo_delta INT NOT NULL DEFAULT 0,
  balance_after INT NOT NULL,
  source_type TEXT NOT NULL,
  source_id UUID,
  idempotency_key TEXT NOT NULL UNIQUE,
  reason_ko TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_ledger_user_created
  ON token_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_ledger_source ON token_ledger(source_type, source_id);

ALTER TABLE token_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "token_ledger_select_own"
  ON token_ledger FOR SELECT USING (auth.uid() = user_id);

-- ─── 7. 환불 ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'toss',
  refund_type TEXT NOT NULL, -- 'full' | 'partial'
  amount_krw INT NOT NULL,
  credit_debit_amount INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'requested', -- requested/approved/completed/rejected
  reason_ko TEXT NOT NULL,
  requested_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  toss_cancel_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment ON payment_refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_status ON payment_refunds(status, created_at DESC);

-- ─── 8. 정산 보정 작업 ──────────────────────────────
CREATE TABLE IF NOT EXISTS payment_reconciliation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id UUID REFERENCES payment_intents(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  order_id TEXT,
  payment_key TEXT,
  issue_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open', -- open/resolved/wontfix
  description_ko TEXT NOT NULL,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_status
  ON payment_reconciliation_jobs(status, severity, created_at DESC);

-- ─── 9. 휴대폰 인증 OTP + consumer_profiles 보강 ────
ALTER TABLE consumer_profiles
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS phone_verification_method TEXT,
  ADD COLUMN IF NOT EXISTS verification_level TEXT DEFAULT 'email_verified';

-- phone UNIQUE 정책 변경: 인증된 번호만 unique
DROP INDEX IF EXISTS uq_consumer_profiles_phone;
CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_profiles_verified_phone
  ON consumer_profiles (phone)
  WHERE phone_verified = TRUE AND phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS phone_verification_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'signup',
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  attempt_count INT NOT NULL DEFAULT 0,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_otps_user_created
  ON phone_verification_otps(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_otps_phone_unverified
  ON phone_verification_otps(phone_e164, created_at DESC)
  WHERE verified_at IS NULL;

ALTER TABLE phone_verification_otps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phone_otps_select_own"
  ON phone_verification_otps FOR SELECT USING (auth.uid() = user_id);

-- ─── 10. 트리거 — updated_at 자동 갱신 ──────────────
CREATE TRIGGER trg_payment_products_updated_at
  BEFORE UPDATE ON payment_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_payment_intents_updated_at
  BEFORE UPDATE ON payment_intents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_token_wallets_updated_at
  BEFORE UPDATE ON token_wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE payment_intents IS 'Toss widget 호출 직전 생성. orderId 발급. status: created → paid';
COMMENT ON TABLE payments IS '실제 Toss 결제 완료. confirm/webhook 후 INSERT.';
COMMENT ON TABLE payment_events IS 'webhook + confirm 이벤트 ledger. event_key UNIQUE로 중복 처리.';
COMMENT ON TABLE token_ledger IS '크레딧 모든 변동 기록. idempotency_key UNIQUE로 중복 충전/소비/환불 방지.';
COMMENT ON TABLE payment_reconciliation_jobs IS '결제 ↔ 크레딧 ↔ webhook 불일치 자동 감지 + 수동 보정 큐.';
