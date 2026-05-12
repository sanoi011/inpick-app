-- INPICK Analytics Events Ledger
-- 가이드: c:\Users\user\Downloads\inpick-commercial-scope-admin-analytics-dev-plan-20260512.md §4-2~4-3

-- ─── 핵심 이벤트 테이블 ───
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  event_version INT NOT NULL DEFAULT 1,

  actor_type TEXT NOT NULL CHECK (actor_type IN ('anonymous', 'consumer', 'contractor', 'admin', 'system')),
  user_id UUID NULL,
  contractor_id UUID NULL,
  admin_id UUID NULL,
  anonymous_id TEXT NULL,
  session_id TEXT NULL,

  project_id UUID NULL,
  rfq_id UUID NULL,
  bid_id UUID NULL,
  contract_id UUID NULL,
  estimate_id UUID NULL,
  render_id UUID NULL,
  scope_snapshot_id UUID NULL,

  project_mode TEXT NULL,
  funnel TEXT NULL,
  step TEXT NULL,

  source TEXT NOT NULL DEFAULT 'server',
  page_path TEXT NULL,
  referrer TEXT NULL,
  user_agent TEXT NULL,
  ip_hash TEXT NULL,

  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  pii_redacted BOOLEAN NOT NULL DEFAULT TRUE,
  internal_user BOOLEAN NOT NULL DEFAULT FALSE,

  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time ON analytics_events(event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_time ON analytics_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_project_time ON analytics_events(project_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_time ON analytics_events(session_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_mode_time ON analytics_events(project_mode, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_props_gin ON analytics_events USING gin(props);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- 클라이언트 직접 SELECT 차단. 관리자 API에서 service_role로 조회.
CREATE POLICY "analytics_events_no_client_select"
  ON analytics_events FOR SELECT
  USING (false);

-- ─── 이벤트 스키마 (tracking plan single source of truth) ───
CREATE TABLE IF NOT EXISTS analytics_event_schema (
  event_name TEXT PRIMARY KEY,
  event_version INT NOT NULL DEFAULT 1,
  description_ko TEXT NOT NULL,
  actor_types TEXT[] NOT NULL,
  required_props TEXT[] NOT NULL DEFAULT '{}',
  optional_props TEXT[] NOT NULL DEFAULT '{}',
  owner TEXT NOT NULL DEFAULT 'product',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE analytics_event_schema ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analytics_event_schema_no_client_select"
  ON analytics_event_schema FOR SELECT
  USING (false);

-- ─── 세션 (anonymous + 인증 사용자 통합) ───
CREATE TABLE IF NOT EXISTS analytics_sessions (
  id TEXT PRIMARY KEY,
  anonymous_id TEXT NOT NULL,
  user_id UUID NULL,
  actor_type TEXT NOT NULL DEFAULT 'anonymous',
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  entry_path TEXT NULL,
  last_path TEXT NULL,
  referrer TEXT NULL,
  user_agent TEXT NULL,
  project_mode TEXT NULL,
  is_internal BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user ON analytics_sessions(user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_anon ON analytics_sessions(anonymous_id);

ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analytics_sessions_no_client_select"
  ON analytics_sessions FOR SELECT
  USING (false);

-- ─── identity link (anonymous → user 매핑) ───
CREATE TABLE IF NOT EXISTS analytics_identity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id TEXT NOT NULL,
  user_id UUID NULL,
  contractor_id UUID NULL,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_identity_links_anon ON analytics_identity_links(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_identity_links_user ON analytics_identity_links(user_id);

ALTER TABLE analytics_identity_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analytics_identity_links_no_client_select"
  ON analytics_identity_links FOR SELECT
  USING (false);

-- ─── 이벤트 스키마 seed (45개 high-value events) ───
INSERT INTO analytics_event_schema (event_name, description_ko, actor_types, required_props) VALUES
  ('session_started', '세션 시작', ARRAY['anonymous', 'consumer', 'contractor'], ARRAY['page_path']),
  ('signup_started', '회원가입 시작', ARRAY['anonymous'], ARRAY[]::TEXT[]),
  ('signup_completed', '회원가입 완료', ARRAY['consumer'], ARRAY['provider']),
  ('login_completed', '로그인 완료', ARRAY['consumer', 'contractor'], ARRAY['provider']),
  ('oauth_started', 'OAuth 시작', ARRAY['anonymous'], ARRAY['provider']),
  ('oauth_completed', 'OAuth 완료', ARRAY['consumer', 'contractor'], ARRAY['provider']),
  ('workflow_started', '워크플로 시작', ARRAY['consumer'], ARRAY['entry_source']),
  ('project_mode_selected', '모드 선택', ARRAY['consumer'], ARRAY['project_mode']),
  ('project_created', '프로젝트 생성', ARRAY['consumer'], ARRAY['project_mode']),
  ('address_searched', '주소 검색', ARRAY['consumer'], ARRAY['region']),
  ('floorplan_selected', '도면 선택', ARRAY['consumer'], ARRAY['property_id', 'area_m2']),
  ('quick_photo_started', '사진 모드 시작', ARRAY['consumer'], ARRAY['area_m2']),
  ('commercial_spec_submitted', '상가 정보 입력', ARRAY['consumer'], ARRAY['business_type', 'total_area_m2']),
  ('commercial_zone_updated', '상가 zone 편집', ARRAY['consumer'], ARRAY['zone_type', 'area_m2']),
  ('chat_message_sent', 'AI 채팅 전송', ARRAY['consumer'], ARRAY['project_mode', 'message_length']),
  ('chat_response_completed', 'AI 응답 완료', ARRAY['consumer'], ARRAY['latency_ms']),
  ('chat_extract_completed', 'extract 완료', ARRAY['consumer'], ARRAY['generation_type']),
  ('image_generation_requested', '이미지 생성 요청', ARRAY['consumer'], ARRAY['endpoint', 'project_mode']),
  ('image_generation_completed', '이미지 생성 성공', ARRAY['consumer'], ARRAY['model', 'latency_ms']),
  ('image_generation_failed', '이미지 생성 실패', ARRAY['consumer'], ARRAY['error_code']),
  ('editable_render_analyzed', 'layer 분석 완료', ARRAY['consumer'], ARRAY['layer_count']),
  ('surface_selected', 'surface 클릭', ARRAY['consumer'], ARRAY['surface_type']),
  ('material_search_opened', '자재 검색 열기', ARRAY['consumer'], ARRAY['surface_type']),
  ('material_applied', '자재 적용', ARRAY['consumer'], ARRAY['surface_type', 'material_category', 'grade']),
  ('commercial_scope_created', '상가 scope 생성', ARRAY['consumer'], ARRAY['business_type', 'readiness_score']),
  ('commercial_scope_updated', '상가 scope 수정', ARRAY['consumer'], ARRAY['changed_field', 'version']),
  ('estimate_readiness_changed', 'readiness 변화', ARRAY['consumer'], ARRAY['before_score', 'after_score']),
  ('estimate_requested', '견적 요청', ARRAY['consumer'], ARRAY['project_mode']),
  ('estimate_generated', '견적 성공', ARRAY['consumer'], ARRAY['line_count', 'total_amount']),
  ('estimate_failed', '견적 실패', ARRAY['consumer'], ARRAY['error_code']),
  ('rfq_created', 'RFQ 발송', ARRAY['consumer'], ARRAY['estimate_amount', 'project_mode']),
  ('bid_received', '입찰 수신', ARRAY['consumer'], ARRAY['bid_amount']),
  ('bid_viewed', '입찰 상세 보기', ARRAY['consumer'], ARRAY['bid_id']),
  ('contractor_selected', '사업자 선택', ARRAY['consumer'], ARRAY['bid_count', 'selected_bid_amount']),
  ('contract_created', '계약 생성', ARRAY['consumer'], ARRAY['contract_amount']),
  ('contractor_signup_completed', '사업자 가입', ARRAY['contractor'], ARRAY['specialty_count', 'region_count']),
  ('contractor_bid_viewed', 'RFQ 상세 (사업자)', ARRAY['contractor'], ARRAY['rfq_id', 'project_mode']),
  ('contractor_bid_submitted', '입찰 제출 (사업자)', ARRAY['contractor'], ARRAY['bid_amount', 'duration_days']),
  ('drawing_package_viewed', '도면 패키지 조회', ARRAY['consumer', 'contractor'], ARRAY['contract_id']),
  ('project_update_uploaded', '시공 사진 업로드', ARRAY['contractor'], ARRAY['project_id', 'photo_count']),
  ('admin_login_completed', '관리자 로그인', ARRAY['admin'], ARRAY['method']),
  ('admin_page_viewed', '관리자 페이지 진입', ARRAY['admin'], ARRAY['page']),
  ('admin_user_viewed', '관리자 사용자 상세', ARRAY['admin'], ARRAY['target_user_id']),
  ('admin_action_executed', '관리자 액션', ARRAY['admin'], ARRAY['action_type']),
  ('admin_export_downloaded', '관리자 CSV/PDF', ARRAY['admin'], ARRAY['export_type', 'row_count'])
ON CONFLICT (event_name) DO NOTHING;

COMMENT ON TABLE analytics_events IS 'INPICK 행동 이벤트 레저 - 모든 소비자/사업자/관리자/시스템 행동 단일 테이블';
COMMENT ON TABLE analytics_event_schema IS 'Tracking plan single source of truth - 이벤트명/필수props 정의';
