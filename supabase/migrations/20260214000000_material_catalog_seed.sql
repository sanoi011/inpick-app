-- 자재 카탈로그 DB화 (기존 MATERIAL_CATALOG 하드코딩 → DB)

-- 1) 방 타입별 자재 카테고리
CREATE TABLE IF NOT EXISTS material_room_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type VARCHAR(30) NOT NULL,    -- LIVING, BED, KITCHEN, BATHROOM
  category VARCHAR(30) NOT NULL,      -- 바닥, 벽, 천장
  part VARCHAR(60) NOT NULL,          -- 거실 바닥, 주방 벽면/백스플래시
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) 자재 옵션
CREATE TABLE IF NOT EXISTS material_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id UUID NOT NULL REFERENCES material_room_catalog(id) ON DELETE CASCADE,
  name VARCHAR(60) NOT NULL,
  spec VARCHAR(100),
  price INT NOT NULL DEFAULT 0,
  unit VARCHAR(10) DEFAULT 'm²',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) 부자재
CREATE TABLE IF NOT EXISTS material_sub_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID NOT NULL REFERENCES material_options(id) ON DELETE CASCADE,
  name VARCHAR(60) NOT NULL,
  specification VARCHAR(100),
  unit_price INT NOT NULL DEFAULT 0,
  unit VARCHAR(10) DEFAULT 'm²',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_material_room_catalog_room_type ON material_room_catalog(room_type);
CREATE INDEX IF NOT EXISTS idx_material_options_catalog_id ON material_options(catalog_id);
CREATE INDEX IF NOT EXISTS idx_material_sub_items_option_id ON material_sub_items(option_id);

-- ================================================================
-- SEED DATA (MATERIAL_CATALOG 하드코딩 데이터 전량)
-- ================================================================

-- === LIVING (거실) ===

-- 거실 바닥
WITH cat AS (
  INSERT INTO material_room_catalog (room_type, category, part, sort_order) VALUES ('LIVING', '바닥', '거실 바닥', 1) RETURNING id
),
opt1 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '강화마루', '12mm 오크', 35000, 'm²', 1 FROM cat RETURNING id
),
sub1a AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '바닥 밑작업', '레벨링', 8000, 'm²' FROM opt1
),
sub1b AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '걸레받이', 'PVC 60mm', 3000, 'm' FROM opt1
),
opt2 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '원목마루', '15mm 월넛', 85000, 'm²', 2 FROM cat RETURNING id
),
sub2a AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '바닥 밑작업', '합판깔기', 15000, 'm²' FROM opt2
),
sub2b AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '걸레받이', '원목 80mm', 8000, 'm' FROM opt2
),
opt3 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '타일', '600x600 포세린', 45000, 'm²', 3 FROM cat RETURNING id
),
sub3a AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '타일 시멘트', '접착제', 5000, 'm²' FROM opt3
),
sub3b AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '줄눈재', '2mm', 2000, 'm²' FROM opt3
)
SELECT 1;

-- 거실 벽면
WITH cat AS (
  INSERT INTO material_room_catalog (room_type, category, part, sort_order) VALUES ('LIVING', '벽', '거실 벽면', 2) RETURNING id
),
opt1 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '실크 벽지', 'LG하우시스 친환경', 12000, 'm²', 1 FROM cat RETURNING id
),
sub1 AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '초배지', '합지', 3000, 'm²' FROM opt1
),
opt2 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '포인트 벽지', '수입 패턴 벽지', 25000, 'm²', 2 FROM cat RETURNING id
),
sub2 AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '초배지', '합지', 3000, 'm²' FROM opt2
),
opt3 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '페인트', '벤자민무어 매트', 18000, 'm²', 3 FROM cat RETURNING id
),
sub3 AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '퍼티 작업', '2회', 5000, 'm²' FROM opt3
)
SELECT 1;

-- 거실 천장
WITH cat AS (
  INSERT INTO material_room_catalog (room_type, category, part, sort_order) VALUES ('LIVING', '천장', '거실 천장', 3) RETURNING id
),
opt1 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '도장', 'KCC 수성페인트', 8000, 'm²', 1 FROM cat RETURNING id
),
opt2 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '우물천장', '석고보드 + 몰딩', 35000, 'm²', 2 FROM cat RETURNING id
),
sub2a AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '석고보드', '9.5mm', 5000, 'm²' FROM opt2
),
sub2b AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '크라운 몰딩', 'PU 120mm', 12000, 'm' FROM opt2
)
SELECT 1;

