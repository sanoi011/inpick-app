-- 계약서 소비자 특기사항 컬럼 추가
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS consumer_notes TEXT;
