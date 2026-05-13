-- P1: Step2에서 생성된 모든 이미지 결과를 견적 evidence로 저장.
-- 전체 이미지 / 방별 이미지 / zone 이미지 / 부위별 이미지 / space-edit 결과 모두 동일 저장.
-- 가이드: inpick-step2-estimate-evidence-pipeline-fix-20260512.md §5-1
create extension if not exists "pgcrypto";

create table if not exists design_outputs (
  id uuid primary key default gen_random_uuid(),
  -- workflow 세션 단위 식별자 — Step1에서 생성한 임시 uuid 또는 consumer_projects.id
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,

  project_mode text not null check (project_mode in ('apartment', 'photo_only', 'commercial')),

  target_type text not null check (target_type in ('whole', 'room', 'zone', 'surface')),
  target_id text not null,
  target_name text not null,

  render_kind text not null check (render_kind in (
    'full_render',
    'room_render',
    'zone_render',
    'surface_render',
    'space_edit'
  )),

  image_url text not null,
  prompt text,
  negative_prompt text,

  -- prompt extraction 기반 자재 힌트 (vision 분석 전 초기 evidence)
  material_hints jsonb not null default '[]'::jsonb,

  status text not null default 'generated' check (status in (
    'generated',
    'analysis_pending',
    'analysis_done',
    'analysis_failed'
  )),

  analysis_job_id uuid,
  analysis_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_design_outputs_project
  on design_outputs(project_id, created_at desc);

create index if not exists idx_design_outputs_project_mode
  on design_outputs(project_id, project_mode, target_type);

create index if not exists idx_design_outputs_user
  on design_outputs(user_id, created_at desc);

create index if not exists idx_design_outputs_status
  on design_outputs(status) where status in ('analysis_pending', 'analysis_failed');

alter table design_outputs enable row level security;

drop policy if exists "design_outputs_select_own" on design_outputs;
create policy "design_outputs_select_own"
  on design_outputs for select
  using (user_id = auth.uid());

drop policy if exists "design_outputs_insert_own" on design_outputs;
create policy "design_outputs_insert_own"
  on design_outputs for insert
  with check (user_id = auth.uid());

drop policy if exists "design_outputs_update_own" on design_outputs;
create policy "design_outputs_update_own"
  on design_outputs for update
  using (user_id = auth.uid());

drop policy if exists "design_outputs_delete_own" on design_outputs;
create policy "design_outputs_delete_own"
  on design_outputs for delete
  using (user_id = auth.uid());

-- updated_at 자동 갱신 트리거
create or replace function design_outputs_set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_design_outputs_updated_at on design_outputs;
create trigger trg_design_outputs_updated_at
  before update on design_outputs
  for each row execute function design_outputs_set_updated_at();

comment on table design_outputs is
  'Step2 이미지 생성 결과 evidence — 견적 산출에서 1차 자재 hint로 사용. 자재 정밀 분석이 끝나면 status=analysis_done + material_hints 갱신.';
