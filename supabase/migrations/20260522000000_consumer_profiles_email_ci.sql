-- 2026-05-22: 이메일 중복가입 차단 강화 — 대소문자 무시 UNIQUE
--
-- 배경:
--   기존 uq_consumer_profiles_email 인덱스는 email 컬럼을 그대로 색인 → PostgreSQL 기본 정렬은
--   대소문자를 구분한다. 가입/로그인 코드는 lower(email)로 정규화하지만, 만에 하나 대소문자가
--   섞인 레거시 row가 들어오면 'Test@x.com' 과 'test@x.com' 이 서로 다른 값으로 취급되어
--   동일 이메일 중복가입이 뚫릴 여지가 있다.
--
-- 처리:
--   email UNIQUE 인덱스를 lower(email) 함수 인덱스로 교체한다.
--   가입 API(api/auth/signup)와 ensureConsumerProfile은 이미 normalizeEmail(lowercase+trim)으로
--   저장하므로 데이터 변경 없이 안전하게 적용된다.
--
-- 주의: 만약 기존 데이터에 lower(email) 기준 중복 row가 있으면 인덱스 생성이 실패한다.
--       그 경우 아래 진단 쿼리로 중복을 먼저 정리한 뒤 재실행할 것.
--   SELECT lower(email), count(*) FROM consumer_profiles GROUP BY lower(email) HAVING count(*) > 1;

DROP INDEX IF EXISTS uq_consumer_profiles_email;

CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_profiles_email_ci
  ON consumer_profiles (lower(email));

COMMENT ON INDEX uq_consumer_profiles_email_ci IS
  '2026-05-22: 대소문자 무시 이메일 UNIQUE. 동일 이메일(케이스 무관) 중복가입 차단.';
