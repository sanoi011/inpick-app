-- ════════════════════════════════════════════════════════════════════════════
-- contracts.contractor_snapshot + applied_indirect_rates — Phase 3 (spec §A-1, §E-Phase3)
--
-- 핵심: 입찰 선정 → 계약 체결 시점에 "그 시점의" 사업자 정보 + 적용 요율을 contracts에
-- 동결(snapshot). 견적서 갑지 자동 주입 + 사업자 정보 변경되어도 계약서/견적서 무결성.
--
-- contractor_snapshot 구조 (spec §A-1 — 시공자 칸 5필드):
--   { company_name, representative, biz_no, address, phone, email }
--
-- applied_indirect_rates 구조 (선정 시점 bid_indirect_rates 미러):
--   { elevator_protection, entrance_protection, scaffolding, waste_disposal,
--     safety_rate, general_management_rate, profit_rate,
--     is_modified_from_default, modification_reason }
--
-- 정책 동기화: src/lib/inpick/indirect-rates.ts BidRateOverride
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS contractor_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS applied_indirect_rates JSONB;

CREATE INDEX IF NOT EXISTS idx_contracts_has_snapshot
  ON contracts((contractor_snapshot IS NOT NULL));

COMMENT ON COLUMN contracts.contractor_snapshot IS '계약 체결 시점의 사업자 정보 동결 (spec §A-1 갑지 시공자 칸 5필드)';
COMMENT ON COLUMN contracts.applied_indirect_rates IS '계약 체결 시점의 bid_indirect_rates 미러 — 견적서 갑지/총괄표 재생성용';