-- === BED (침실) ===

-- 침실 바닥
WITH cat AS (
  INSERT INTO material_room_catalog (room_type, category, part, sort_order) VALUES ('BED', '바닥', '침실 바닥', 1) RETURNING id
),
opt1 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '강화마루', '12mm 오크', 35000, 'm²', 1 FROM cat RETURNING id
),
sub1 AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '바닥 밑작업', '레벨링', 8000, 'm²' FROM opt1
),
opt2 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '원목마루', '15mm 애쉬', 75000, 'm²', 2 FROM cat RETURNING id
),
sub2 AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '바닥 밑작업', '합판깔기', 15000, 'm²' FROM opt2
)
SELECT 1;

-- 침실 벽면
WITH cat AS (
  INSERT INTO material_room_catalog (room_type, category, part, sort_order) VALUES ('BED', '벽', '침실 벽면', 2) RETURNING id
),
opt1 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '실크 벽지', '친환경 무지', 12000, 'm²', 1 FROM cat RETURNING id
),
opt2 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '포인트 벽지', '그레이 패턴', 20000, 'm²', 2 FROM cat RETURNING id
)
SELECT 1;

-- === KITCHEN (주방) ===

-- 주방 바닥
WITH cat AS (
  INSERT INTO material_room_catalog (room_type, category, part, sort_order) VALUES ('KITCHEN', '바닥', '주방 바닥', 1) RETURNING id
),
opt1 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '타일', '300x300 논슬립', 40000, 'm²', 1 FROM cat RETURNING id
),
sub1 AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '타일 접착제', '방수형', 6000, 'm²' FROM opt1
),
opt2 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '강화마루', '12mm 방수', 45000, 'm²', 2 FROM cat RETURNING id
)
SELECT 1;

-- 주방 벽면
WITH cat AS (
  INSERT INTO material_room_catalog (room_type, category, part, sort_order) VALUES ('KITCHEN', '벽', '주방 벽면/백스플래시', 2) RETURNING id
),
opt1 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '서브웨이 타일', '75x150 화이트', 35000, 'm²', 1 FROM cat RETURNING id
),
sub1 AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '타일 접착제', '일반', 5000, 'm²' FROM opt1
),
opt2 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '강화유리', '5mm 투명', 55000, 'm²', 2 FROM cat RETURNING id
),
sub2 AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '실리콘', '방수형', 2000, 'm' FROM opt2
)
SELECT 1;

-- === BATHROOM (욕실) ===

-- 욕실 바닥
WITH cat AS (
  INSERT INTO material_room_catalog (room_type, category, part, sort_order) VALUES ('BATHROOM', '바닥', '욕실 바닥', 1) RETURNING id
),
opt1 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '타일', '200x200 논슬립', 45000, 'm²', 1 FROM cat RETURNING id
),
sub1 AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '방수 시공', '우레탄 2중', 25000, 'm²' FROM opt1
),
opt2 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '대리석', '300x300 백마블', 80000, 'm²', 2 FROM cat RETURNING id
),
sub2 AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '방수 시공', '우레탄 2중', 25000, 'm²' FROM opt2
)
SELECT 1;

-- 욕실 벽면
WITH cat AS (
  INSERT INTO material_room_catalog (room_type, category, part, sort_order) VALUES ('BATHROOM', '벽', '욕실 벽면', 2) RETURNING id
),
opt1 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '타일', '300x600 유광', 40000, 'm²', 1 FROM cat RETURNING id
),
sub1 AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '방수 시공', '벽면 방수', 15000, 'm²' FROM opt1
),
opt2 AS (
  INSERT INTO material_options (catalog_id, name, spec, price, unit, sort_order) SELECT id, '대리석', '600x300 그레이', 90000, 'm²', 2 FROM cat RETURNING id
),
sub2 AS (
  INSERT INTO material_sub_items (option_id, name, specification, unit_price, unit) SELECT id, '방수 시공', '벽면 방수', 15000, 'm²' FROM opt2
)
SELECT 1;
