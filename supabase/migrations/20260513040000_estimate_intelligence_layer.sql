-- P10: Estimate Intelligence Layer (MD §2 inpick-estimate-intelligence-layer-implementation-plan-20260512.md)
-- 신규 7개 테이블 + RLS — 영속화 + 학습 데이터 수집 기반.
-- 기존 estimate_contexts / design_outputs / construction_estimates 와 공존.
create extension if not exists "pgcrypto";

-- ─── §2-2. estimate_evidence — Step1/Step2 모든 증거를 한 테이블에 ────
create table if not exists estimate_evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  estimate_context_id uuid references estimate_contexts(id) on delete cascade,

  evidence_type text not null check (evidence_type in (
    'floorplan_room_quantity',
    'rendered_design_image',
    'vision_material_observation',
    'user_material_selection',
    'chat_extracted_scope',
    'commercial_scope_spec',
    'photo_space_input',
    'default_assumption',
    'contractor_override'
  )),
  project_mode text not null check (project_mode in ('apartment', 'photo_only', 'commercial')),

  target jsonb not null default '{}'::jsonb,
  value jsonb not null default '{}'::jsonb,

  confidence numeric not null default 0.5,
  source text not null,

  created_at timestamptz not null default now()
);

create index if not exists idx_estimate_evidence_context_id
  on estimate_evidence(estimate_context_id);
create index if not exists idx_estimate_evidence_project_id
  on estimate_evidence(project_id);

-- ─── §2-3. surface_plans — 부위별 마감 계획 ──────────────────────────
create table if not exists surface_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  estimate_context_id uuid references estimate_contexts(id) on delete cascade,

  room_id text,
  room_name text,
  zone_id text,
  zone_name text,

  surface_type text not null,
  action text not null,
  material_category text not null,
  material_name_ko text not null,

  brand text,
  sku text,
  spec text,
  grade text not null default 'standard',

  quantity_basis text not null,
  quantity_m2 numeric,
  quantity_m numeric,
  quantity_ea numeric,

  evidence_ids jsonb not null default '[]'::jsonb,
  confidence numeric not null default 0.5,
  source text not null,
  assumptions jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_surface_plans_context_id
  on surface_plans(estimate_context_id);
create index if not exists idx_surface_plans_project_id
  on surface_plans(project_id);

-- ─── §2-4. system_plans — 설비/전기 계획 ─────────────────────────────
create table if not exists system_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  estimate_context_id uuid references estimate_contexts(id) on delete cascade,

  room_id text,
  room_name text,
  zone_id text,
  zone_name text,

  system_type text not null,
  action text not null,
  grade text not null default 'standard',

  quantity_ea numeric,
  quantity_m numeric,
  quantity_m2 numeric,

  evidence_ids jsonb not null default '[]'::jsonb,
  confidence numeric not null default 0.5,
  assumptions jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_system_plans_context_id
  on system_plans(estimate_context_id);

-- ─── §2-5. fixture_plans — 가구·도기·간판 등 ─────────────────────────
create table if not exists fixture_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  estimate_context_id uuid references estimate_contexts(id) on delete cascade,

  room_id text,
  room_name text,
  zone_id text,
  zone_name text,

  fixture_type text not null,
  action text not null,
  item_name text not null,
  brand text,
  sku text,
  spec text,
  grade text not null default 'standard',

  quantity_ea numeric,
  quantity_m numeric,
  quantity_m2 numeric,

  evidence_ids jsonb not null default '[]'::jsonb,
  confidence numeric not null default 0.5,
  assumptions jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fixture_plans_context_id
  on fixture_plans(estimate_context_id);

