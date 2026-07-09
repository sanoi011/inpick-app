-- 로그인 제공사별 유저 인구통계/분류 (대시보드 provider 세분화용)
-- provider는 auth.users.app_metadata에만 있어 SQL 집계가 불가 → 조회 가능한 미러 테이블.
-- 성별/연령대는 provider 동의항목 승인 시에만 채워짐(구글/애플 미제공, 카카오/네이버 검수 필요) → 전부 nullable.
CREATE TABLE IF NOT EXISTS user_demographics (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL DEFAULT 'email',   -- email | google | kakao | naver | apple
  gender      TEXT,                            -- 'male' | 'female' | null
  age_range   TEXT,                            -- 예: '20~29', '30~39' (제공사 표기 정규화)
  birthyear   INT,                             -- 출생연도(네이버 등)
  demo_source TEXT,                            -- 인구통계를 준 provider (없으면 null)
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_demographics_provider ON user_demographics(provider);
CREATE INDEX IF NOT EXISTS idx_user_demographics_gender ON user_demographics(gender) WHERE gender IS NOT NULL;

ALTER TABLE user_demographics ENABLE ROW LEVEL SECURITY;

-- 본인만 자기 인구통계 조회 가능(관리자 집계는 service_role로 우회)
DROP POLICY IF EXISTS "demographics_select_own" ON user_demographics;
CREATE POLICY "demographics_select_own" ON user_demographics
  FOR SELECT USING (auth.uid() = user_id);
-- 쓰기는 service_role 전용(정책 없음 = 클라 차단)
