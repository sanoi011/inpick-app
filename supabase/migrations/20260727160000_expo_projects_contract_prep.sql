-- INPICK EXPO — 계약 준비 기록 (계약서·법무 검토는 별도 — 상태 표시용).

alter table public.expo_projects
  add column if not exists contract_prep jsonb;

comment on column public.expo_projects.contract_prep is
  '계약 준비 기록 {startedAt, note} — contract 단계 아님(별도 계약 템플릿·법률 검토 후)';
