-- ============================================================
-- material_products.category_code 를 category_taxonomy 체계로 정합화
--
-- 기존: ROOM / WINDOW / FLOORING / WALLPAPER / FILM / TOILET / VANITY / BATH / WASHLET / FAUCET
-- 신규: category_taxonomy 의 ARCH_* / MECH_* 코드
-- 추가: FK 제약 (ON UPDATE CASCADE)
-- ============================================================

BEGIN;

-- 1) 기존 → 신규 매핑
UPDATE material_products SET category_code = 'ARCH_ROOM'             WHERE category_code = 'ROOM';
UPDATE material_products SET category_code = 'ARCH_WIN'              WHERE category_code = 'WINDOW';
UPDATE material_products SET category_code = 'ARCH_FLOOR'            WHERE category_code = 'FLOORING';
UPDATE material_products SET category_code = 'ARCH_WALL'             WHERE category_code = 'WALLPAPER';
UPDATE material_products SET category_code = 'ARCH_FILM'             WHERE category_code = 'FILM';
UPDATE material_products SET category_code = 'MECH_SANITARY_WC'      WHERE category_code = 'TOILET';
UPDATE material_products SET category_code = 'MECH_SANITARY_BASIN'   WHERE category_code = 'VANITY';
UPDATE material_products SET category_code = 'MECH_SANITARY_TUB'     WHERE category_code = 'BATH';
UPDATE material_products SET category_code = 'MECH_SANITARY_WASHLET' WHERE category_code = 'WASHLET';
UPDATE material_products SET category_code = 'MECH_FAUCET'           WHERE category_code = 'FAUCET';

-- 2) 미매핑 검출 (있으면 트랜잭션 롤백)
DO $$
DECLARE invalid_count INT;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM material_products mp
  LEFT JOIN category_taxonomy ct ON ct.code = mp.category_code
  WHERE mp.category_code IS NOT NULL AND ct.code IS NULL;
  IF invalid_count > 0 THEN
    RAISE EXCEPTION '미매핑 category_code 존재: % 건 — 트랜잭션 롤백', invalid_count;
  END IF;
END$$;

-- 3) FK 추가
ALTER TABLE material_products
  DROP CONSTRAINT IF EXISTS fk_mp_category_code;

ALTER TABLE material_products
  ADD CONSTRAINT fk_mp_category_code
  FOREIGN KEY (category_code) REFERENCES category_taxonomy(code)
  ON UPDATE CASCADE
  ON DELETE SET NULL;

COMMIT;

-- 결과 확인용 (실행 후 참고):
-- SELECT mp.category_code, ct.name_ko, COUNT(*)
-- FROM material_products mp
-- LEFT JOIN category_taxonomy ct ON ct.code = mp.category_code
-- GROUP BY mp.category_code, ct.name_ko ORDER BY mp.category_code;
