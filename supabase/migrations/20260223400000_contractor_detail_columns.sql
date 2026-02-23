-- 사업자 상세 페이지 API에서 SELECT하는 추가 컬럼
ALTER TABLE specialty_contractors
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_license_url TEXT;
