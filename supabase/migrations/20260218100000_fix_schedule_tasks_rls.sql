-- schedule_tasks RLS 정책 수정: service_role만 → 모든 사용자 허용
DROP POLICY IF EXISTS "Service role full access on schedule_tasks" ON schedule_tasks;

CREATE POLICY "Anyone can read schedule_tasks"
  ON schedule_tasks FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert schedule_tasks"
  ON schedule_tasks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update schedule_tasks"
  ON schedule_tasks FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete schedule_tasks"
  ON schedule_tasks FOR DELETE
  USING (true);
