-- ============================================================
-- material_price_observations
-- Worker 1 가격 크롤러용: 제품별 가격 관측 이력
-- 기존 material_prices (공표가 독립 테이블)와 역할 분리.
--
-- 우선순위 표현:
--   source_tier='official' (조달청 나라장터 등) → 주 가격
--   source_tier='market'   (쿠팡/11번가/네이버쇼핑)   → 참고 단가
--   source_tier='manufacturer' (LX/TOTO/KCC 자사몰) → 보조 참고
-- ============================================================

CREATE TABLE IF NOT EXISTS material_price_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES material_products(id) ON DELETE CASCADE,

  price NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KRW',
  unit TEXT,

  source TEXT NOT NULL,        -- 'g2b' | 'coupang' | 'naver_shop' | '11st' | 'lx_hausys' ...
  source_tier TEXT NOT NULL CHECK (source_tier IN ('official', 'market', 'manufacturer')),

  url TEXT,
  raw_meta JSONB,

  crawled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_latest BOOLEAN NOT NULL DEFAULT true
);

-- 조회 패턴 인덱스
CREATE INDEX IF NOT EXISTS idx_mpo_material_tier_latest
  ON material_price_observations(material_id, source_tier, is_latest);

CREATE INDEX IF NOT EXISTS idx_mpo_material_crawled
  ON material_price_observations(material_id, crawled_at DESC);

CREATE INDEX IF NOT EXISTS idx_mpo_source
  ON material_price_observations(source, crawled_at DESC);

-- 같은 (material, source) 조합에서 is_latest=true 는 1건만 유지
CREATE UNIQUE INDEX IF NOT EXISTS uq_mpo_material_source_latest
  ON material_price_observations(material_id, source)
  WHERE is_latest = true;

-- ============================================================
-- 새 관측이 insert되면 같은 (material_id, source) 기존 행의 is_latest=false 처리
-- ============================================================
CREATE OR REPLACE FUNCTION mpo_mark_previous_not_latest()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_latest THEN
    UPDATE material_price_observations
       SET is_latest = false
     WHERE material_id = NEW.material_id
       AND source = NEW.source
       AND id <> NEW.id
       AND is_latest = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- BEFORE INSERT: UNIQUE INDEX(uq_mpo_material_source_latest)가 INSERT 시점에
-- 체크되므로, 기존 is_latest=true 행을 먼저 false로 내려야 새 행의 UNIQUE 통과.
DROP TRIGGER IF EXISTS trg_mpo_latest ON material_price_observations;
CREATE TRIGGER trg_mpo_latest
  BEFORE INSERT ON material_price_observations
  FOR EACH ROW EXECUTE FUNCTION mpo_mark_previous_not_latest();

-- ============================================================
-- 조회 편의 뷰: 제품별 대표 가격 (조달청 우선, 없으면 제조사, 없으면 오픈마켓)
-- ============================================================
CREATE OR REPLACE VIEW material_price_primary AS
SELECT DISTINCT ON (material_id)
  material_id,
  price,
  currency,
  unit,
  source,
  source_tier,
  url,
  crawled_at
FROM material_price_observations
WHERE is_latest = true
ORDER BY material_id,
         CASE source_tier
           WHEN 'official' THEN 1
           WHEN 'manufacturer' THEN 2
           WHEN 'market' THEN 3
           ELSE 99
         END,
         crawled_at DESC;

-- 참고 단가: 대표가 제외 나머지 latest (UI 부제목으로 노출용)
CREATE OR REPLACE VIEW material_price_references AS
SELECT
  mpo.material_id,
  mpo.price,
  mpo.currency,
  mpo.unit,
  mpo.source,
  mpo.source_tier,
  mpo.url,
  mpo.crawled_at
FROM material_price_observations mpo
JOIN material_price_primary mpp
  ON mpp.material_id = mpo.material_id
WHERE mpo.is_latest = true
  AND mpo.id <> (
    SELECT id FROM material_price_observations m2
    WHERE m2.material_id = mpp.material_id
      AND m2.source = mpp.source
      AND m2.is_latest = true
    LIMIT 1
  );

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE material_price_observations ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 (견적 UI 노출용)
DROP POLICY IF EXISTS mpo_public_read ON material_price_observations;
CREATE POLICY mpo_public_read ON material_price_observations
  FOR SELECT USING (true);

-- 쓰기는 service_role만 (크롤러)
DROP POLICY IF EXISTS mpo_service_write ON material_price_observations;
CREATE POLICY mpo_service_write ON material_price_observations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE material_price_observations IS
  'Worker 1 가격 크롤러 관측 이력. 기존 material_prices(KPRC 공표 단가표)와 별개 용도.';
COMMENT ON COLUMN material_price_observations.source_tier IS
  'official=조달청/공공, manufacturer=제조사 자사몰, market=오픈마켓 참고가';
