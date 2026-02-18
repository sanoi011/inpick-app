-- 세그멘테이션 마스크 컬럼 추가
-- generated_floorplans 테이블에 방별 색상 마스크 + room 매핑 저장

ALTER TABLE generated_floorplans
  ADD COLUMN IF NOT EXISTS mask_url TEXT,
  ADD COLUMN IF NOT EXISTS mask_mirror_url TEXT,
  ADD COLUMN IF NOT EXISTS room_color_map JSONB DEFAULT '{}';
