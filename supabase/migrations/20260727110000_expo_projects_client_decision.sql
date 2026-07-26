-- INPICK EXPO — 고객 결정 (Client Decision). 공유 토큰 소지자의 승인/변경요청.

alter table public.expo_projects
  add column if not exists client_decision jsonb;

comment on column public.expo_projects.client_decision is
  '고객 결정 {decision: approved|changes_requested, comment, decidedAt} — 제안 검토 승인이며 시공 확정 아님';
