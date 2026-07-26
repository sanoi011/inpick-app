-- INPICK EXPO — 부스 프로젝트 서버 저장 (Phase 1 슬라이스 2)
--
-- 웹은 본체 서비스의 /expo 섹션으로 통합 (2026-07-26 대표 결정).
-- expo_* prefix로 본체 스키마와 격리하고, 소비자 인증(auth.users)을
-- 그대로 사용한다. footprint는 provisional 스냅샷 JSONB,
-- confirmed_dimensions가 채워지면 치수 확정 상태다.

CREATE TABLE IF NOT EXISTS expo_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '새 부스 프로젝트'
    CHECK (char_length(title) BETWEEN 1 AND 120),
  area_input NUMERIC(8,2) NOT NULL CHECK (area_input > 0),
  area_unit TEXT NOT NULL CHECK (area_unit IN ('sqm', 'sqft')),
  footprint JSONB NOT NULL,
  confirmed_dimensions JSONB,
  quick_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expo_projects_user_updated
  ON expo_projects(user_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_expo_projects_updated_at ON expo_projects;
CREATE TRIGGER trg_expo_projects_updated_at
  BEFORE UPDATE ON expo_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE expo_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expo_projects_select_own" ON expo_projects;
CREATE POLICY "expo_projects_select_own"
  ON expo_projects FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "expo_projects_insert_own" ON expo_projects;
CREATE POLICY "expo_projects_insert_own"
  ON expo_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "expo_projects_update_own" ON expo_projects;
CREATE POLICY "expo_projects_update_own"
  ON expo_projects FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "expo_projects_delete_own" ON expo_projects;
CREATE POLICY "expo_projects_delete_own"
  ON expo_projects FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE expo_projects IS
  'INPICK EXPO 부스 프로젝트. footprint=provisional 스냅샷, confirmed_dimensions=치수 확정.';
