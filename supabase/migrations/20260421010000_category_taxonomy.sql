-- ============================================================
-- category_taxonomy : 4계층 카테고리 트리 (Domain → Category → Sub → Variant)
--   L1 Domain       : electrical / mechanical / architecture
--   L2 Category     : 조명 / 스위치 / 급수배관 / 바닥재 ...
--   L3 SubCategory  : 천장LED / 융스위치 / 샤워수전 ...
--   L4 Variant      : 4구 / 4인치 / 15A / SD400 ...
--
-- material_products.category_code 는 이 테이블의 code 값을 참조.
-- 데이터(제품)는 없어도 카테고리 체계만 선제적으로 구축.
-- ============================================================

CREATE TABLE IF NOT EXISTS category_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,             -- 'ELEC_LIGHT_CEIL_LED_DOWN_4IN'
  parent_code TEXT,                      -- 'ELEC_LIGHT_CEIL_LED_DOWN'
  level SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 4),
  domain TEXT NOT NULL CHECK (domain IN ('electrical','mechanical','architecture')),
  name_ko TEXT NOT NULL,
  name_en TEXT,
  typical_unit TEXT,                     -- 'EA','m','m²','kg','t','본','조'
  typical_rooms TEXT[],                  -- ['bedroom','kitchen','bathroom',...]
  aliases TEXT[],                        -- 업계 관용어 (융스위치, 서비스니쁠 등)
  notes TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ct_parent ON category_taxonomy(parent_code);
CREATE INDEX IF NOT EXISTS idx_ct_level  ON category_taxonomy(level);
CREATE INDEX IF NOT EXISTS idx_ct_domain ON category_taxonomy(domain, level, sort_order);

-- 자기참조 무결성 체크 트리거 (parent_code는 반드시 존재하거나 NULL)
CREATE OR REPLACE FUNCTION ct_validate_parent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_code IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM category_taxonomy WHERE code = NEW.parent_code) THEN
      RAISE EXCEPTION 'parent_code "%" 가 category_taxonomy 에 없음', NEW.parent_code;
    END IF;
    IF NEW.level = 1 THEN
      RAISE EXCEPTION 'level 1 (Domain) 은 parent_code 를 가질 수 없음';
    END IF;
  ELSE
    IF NEW.level <> 1 THEN
      RAISE EXCEPTION 'parent_code 없는 행은 level 1 만 허용';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ct_validate_parent ON category_taxonomy;
CREATE TRIGGER trg_ct_validate_parent
  BEFORE INSERT OR UPDATE ON category_taxonomy
  FOR EACH ROW EXECUTE FUNCTION ct_validate_parent();

ALTER TABLE category_taxonomy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ct_public_read ON category_taxonomy;
CREATE POLICY ct_public_read ON category_taxonomy FOR SELECT USING (true);
DROP POLICY IF EXISTS ct_service_write ON category_taxonomy;
CREATE POLICY ct_service_write ON category_taxonomy
  FOR ALL USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role');

COMMENT ON TABLE category_taxonomy IS 'InPick 4계층 자재 카테고리 트리 — 데이터 없이 체계만 선제 구축';
