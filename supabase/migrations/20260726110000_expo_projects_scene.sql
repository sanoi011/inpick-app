-- INPICK EXPO — BoothScene 파라메트릭 씬 저장 (Phase 2 슬라이스 1)
ALTER TABLE expo_projects
  ADD COLUMN IF NOT EXISTS scene JSONB;
COMMENT ON COLUMN expo_projects.scene IS
  'BoothScene v1 — 카탈로그 컴포넌트 배치. schemaVersion/revision 포함.';
