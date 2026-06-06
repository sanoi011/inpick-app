-- 사업자 디렉토리: introduction, logo_url 컬럼 추가 (API에서 직접 SELECT)
ALTER TABLE specialty_contractors
  ADD COLUMN IF NOT EXISTS introduction TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo_url TEXT;
