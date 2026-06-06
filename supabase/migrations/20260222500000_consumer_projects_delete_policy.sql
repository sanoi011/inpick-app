-- consumer_projects DELETE RLS 정책 추가
-- 사용자가 본인 프로젝트를 삭제할 수 있도록 허용

CREATE POLICY "Users can delete own projects"
  ON consumer_projects
  FOR DELETE
  USING (auth.uid() = user_id);
