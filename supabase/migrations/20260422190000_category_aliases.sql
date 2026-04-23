-- category_aliases: 소스별 raw 카테고리명 → 표준 taxonomy code 매핑
-- 2026-04-22: 다국적/다소스 자재 통합 표준화
--
-- 사용 예:
--   INSERT INTO category_aliases(source, raw_term, taxonomy_code, confidence)
--   VALUES ('lx_hausys', '강마루', 'ARCH_FLOOR_LAM', 'manual');
--
-- 검색:
--   SELECT taxonomy_code FROM category_aliases
--   WHERE raw_term ILIKE '%강화마루%';

CREATE TABLE IF NOT EXISTS category_aliases (
  id            bigserial PRIMARY KEY,
  source        text NOT NULL,
  raw_term      text NOT NULL,
  taxonomy_code text REFERENCES category_taxonomy(code) ON DELETE SET NULL,
  confidence    text CHECK (confidence IN ('high','manual','auto')) DEFAULT 'manual',
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(source, raw_term)
);

CREATE INDEX IF NOT EXISTS idx_cat_aliases_raw ON category_aliases (raw_term);
CREATE INDEX IF NOT EXISTS idx_cat_aliases_code ON category_aliases (taxonomy_code);
CREATE INDEX IF NOT EXISTS idx_cat_aliases_src ON category_aliases (source);

COMMENT ON TABLE category_aliases IS
  '소스별 raw 카테고리 용어를 표준 taxonomy_code 에 매핑. LX "강마루" = KCC "강화마루" = 조달청 "라미네이트 플로어링" = ARCH_FLOOR_LAM 같은 동의어 통합.';
COMMENT ON COLUMN category_aliases.source IS
  '소스 식별자. "lx_hausys", "g2b_mas", "seed"(기본 사전), "user_input" 등.';
COMMENT ON COLUMN category_aliases.raw_term IS
  '원문 카테고리명. 한국어/일본어/영어 그대로.';
COMMENT ON COLUMN category_aliases.confidence IS
  'high=자동 검증 통과, manual=사용자/시드 입력, auto=AI 추천(미검증).';

-- 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION tg_touch_category_aliases() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cat_aliases_touch ON category_aliases;
CREATE TRIGGER trg_cat_aliases_touch
BEFORE UPDATE ON category_aliases
FOR EACH ROW EXECUTE FUNCTION tg_touch_category_aliases();
