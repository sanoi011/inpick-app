-- 2026-05-19: 관리자 가격 설정 + checkout snapshot 인프라
--
-- 가이드: INPICK_BILLING_CHECKOUT_ADMIN_PRICING_DEV_PLAN_20260519.md
--
-- 원칙:
--   * 현재 가격은 DB에서 읽는다 (payment_products + pricing_versions)
--   * 결제 생성 시점 가격은 payment_intents에 snapshot 고정
--   * finalize는 snapshot 기준으로 지급 → 가격 변경이 과거 결제에 영향 X
--   * 가격 변경은 pricing_audit_logs에 기록
--   * 토큰 판매 가격 ≠ 이미지 생성 소모 토큰 (분리)

-- ─── §1. pricing_versions ───────────────────────────────
-- 전체 가격 정책 버전 (기준 단가/회원가입 보너스/이미지 소모/PDF 가격)

CREATE TABLE IF NOT EXISTS pricing_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  base_token_unit_price_krw INTEGER NOT NULL DEFAULT 500,
  signup_bonus_tokens INTEGER NOT NULL DEFAULT 10,
  image_generation_token_cost INTEGER NOT NULL DEFAULT 1,
  pdf_single_price_krw INTEGER NOT NULL DEFAULT 9900,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  created_by UUID,
  approved_by UUID,
  published_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  memo TEXT,
  CONSTRAINT pricing_versions_status_check CHECK (status IN ('draft','scheduled','active','archived'))
);

-- active 버전은 동시에 1개만
CREATE UNIQUE INDEX IF NOT EXISTS pricing_versions_one_active_idx
  ON pricing_versions ((status)) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS pricing_versions_status_idx ON pricing_versions(status);
CREATE INDEX IF NOT EXISTS pricing_versions_effective_idx ON pricing_versions(effective_from, effective_to);

-- updated_at 트리거
CREATE TRIGGER trg_pricing_versions_updated_at
  BEFORE UPDATE ON pricing_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 초기 active 버전 (현재 단가 반영)
INSERT INTO pricing_versions (
  version_name, status, base_token_unit_price_krw, signup_bonus_tokens,
  image_generation_token_cost, pdf_single_price_krw,
  effective_from, published_at, memo
) VALUES (
  'v1.0 (2026-05-19 초기)', 'active', 500, 10, 1, 9900,
  NOW(), NOW(),
  '2026-05-14 pricing v2 정책: 토큰 500원/이미지 1토큰/회원가입 10토큰/PDF 9,900원'
)
ON CONFLICT DO NOTHING;

-- ─── §2. pricing_audit_logs ─────────────────────────────
-- 관리자 가격 변경 이력. 변경 전/후 + 사유 + 변경자.

CREATE TABLE IF NOT EXISTS pricing_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  before_value JSONB,
  after_value JSONB,
  reason TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pricing_audit_logs_actor_idx ON pricing_audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pricing_audit_logs_target_idx ON pricing_audit_logs(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pricing_audit_logs_action_idx ON pricing_audit_logs(action, created_at DESC);

COMMENT ON TABLE pricing_audit_logs IS '가격 정책 변경 이력 — 변경자/사유/before·after JSON 보존';

-- ─── §3. token_consumption_rules ────────────────────────
-- 서비스 이용 시 차감 토큰 규칙 (가격 ≠ 소모량 분리)

CREATE TABLE IF NOT EXISTS token_consumption_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  token_cost INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  pricing_version_id UUID REFERENCES pricing_versions(id),
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  memo TEXT,
  CONSTRAINT token_consumption_rules_cost_check CHECK (token_cost >= 0)
);

CREATE TRIGGER trg_token_consumption_rules_updated_at
  BEFORE UPDATE ON token_consumption_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO token_consumption_rules (rule_key, display_name, token_cost, is_active, memo) VALUES
  ('image_generation.standard', 'AI 디자인 이미지 1장 생성 (기본)', 1, TRUE, '기본 이미지 생성 — Step2'),
  ('image_generation.hd', 'AI 디자인 고해상도 이미지 1장 생성', 2, FALSE, '추후 옵션 (현재 비활성)'),
  ('image_generation.variation', 'AI 디자인 변형 이미지 1장 생성', 1, FALSE, '추후 옵션 (현재 비활성)')
ON CONFLICT (rule_key) DO NOTHING;

COMMENT ON TABLE token_consumption_rules IS '서비스 이용 시 차감 토큰 규칙 — 토큰 판매 가격과 분리';

-- ─── §4. payment_products 보강 ──────────────────────────
-- 기존 컬럼(code, product_type, name_ko, description_ko, amount_krw, credit_amount, bonus_credit_amount, is_active, sort_order, metadata)
-- + 가격 정책 versioning + 노출 제어 + 효력 기간

ALTER TABLE payment_products
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pricing_version_id UUID REFERENCES pricing_versions(id),
  ADD COLUMN IF NOT EXISTS admin_note TEXT,
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS effective_to TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

-- 기존 상품들에 active pricing version 연결
UPDATE payment_products
SET pricing_version_id = (SELECT id FROM pricing_versions WHERE status = 'active' LIMIT 1)
WHERE pricing_version_id IS NULL;

-- 인기 상품 표시 (기존 정책: 30+3이 인기)
UPDATE payment_products SET is_popular = TRUE WHERE code = 'ai_credit_30';

-- ─── §5. payment_intents snapshot 보강 ──────────────────
-- checkout 생성 시점의 상품 가격을 고정. finalize는 이 snapshot 기준 지급.

ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS pricing_version_id UUID REFERENCES pricing_versions(id),
  ADD COLUMN IF NOT EXISTS product_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS token_amount INTEGER,
  ADD COLUMN IF NOT EXISTS bonus_token_amount INTEGER;

COMMENT ON COLUMN payment_intents.product_snapshot IS 'checkout 시점의 상품 전체 snapshot JSON. finalize는 이를 기준으로 지급 (현재 payment_products 값 무시)';

-- ─── §6. RLS — pricing_audit_logs는 관리자만 SELECT ────
-- (admin API는 service role로 우회. 일반 사용자 read 차단)

ALTER TABLE pricing_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_consumption_rules ENABLE ROW LEVEL SECURITY;

-- 사용자는 active pricing version + active consumption rules만 read 가능
CREATE POLICY "pricing_versions_public_read"
  ON pricing_versions FOR SELECT
  USING (status = 'active');

CREATE POLICY "token_consumption_rules_public_read"
  ON token_consumption_rules FOR SELECT
  USING (is_active = TRUE);

-- pricing_audit_logs는 service role만 (관리자 API)
-- INSERT/UPDATE/DELETE는 모두 service role로만 (정책 미생성 = 차단)

-- ─── §7. 완료 알림 ──────────────────────────────────────
DO $$
DECLARE
  v_pv INT;
  v_pp INT;
  v_tcr INT;
BEGIN
  SELECT COUNT(*) INTO v_pv FROM pricing_versions WHERE status = 'active';
  SELECT COUNT(*) INTO v_pp FROM payment_products WHERE is_active = TRUE;
  SELECT COUNT(*) INTO v_tcr FROM token_consumption_rules WHERE is_active = TRUE;
  RAISE NOTICE '[migration 20260519] active pricing versions=%, active payment_products=%, active consumption_rules=%',
    v_pv, v_pp, v_tcr;
END $$;
