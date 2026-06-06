-- 사업자 비밀번호 해시 컬럼 추가
ALTER TABLE specialty_contractors
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(200);

-- 기존 사업자는 비밀번호 없이 로그인 불가 → 재설정 필요
COMMENT ON COLUMN specialty_contractors.password_hash IS 'bcrypt hashed password for contractor login';
