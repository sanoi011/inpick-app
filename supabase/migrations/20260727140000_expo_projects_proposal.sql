-- INPICK EXPO — 시공사 발행 제안 스냅샷 (contractor_proposal 단계).
-- 발행은 명시적 인간 행위이며, 발행 시점의 견적을 그대로 보존한다.

alter table public.expo_projects
  add column if not exists proposal jsonb;

comment on column public.expo_projects.proposal is
  '발행된 제안 스냅샷 {publishedAt, sceneRevision, estimate} — 씬/단가 변경 시 stale';
