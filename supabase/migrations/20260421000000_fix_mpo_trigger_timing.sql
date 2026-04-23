-- ============================================================
-- material_price_observations 트리거 타이밍 수정
--
-- 원래: AFTER INSERT 트리거 → 같은 (material_id, source)의 두 번째 insert 시
--       UNIQUE INDEX(uq_mpo_material_source_latest)가 먼저 터져서 트리거가 실행되지 않음.
-- 수정: BEFORE INSERT → 기존 is_latest=true 행을 먼저 false로 내린 뒤 새 행 insert.
-- ============================================================

DROP TRIGGER IF EXISTS trg_mpo_latest ON material_price_observations;
CREATE TRIGGER trg_mpo_latest
  BEFORE INSERT ON material_price_observations
  FOR EACH ROW EXECUTE FUNCTION mpo_mark_previous_not_latest();
