-- Track B Phase 1 — 건축공사 견적서 + 입면전개도 패키지
-- 가이드: c:\Users\user\Downloads\inpick-construction-estimate-drawing-package-plan-20260511.md §5
-- 작성일: 2026-05-11

-- ============================================================
-- 1) estimate_document_snapshots — 갑지 + 총괄표 + 내역서 발행 스냅샷
--    정책: 발행 시점에 모든 계정정보/견적/자재 스냅샷 저장
--          → 이후 사용자가 정보 변경해도 과거 문서는 불변
-- ============================================================
CREATE TABLE IF NOT EXISTS estimate_document_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  rfq_id UUID NULL,
  bid_id UUID NULL,
  contract_id UUID NULL,
  consumer_id UUID NOT NULL,
  contractor_id UUID NULL,

  -- 3가지 mode
  mode TEXT NOT NULL CHECK (mode IN ('consumer_preview', 'contractor_bid', 'matched_contract')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'submitted', 'accepted', 'voided')),

  -- 문서 번호 (예: INP-QT-20260511-AB12CD-V01)
  document_no TEXT NOT NULL UNIQUE,
  version INT NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT '공사 견적서',

  -- 스냅샷 (JSONB) — 발행 시점 정보 고정
  project_snapshot JSONB NOT NULL,
  consumer_snapshot JSONB NOT NULL,
  contractor_snapshot JSONB NULL,
  inpick_snapshot JSONB NULL,
  summary_snapshot JSONB NOT NULL,         -- 재료비/노무비/경비/간접비/이윤/공급가/VAT/총액
  trade_summary_snapshot JSONB NOT NULL,   -- 17공종별 집계
  line_snapshot JSONB NOT NULL,            -- 공종별내역서 (배열)
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- PDF 저장 URL
  pdf_url TEXT NULL,
  pdf_storage_path TEXT NULL,

  -- 변경 감지용 hash
  scope_hash TEXT NOT NULL,
  estimate_hash TEXT NOT NULL,
  material_hash TEXT NULL,

  -- 유효기간
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NULL,

  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimate_doc_project ON estimate_document_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_estimate_doc_rfq ON estimate_document_snapshots(rfq_id);
CREATE INDEX IF NOT EXISTS idx_estimate_doc_bid ON estimate_document_snapshots(bid_id);
CREATE INDEX IF NOT EXISTS idx_estimate_doc_contract ON estimate_document_snapshots(contract_id);
CREATE INDEX IF NOT EXISTS idx_estimate_doc_contractor ON estimate_document_snapshots(contractor_id);
CREATE INDEX IF NOT EXISTS idx_estimate_doc_mode_status ON estimate_document_snapshots(mode, status);
CREATE INDEX IF NOT EXISTS idx_estimate_doc_issued ON estimate_document_snapshots(issued_at DESC);

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_estimate_doc'
  ) THEN
    CREATE TRIGGER set_updated_at_estimate_doc
      BEFORE UPDATE ON estimate_document_snapshots
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;


-- ============================================================
-- 2) construction_drawing_sets 확장 — 입면전개도 패키지 메타
-- ============================================================
ALTER TABLE construction_drawing_sets
  ADD COLUMN IF NOT EXISTS source_estimate_document_id UUID NULL REFERENCES estimate_document_snapshots(id),
  ADD COLUMN IF NOT EXISTS source_scope_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS source_floorplan_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS source_material_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS drawing_package_type TEXT NULL DEFAULT 'contractor_elevation_package',
  ADD COLUMN IF NOT EXISTS visibility TEXT NULL DEFAULT 'matched_contractor_only',
  ADD COLUMN IF NOT EXISTS quality_status TEXT NULL DEFAULT 'generated',
  ADD COLUMN IF NOT EXISTS revision INT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_cds_source_estimate ON construction_drawing_sets(source_estimate_document_id);
CREATE INDEX IF NOT EXISTS idx_cds_scope_hash ON construction_drawing_sets(source_scope_hash);


-- ============================================================
-- 3) construction_drawings 확장 — 방별/벽별 입면 메타
-- ============================================================
ALTER TABLE construction_drawings
  ADD COLUMN IF NOT EXISTS room_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS room_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS wall_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS drawing_kind TEXT NULL,   -- 'elevation' | 'plan' | 'detail' 등
  ADD COLUMN IF NOT EXISTS svg_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS source_geometry_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS warnings JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_cd_drawing_kind ON construction_drawings(drawing_kind);
CREATE INDEX IF NOT EXISTS idx_cd_room ON construction_drawings(room_id);


-- ============================================================
-- 4) RLS 정책
-- ============================================================
ALTER TABLE estimate_document_snapshots ENABLE ROW LEVEL SECURITY;

-- 소비자: 본인 project read
CREATE POLICY estimate_doc_consumer_read
  ON estimate_document_snapshots
  FOR SELECT
  USING (consumer_id = auth.uid());

-- 사업자: 자기 contractor_id의 문서 read/write
-- (service_role admin client 사용은 PostgreSQL RLS 우회 — JWT consumer_id로 검증)
CREATE POLICY estimate_doc_contractor_read
  ON estimate_document_snapshots
  FOR SELECT
  USING (
    contractor_id IS NOT NULL
    AND (
      -- 사업자 JWT는 별도 시스템 — service_role 경유 검증을 권장 (API 레이어)
      auth.role() = 'service_role'
    )
  );

CREATE POLICY estimate_doc_service_all
  ON estimate_document_snapshots
  FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- Comment
-- ============================================================
COMMENT ON TABLE estimate_document_snapshots IS
  'Track B Phase 1 — 견적서 발행 시점 스냅샷. 계정정보 변경 후에도 과거 문서 불변. 3 모드: consumer_preview/contractor_bid/matched_contract.';

COMMENT ON COLUMN construction_drawing_sets.source_estimate_document_id IS
  'Track B — 입면전개도 생성 시 사용된 estimate_document_snapshots.id. hash와 함께 stale 검증.';

COMMENT ON COLUMN construction_drawing_sets.visibility IS
  'Track B — matched_contractor_only / public / private. RLS와 API 권한 게이트에서 사용.';
