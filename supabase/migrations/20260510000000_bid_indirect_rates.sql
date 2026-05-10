-- ════════════════════════════════════════════════════════════════════════════
-- bid_indirect_rates — 사업자별 입찰 시점 간접비 요율 override
-- 가이드: InPick_Quote_System_Spec.md §D-3 (Phase 2)
--
-- 핵심:
--   - bid 1개 = bid_indirect_rates 1개 (UNIQUE bid_id)
--   - bids INSERT 시 trigger로 default 값 자동 채움 (DEFAULT_INDIRECT_RATES_2026 미러)
--   - 사업자가 입찰 마감 전 수정 가능 (status='pending'일 때만)
--   - 산업안전보건관리비 법정 최저값(3.11%) 미만 / 일반관리비 6% 초과 / 이윤 25% 초과 거부 (API 검증)
--
-- 정책 동기화: src/lib/inpick/indirect-rates.ts DEFAULT_INDIRECT_RATES_2026
--   - 가설공사비: 350K + 180K + 250K + 480K (식)
--   - 산업안전보건관리비: 3.11% (5억 미만)
--   - 일반관리비: 5% (한도 6%)
--   - 이윤: 10% (한도 25%)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bid_indirect_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,

  -- 가설공사비 (고정 금액, 사업자 조정 가능)
  elevator_protection NUMERIC(12,2) NOT NULL DEFAULT 350000,
  entrance_protection NUMERIC(12,2) NOT NULL DEFAULT 180000,
  scaffolding         NUMERIC(12,2) NOT NULL DEFAULT 250000,
  waste_disposal      NUMERIC(12,2) NOT NULL DEFAULT 480000,

  -- 요율 (소수, 0.0311 = 3.11%)
  safety_rate              NUMERIC(6,4) NOT NULL DEFAULT 0.0311,
  general_management_rate  NUMERIC(6,4) NOT NULL DEFAULT 0.0500,
  profit_rate              NUMERIC(6,4) NOT NULL DEFAULT 0.1000,

  -- 메타
  is_modified_from_default BOOLEAN NOT NULL DEFAULT FALSE,
  modification_reason      TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(bid_id),

  -- 법정 한도 체크 (API 검증과 이중 안전장치)
  CHECK (safety_rate >= 0.0311),                    -- 산안비 법정 최저값
  CHECK (general_management_rate BETWEEN 0 AND 0.06), -- 일반관리비 6% 한도
  CHECK (profit_rate BETWEEN 0 AND 0.25),           -- 이윤 25% 한도
  CHECK (elevator_protection >= 0),
  CHECK (entrance_protection >= 0),
  CHECK (scaffolding >= 0),
  CHECK (waste_disposal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_bid_indirect_rates_bid_id ON bid_indirect_rates(bid_id);

-- bid INSERT 시 default rates 자동 생성
CREATE OR REPLACE FUNCTION init_bid_indirect_rates() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO bid_indirect_rates (bid_id) VALUES (NEW.id)
  ON CONFLICT (bid_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_init_bid_rates ON bids;
CREATE TRIGGER trg_init_bid_rates
AFTER INSERT ON bids
FOR EACH ROW
EXECUTE FUNCTION init_bid_indirect_rates();

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION touch_bid_indirect_rates_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_bid_rates ON bid_indirect_rates;
CREATE TRIGGER trg_touch_bid_rates
BEFORE UPDATE ON bid_indirect_rates
FOR EACH ROW
EXECUTE FUNCTION touch_bid_indirect_rates_updated_at();

-- 기존 bids에 누락된 행 backfill
INSERT INTO bid_indirect_rates (bid_id)
SELECT id FROM bids
WHERE id NOT IN (SELECT bid_id FROM bid_indirect_rates)
ON CONFLICT (bid_id) DO NOTHING;

-- RLS — 사업자 인증은 API 레이어(getContractorIdFromRequest + 소유권 검증)에서 처리하므로 service_role 전용
ALTER TABLE bid_indirect_rates ENABLE ROW LEVEL SECURITY;
-- 정책 없음 → service_role만 접근

COMMENT ON TABLE bid_indirect_rates IS '사업자 입찰 시 간접비 요율 override (spec §D). DEFAULT_INDIRECT_RATES_2026 미러 + 법정 한도 CHECK.';
COMMENT ON COLUMN bid_indirect_rates.safety_rate IS '산업안전보건관리비 — 법정 최저값 3.11% (고용노동부 고시 2025-11호)';
COMMENT ON COLUMN bid_indirect_rates.general_management_rate IS '일반관리비 — 50억 미만 한도 6% (KPI 원가계산 제비율)';
COMMENT ON COLUMN bid_indirect_rates.profit_rate IS '기업이윤 — 한도 25% (KPI 영업이익)';
