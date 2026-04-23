-- 2026-04-23: 사용자 행동 이벤트 — 자재 교체·고민시간·확정 3종.
-- 감성 매칭 엔진이 렌더한 자재를 사용자가 어떻게 탐색·교체·확정하는지 전수 기록.
-- 대시보드 분석 + 딥러닝 재학습 feedback loop 입력.

CREATE TABLE IF NOT EXISTS user_material_events (
  id              bigserial PRIMARY KEY,

  -- 세션·사용자
  user_id         uuid,                                      -- auth.users.id (null이면 익명)
  anon_id         text,                                      -- 익명 사용자 브라우저 ID (fingerprint)
  session_id      text NOT NULL,                             -- 단일 세션 내 고유 ID
  project_id      text,                                      -- consumer_projects.id (프로젝트 연결)

  -- 이벤트 타입
  event_type      text NOT NULL CHECK (event_type IN ('swap','dwell','confirm','impression','reject','emotion_feedback')),
  seq             integer NOT NULL,                          -- 세션 내 순서 (1,2,3...)

  -- 감성 컨텍스트
  emotion_query   text,                                      -- 사용자 자연어 입력 ("아픈 사람 힐링...")
  detected_moods  text[] DEFAULT ARRAY[]::text[],            -- 감지된 감성 태그
  palette_id      text,                                      -- 매칭된 팔레트 ID

  -- 자재 컨텍스트
  room_type       text,                                      -- 대상 공간 (거실/침실/주방...)
  category_code   text,                                      -- material_products.category_code
  material_from   jsonb,                                     -- 교체 전 자재 {id, name, category}
  material_to     jsonb,                                     -- 교체 후 자재 (swap 시)
  material_final  jsonb,                                     -- 최종 확정 자재 (confirm 시)

  -- 시간 측정
  dwell_ms        integer,                                   -- 해당 자재 위에서의 체류 시간 (ms)
  time_since_start_ms integer,                               -- 세션 시작부터 경과 (ms)

  -- 감정 시그널
  emotion_signal  text,                                      -- 'positive' / 'neutral' / 'negative' (수동 또는 자동)
  emotion_score   numeric,                                   -- NLP·행동 복합 추론 (-1.0 ~ +1.0)
  feedback_text   text,                                      -- 사용자 자유 텍스트

  -- 기타
  client_meta     jsonb,                                     -- 디바이스·뷰포트·위치
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ume_session        ON user_material_events (session_id, seq);
CREATE INDEX IF NOT EXISTS idx_ume_user           ON user_material_events (user_id);
CREATE INDEX IF NOT EXISTS idx_ume_project        ON user_material_events (project_id);
CREATE INDEX IF NOT EXISTS idx_ume_event_type     ON user_material_events (event_type);
CREATE INDEX IF NOT EXISTS idx_ume_palette        ON user_material_events (palette_id);
CREATE INDEX IF NOT EXISTS idx_ume_room_type      ON user_material_events (room_type);
CREATE INDEX IF NOT EXISTS idx_ume_detected_moods ON user_material_events USING gin (detected_moods);
CREATE INDEX IF NOT EXISTS idx_ume_created_at     ON user_material_events (created_at);

COMMENT ON TABLE user_material_events IS '자재 선택 행동 이벤트 로그. 교체·고민시간·확정·감정 시그널 수집.';
COMMENT ON COLUMN user_material_events.event_type IS 'swap=교체 / dwell=체류 / confirm=확정 / impression=노출 / reject=명시적 거부 / emotion_feedback=감정 태그';
COMMENT ON COLUMN user_material_events.emotion_score IS '-1.0(부정) ~ +1.0(긍정) 연속값. NLP·dwell·revision_count 복합.';

-- RLS: 본인 로그만 조회 가능, 관리자는 전체. (anon은 insert만)
ALTER TABLE user_material_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert own or anon events"
  ON user_material_events FOR INSERT
  WITH CHECK (
    (auth.uid() IS NULL) OR (user_id = auth.uid()) OR (user_id IS NULL)
  );

CREATE POLICY "select own events"
  ON user_material_events FOR SELECT
  USING (user_id = auth.uid());

-- 관리자 로직은 서비스 롤 키로 조회 (RLS 우회)
