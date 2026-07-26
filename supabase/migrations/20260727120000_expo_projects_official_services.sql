-- INPICK EXPO — 공식 서비스 신청 현황 (전기/리깅/인터넷 — 주최측 신청).

alter table public.expo_projects
  add column if not exists official_services jsonb;

comment on column public.expo_projects.official_services is
  '주최측 공식 서비스 신청 현황 {powerApplied, riggingApplied, internetApplied, note} — 사용자 자가 체크';
