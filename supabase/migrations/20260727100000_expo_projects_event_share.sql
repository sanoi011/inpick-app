-- INPICK EXPO — Phase 4 행사 규정 + Phase 5 제안 공유.

alter table public.expo_projects
  add column if not exists event jsonb,
  add column if not exists share_token uuid,
  add column if not exists shared_at timestamptz;

comment on column public.expo_projects.event is
  '행사 규정 입력 {eventName, venue, boothNumber, maxHeightM, powerKw, sourceNote} — 전부 사용자 입력';
comment on column public.expo_projects.share_token is
  '제안 공유 토큰 — 공개 읽기전용 페이지(/expo/p/[token])에서 service role로만 조회';

create unique index if not exists expo_projects_share_token_key
  on public.expo_projects (share_token)
  where share_token is not null;
