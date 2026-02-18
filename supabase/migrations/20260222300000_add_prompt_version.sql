-- generated_floorplans에 prompt_version 컬럼 추가
-- 프롬프트 변경 시 버전을 올려 구버전 캐시 자동 무효화

ALTER TABLE generated_floorplans
ADD COLUMN IF NOT EXISTS prompt_version INTEGER DEFAULT 0;

-- consumer_projects에 floor_plan_image_url 컬럼 추가
ALTER TABLE consumer_projects
ADD COLUMN IF NOT EXISTS floor_plan_image_url TEXT;

-- DELETE 정책 추가 (캐시 삭제용)
CREATE POLICY "generated_floorplans_delete" ON generated_floorplans
  FOR DELETE USING (true);
