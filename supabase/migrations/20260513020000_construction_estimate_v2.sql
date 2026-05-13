-- estimate-v2 — 공종별 실행내역서형 견적 저장.
-- 가이드: inpick-construction-trade-estimate-engine-dev-plan-20260512.md §10
create extension if not exists "pgcrypto";

create table if not exists construction_estimates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_mode text not null check (project_mode in ('apartment', 'photo_only', 'commercial')),
  version int not null default 1,
  estimate_json jsonb not null,
  total_with_vat bigint not null default 0,
  confidence_avg numeric not null default 0,
  source_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists construction_estimate_lines (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references construction_estimates(id) on delete cascade,
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  sort_no int not null,
  trade_code text not null,
  trade_name_ko text not null,
  sub_trade_code text not null,
  sub_trade_name_ko text not null,
  room_id text,
  room_name text,
  room_type text,
  surface_type text,
  task_name_ko text not null,
  item_name_ko text not null,
  brand text,
  sku text,
  spec text,
  unit text not null,
  quantity_formula_ko text,
  quantity numeric not null default 0,
  material_unit_price bigint not null default 0,
  labor_unit_price bigint not null default 0,
  expense_unit_price bigint not null default 0,
  material_amount bigint not null default 0,
  labor_amount bigint not null default 0,
  expense_amount bigint not null default 0,
  total_amount bigint not null default 0,
  included boolean not null default true,
  source text not null,
  confidence numeric not null default 0,
  evidence_refs jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_construction_estimates_project
  on construction_estimates(project_id, created_at desc);

create index if not exists idx_construction_estimates_user
  on construction_estimates(user_id, created_at desc);

create index if not exists idx_construction_estimate_lines_estimate
  on construction_estimate_lines(estimate_id, sort_no);

create index if not exists idx_construction_estimate_lines_trade
  on construction_estimate_lines(estimate_id, trade_code);

alter table construction_estimates enable row level security;
alter table construction_estimate_lines enable row level security;

drop policy if exists construction_estimates_own_select on construction_estimates;
create policy construction_estimates_own_select
  on construction_estimates for select using (user_id = auth.uid());

drop policy if exists construction_estimates_own_insert on construction_estimates;
create policy construction_estimates_own_insert
  on construction_estimates for insert with check (user_id = auth.uid());

drop policy if exists construction_estimate_lines_own_select on construction_estimate_lines;
create policy construction_estimate_lines_own_select
  on construction_estimate_lines for select using (user_id = auth.uid());

drop policy if exists construction_estimate_lines_own_insert on construction_estimate_lines;
create policy construction_estimate_lines_own_insert
  on construction_estimate_lines for insert with check (user_id = auth.uid());

comment on table construction_estimates is
  '공종별 실행내역서 견적 (estimate-v2) — 17공종 SurfacePlan → WorkPackageRule 전개 결과.';
