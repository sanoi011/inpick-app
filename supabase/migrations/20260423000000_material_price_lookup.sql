-- 2026-04-23: G2B 17,229건 → 61 단가 버킷을 담는 견적 엔진 v0 lookup 테이블.
-- 소스: D:/InPick/data/materials/validation_reports/price_lookup_v0.json
-- 업서트 스크립트: D:/InPick/data/materials/upload_price_lookup.py

CREATE TABLE IF NOT EXISTS material_price_lookup (
  id              bigserial PRIMARY KEY,
  prdct_clsfc_no  text NOT NULL,                 -- 조달청 품목분류번호 (8자리)
  product_name    text NOT NULL,
  unit            text NOT NULL,                 -- 톤, 개, m², 본 등
  category_code   text,                          -- category_taxonomy.code (ARCH_*, MECH_*, ELEC_*)
  confidence      text CHECK (confidence IN ('A','B','C','D','E')),
  n_samples       integer NOT NULL,              -- 집계 건수
  median_price    numeric NOT NULL,
  p10_price       numeric,
  p90_price       numeric,
  min_price       numeric,
  max_price       numeric,
  spread_ratio    numeric,                       -- max/min
  p90_p10_ratio   numeric,                       -- 실용적 spread
  source          text NOT NULL DEFAULT 'G2B_MAS',
  source_version  text,                          -- 'v0'
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (prdct_clsfc_no, source_version)
);

CREATE INDEX IF NOT EXISTS idx_price_lookup_category  ON material_price_lookup (category_code);
CREATE INDEX IF NOT EXISTS idx_price_lookup_confidence ON material_price_lookup (confidence);
CREATE INDEX IF NOT EXISTS idx_price_lookup_clsfc     ON material_price_lookup (prdct_clsfc_no);

COMMENT ON TABLE material_price_lookup IS '공공조달(G2B MAS) 실거래 기반 품목별 단가 lookup. 견적 엔진 v0에서 자재 단가 fallback으로 사용.';
COMMENT ON COLUMN material_price_lookup.confidence IS 'A(n≥500,spread≤2), B(n≥200,spread≤4), C(n≥50,spread≤8), D(n≥20), E(그 외).';
COMMENT ON COLUMN material_price_lookup.p90_p10_ratio IS 'p90/p10 비율. 실용적 스프레드 지표.';