-- ─── §2-6. work_package_rules — 규칙 DB seed (5개+ 작업 패키지) ─────
create table if not exists work_package_rules (
  id uuid primary key default gen_random_uuid(),

  rule_key text not null unique,
  project_mode text,
  room_type text,
  surface_type text,
  system_type text,
  fixture_type text,
  material_category text,
  material_name_ko text,

  outputs jsonb not null default '[]'::jsonb,

  version int not null default 1,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_work_package_rules_match
  on work_package_rules(project_mode, surface_type, material_category, active);
create index if not exists idx_work_package_rules_room
  on work_package_rules(project_mode, room_type, active);

-- ─── §2-7. trade_estimate_lines — 견적 라인 영속 + 감사 ─────────────
create table if not exists trade_estimate_lines (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid,
  estimate_context_id uuid references estimate_contexts(id) on delete cascade,
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,

  trade_code text not null,
  trade_name text not null,
  sub_trade_code text not null,
  sub_trade_name text not null,

  room_name text,
  zone_name text,
  surface_type text,

  work_name text not null,
  item_name text not null,
  spec text,

  unit text not null,
  quantity numeric not null,
  quantity_formula_ko text,

  material_unit_price numeric not null default 0,
  labor_unit_price numeric not null default 0,
  expense_unit_price numeric not null default 0,

  material_amount numeric not null default 0,
  labor_amount numeric not null default 0,
  expense_amount numeric not null default 0,
  total_amount numeric not null default 0,

  included boolean not null default true,

  evidence_refs jsonb not null default '[]'::jsonb,
  source text not null,
  confidence numeric not null default 0.5,

  assumptions jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_trade_estimate_lines_context_id
  on trade_estimate_lines(estimate_context_id);
create index if not exists idx_trade_estimate_lines_trade
  on trade_estimate_lines(trade_code, sub_trade_code);
create index if not exists idx_trade_estimate_lines_project
  on trade_estimate_lines(project_id, created_at desc);

-- ─── §2-8. estimate_accuracy_outcomes — 사업자 입찰/계약 결과 학습 ──
create table if not exists estimate_accuracy_outcomes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  estimate_context_id uuid,
  estimate_id uuid,
  contractor_bid_id uuid,
  contract_id uuid,

  ai_estimate_amount numeric,
  contractor_bid_amount numeric,
  contract_amount numeric,

  variance_ai_to_bid numeric,
  variance_ai_to_contract numeric,

  trade_variances jsonb not null default '{}'::jsonb,
  line_overrides jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_estimate_accuracy_outcomes_project
  on estimate_accuracy_outcomes(project_id);

-- ─── §2-9. RLS ───────────────────────────────────────────────────────
alter table estimate_evidence enable row level security;
alter table surface_plans enable row level security;
alter table system_plans enable row level security;
alter table fixture_plans enable row level security;
alter table trade_estimate_lines enable row level security;
-- work_package_rules / estimate_accuracy_outcomes는 관리자/사업자 정책 별도

drop policy if exists estimate_evidence_select_own on estimate_evidence;
create policy estimate_evidence_select_own
  on estimate_evidence for select using (user_id = auth.uid());
drop policy if exists estimate_evidence_insert_own on estimate_evidence;
create policy estimate_evidence_insert_own
  on estimate_evidence for insert with check (user_id = auth.uid());

drop policy if exists surface_plans_select_own on surface_plans;
create policy surface_plans_select_own
  on surface_plans for select using (user_id = auth.uid());
drop policy if exists surface_plans_insert_own on surface_plans;
create policy surface_plans_insert_own
  on surface_plans for insert with check (user_id = auth.uid());

drop policy if exists system_plans_select_own on system_plans;
create policy system_plans_select_own
  on system_plans for select using (user_id = auth.uid());
drop policy if exists system_plans_insert_own on system_plans;
create policy system_plans_insert_own
  on system_plans for insert with check (user_id = auth.uid());

drop policy if exists fixture_plans_select_own on fixture_plans;
create policy fixture_plans_select_own
  on fixture_plans for select using (user_id = auth.uid());
drop policy if exists fixture_plans_insert_own on fixture_plans;
create policy fixture_plans_insert_own
  on fixture_plans for insert with check (user_id = auth.uid());

drop policy if exists trade_estimate_lines_select_own on trade_estimate_lines;
create policy trade_estimate_lines_select_own
  on trade_estimate_lines for select using (user_id = auth.uid());
drop policy if exists trade_estimate_lines_insert_own on trade_estimate_lines;
create policy trade_estimate_lines_insert_own
  on trade_estimate_lines for insert with check (user_id = auth.uid());

comment on table estimate_evidence is
  'Step1/Step2 모든 증거(도면 치수/렌더 이미지/Vision/사용자 선택/Chat)를 통합 저장 — SurfacePlan/SystemPlan/FixturePlan의 evidenceIds로 참조.';
comment on table surface_plans is
  '부위별 마감 계획 — bathroom/floor/wall 등. WorkPackageRule이 이를 trade lines로 전개.';
comment on table work_package_rules is
  '자재 카테고리 → 공종별 작업 패키지 전개 규칙. DB seed 가능 — 추후 admin UI에서 편집.';
comment on table trade_estimate_lines is
  '견적 라인 영속화 — 사업자 입찰/계약 결과와 비교하여 학습.';
comment on table estimate_accuracy_outcomes is
  'AI 견적 vs 사업자 입찰 vs 최종 계약 금액 비교 — 정확도 학습 데이터.';
