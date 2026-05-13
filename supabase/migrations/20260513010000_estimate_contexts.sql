-- P2: Step1 + scope + design_outputs + materialEvidence + userMaterialEdits 스냅샷 묶음.
-- 견적 페이지 진입 직전 finalize 호출 → contextId 발급 → build-estimate에 contextId 전달.
-- 가이드: inpick-step2-estimate-evidence-pipeline-fix-20260512.md §5-2
create extension if not exists "pgcrypto";

create table if not exists estimate_contexts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,

  project_mode text not null check (project_mode in ('apartment', 'photo_only', 'commercial')),

  step1_snapshot jsonb not null default '{}'::jsonb,
  scope_snapshot jsonb not null default '{}'::jsonb,
  design_outputs_snapshot jsonb not null default '[]'::jsonb,
  material_evidence_snapshot jsonb not null default '[]'::jsonb,
  user_material_edits_snapshot jsonb not null default '[]'::jsonb,

  estimate_level text not null check (estimate_level in (
    'L0_BASIC',
    'L1_DESIGN',
    'L2_IMAGE_ANALYZED',
    'L3_USER_CONFIRMED'
  )),

  readiness_score numeric not null default 0,
  can_build_estimate boolean not null default false,
  missing_blocking_fields jsonb not null default '[]'::jsonb,
  missing_optional_fields jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_estimate_contexts_project
  on estimate_contexts(project_id, created_at desc);

create index if not exists idx_estimate_contexts_user
  on estimate_contexts(user_id, created_at desc);

alter table estimate_contexts enable row level security;

drop policy if exists "estimate_contexts_select_own" on estimate_contexts;
create policy "estimate_contexts_select_own"
  on estimate_contexts for select
  using (user_id = auth.uid());

drop policy if exists "estimate_contexts_insert_own" on estimate_contexts;
create policy "estimate_contexts_insert_own"
  on estimate_contexts for insert
  with check (user_id = auth.uid());

comment on table estimate_contexts is
  '견적 페이지 진입 직전 만든 evidence 스냅샷. build-estimate(contextId)에서 deterministic하게 견적 재현.';
