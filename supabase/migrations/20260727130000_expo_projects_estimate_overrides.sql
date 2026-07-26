-- INPICK EXPO — 시공사 검토 단가 (라인 id → 단가). 적용 라인은 quoted.

alter table public.expo_projects
  add column if not exists estimate_overrides jsonb;

comment on column public.expo_projects.estimate_overrides is
  '시공사 검토 단가 override {lineId: {unitAmountKrw}} — 직접비 라인만, quoted 소스로 표시';
