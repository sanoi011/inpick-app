-- 2026-04-22: 타일·석재·엔지니어스톤·인조대리석·월패널 세분 카테고리 + 구조변경 트랙 분리
-- 딥러닝 학습 시 네임스페이스 충돌 방지:
--   MAT_*  : 자재 (material_products)
--   LAW_*  : 법규 조문
--   CASE_* : 구조변경·리모델링 사례
-- 기존 ARCH_*, MECH_*, ELEC_* 는 유지 (material_products.category_code 하위)

-- 1) 자재 세분 카테고리 (MAT_ 네임스페이스 + 기존 ARCH_ 호환)
-- category_taxonomy 에 존재하지 않는 경우에만 추가.

INSERT INTO category_taxonomy (code, name_ko, name_en, parent_code, level, domain) VALUES
  -- 타일 세분 (표면 재질별)
  ('ARCH_TILE_PORCELAIN',        '포셀린 타일',        'Porcelain Tile',        'ARCH_FLOOR_TILE', 3, 'architecture'),
  ('ARCH_TILE_CERAMIC',          '도기질 타일',        'Ceramic Tile',          'ARCH_FLOOR_TILE', 3, 'architecture'),
  ('ARCH_TILE_MOSAIC',           '모자이크 타일',      'Mosaic Tile',           'ARCH_FLOOR_TILE', 3, 'architecture'),
  ('ARCH_TILE_TERRAZZO',         '테라조',             'Terrazzo',              'ARCH_FLOOR_TILE', 3, 'architecture'),

  -- 석재 / 엔지니어스톤 / 인조대리석
  ('ARCH_STONE_NATURAL',         '천연석재',           'Natural Stone',         'ARCH_WALL',       2, 'architecture'),
  ('ARCH_STONE_NATURAL_MARBLE',  '대리석',             'Marble',                'ARCH_STONE_NATURAL', 3, 'architecture'),
  ('ARCH_STONE_NATURAL_GRANITE', '화강석',             'Granite',               'ARCH_STONE_NATURAL', 3, 'architecture'),
  ('ARCH_STONE_NATURAL_LIMESTONE','라임스톤',          'Limestone',             'ARCH_STONE_NATURAL', 3, 'architecture'),
  ('ARCH_STONE_ENG',             '엔지니어스톤',       'Engineered Stone',      'ARCH_WALL',       2, 'architecture'),
  ('ARCH_STONE_ACRYLIC',         '인조대리석(아크릴)', 'Acrylic Solid Surface', 'ARCH_WALL',       2, 'architecture'),

  -- 월패널 (판재 시공)
  ('ARCH_WALL_PANEL',            '월패널',             'Wall Panel',            'ARCH_WALL',       2, 'architecture'),
  ('ARCH_WALL_PANEL_3D',         '3D 월패널',          '3D Wall Panel',         'ARCH_WALL_PANEL', 3, 'architecture'),
  ('ARCH_WALL_PANEL_LAMINATE',   '라미네이트 월패널',  'Laminate Wall Panel',   'ARCH_WALL_PANEL', 3, 'architecture'),
  ('ARCH_WALL_PANEL_STONE',      '석재 월패널',        'Stone Wall Panel',      'ARCH_WALL_PANEL', 3, 'architecture'),

  -- 부위 서픽스는 별도 컬럼(material_products.usage_zone)으로 관리 추천
  ('ARCH_TILE_BATH',             '욕실용 타일',        'Bathroom Tile',         'ARCH_FLOOR_TILE', 3, 'architecture'),
  ('ARCH_TILE_KITCHEN',          '주방용 타일',        'Kitchen Tile',          'ARCH_FLOOR_TILE', 3, 'architecture'),
  ('ARCH_TILE_EXT',              '외장용 타일',        'Exterior Tile',         'ARCH_FLOOR_TILE', 3, 'architecture')
ON CONFLICT (code) DO NOTHING;

-- 2) material_products 에 물성 메타 컬럼 (없으면 추가)
ALTER TABLE material_products
  ADD COLUMN IF NOT EXISTS thickness_mm   numeric,
  ADD COLUMN IF NOT EXISTS size_spec      text,       -- 예: "600x600mm", "3200x1600mm"
  ADD COLUMN IF NOT EXISTS surface_finish text,       -- Polished / Suede / Matte / Volcano 등
  ADD COLUMN IF NOT EXISTS origin_country text,       -- 원산지 ISO 코드 or 국가명
  ADD COLUMN IF NOT EXISTS usage_zone     text;       -- bath / kitchen / living / exterior (자유 태그 가능)

COMMENT ON COLUMN material_products.thickness_mm IS '두께(mm). 타일·석재·패널 등 면재용.';
COMMENT ON COLUMN material_products.size_spec IS '표준 규격 문자열. 600x600mm, 3200x1600mm 등.';
COMMENT ON COLUMN material_products.surface_finish IS '표면 마감. Polished/Suede/Matte/Volcano/Honed 등 자유 태그.';
COMMENT ON COLUMN material_products.origin_country IS '원산지(ISO-3166 alpha-2 또는 한글 국가명).';
COMMENT ON COLUMN material_products.usage_zone IS '권장 시공 부위. bath/kitchen/living/exterior.';

-- 3) 법규·구조변경 트랙 (material 과 분리된 독립 테이블)
CREATE TABLE IF NOT EXISTS building_regulations (
  id            bigserial PRIMARY KEY,
  source        text NOT NULL,                         -- "law.go.kr", "elis.go.kr" 등
  law_name      text NOT NULL,                         -- "건축법", "주택법"
  article       text,                                  -- "제77조의4"
  paragraph     text,                                  -- "제1항 제2호"
  body_text     text NOT NULL,                         -- 조문 본문
  effective_date date,
  amended_date  date,
  source_url    text,
  tags          text[],                                -- ["리모델링","비내력벽","대수선"]
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_regulations_lawname ON building_regulations (law_name);
CREATE INDEX IF NOT EXISTS idx_regulations_tags ON building_regulations USING gin (tags);

CREATE TABLE IF NOT EXISTS structural_mod_cases (
  id                bigserial PRIMARY KEY,
  title             text NOT NULL,
  source            text NOT NULL,                     -- "AURI", "LHI", "molit", "codil"
  source_url        text,
  document_type     text,                              -- "report" / "case_study" / "guideline"
  published_date    date,
  summary           text,
  building_type     text,                              -- 공동주택 / 단독 / 상가
  remodel_scope     text[],                            -- ["비내력벽_제거","방배치_변경","주방_확장"]
  before_floorplan_path text,                          -- 로컬 경로 또는 URL
  after_floorplan_path  text,
  pdf_path          text,
  image_paths       text[],
  metadata          jsonb,
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cases_source ON structural_mod_cases (source);
CREATE INDEX IF NOT EXISTS idx_cases_remodel_scope ON structural_mod_cases USING gin (remodel_scope);

COMMENT ON TABLE building_regulations IS '건축·주택·리모델링 법규 조문. material_products 와 분리된 독립 트랙 (딥러닝 데이터 엉킴 방지).';
COMMENT ON TABLE structural_mod_cases IS '비내력 구조변경·리모델링 실제 사례 도면·보고서. material_products 와 독립.';
