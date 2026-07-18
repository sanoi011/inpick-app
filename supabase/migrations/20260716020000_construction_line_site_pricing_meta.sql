-- 철거·전기·설비 현장확인 가견적 메타를 발행 견적 라인에도 영속한다.

ALTER TABLE construction_estimate_lines
  ADD COLUMN IF NOT EXISTS pricing_basis text,
  ADD COLUMN IF NOT EXISTS contractor_editable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS site_verification_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS variation_notice text,
  ADD COLUMN IF NOT EXISTS site_adjustment_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS site_condition_adjustment_factor numeric,
  ADD COLUMN IF NOT EXISTS site_condition_adjustment_reason text;

COMMENT ON COLUMN construction_estimate_lines.pricing_basis IS
  'fixed / standard_unit / site_allowance';
COMMENT ON COLUMN construction_estimate_lines.site_condition_adjustment_factor IS
  '소비자 사전 현장조건 답변을 기본단가에 적용한 배율';
