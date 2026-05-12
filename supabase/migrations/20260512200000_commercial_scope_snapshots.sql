-- INPICK Commercial Scope Snapshots
-- 가이드: c:\Users\user\Desktop\inpick-commercial-scope-admin-analytics-dev-plan-20260512.md §3-6

CREATE TABLE IF NOT EXISTS commercial_scope_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  business_type TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  scope_json JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'merged',
  readiness_score NUMERIC,
  can_build_estimate BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commercial_scope_project ON commercial_scope_snapshots(project_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_commercial_scope_user ON commercial_scope_snapshots(user_id, created_at DESC);

ALTER TABLE commercial_scope_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_scope_select_own"
  ON commercial_scope_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "commercial_scope_insert_own"
  ON commercial_scope_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "commercial_scope_update_own"
  ON commercial_scope_snapshots FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE commercial_scope_snapshots IS '상가/사무실 견적 산출용 CommercialScopeSpec 스냅샷. 사용자 수정 시 version +1로 누적 저장 (감사 추적).';
