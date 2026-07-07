-- 2026-07-07 보안 수정: user_credits/credit_transactions 클라이언트 쓰기 차단
--
-- 문제: "Users can insert/update own credits" 정책 때문에 로그인한 사용자가
--       supabase-js로 자기 balance를 임의 값으로 UPDATE 가능 (토큰 무한 충전 구멍).
--       credit_transactions도 본인 명의 로그를 위조 삽입 가능.
-- 수정: 쓰기 정책 제거 — 잔액 변경은 전부 서버(service role, RLS 우회) 경유만.
--       읽기(SELECT own) 정책은 유지.
--
-- 적용: Supabase 대시보드 → SQL Editor에서 실행 (service role 필요)

DROP POLICY IF EXISTS "Users can insert own credits" ON user_credits;
DROP POLICY IF EXISTS "Users can update own credits" ON user_credits;
DROP POLICY IF EXISTS "Users can insert own transactions" ON credit_transactions;

-- 확인용: 남아 있어야 하는 정책
--   user_credits: "Users can view own credits" (SELECT)
--   credit_transactions: "Users can view own transactions" (SELECT)
