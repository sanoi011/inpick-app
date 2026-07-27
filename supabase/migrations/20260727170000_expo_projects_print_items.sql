-- INPICK EXPO — 인쇄물 컨셉/아트워크 (확정 플로우 4·5단계).

alter table public.expo_projects
  add column if not exists print_items jsonb;

comment on column public.expo_projects.print_items is
  '인쇄물 항목 [{id, kind, label, note, refImageUrl, artworkUrl, confirmed}] — 씬 벽/사이니지에서 파생';
