-- P12-2: construction_estimate_lines에 제조사/브랜드/SKU/단가출처 컬럼 추가.
-- + estimate_line_product_snapshots 신규 테이블 (견적 발행 후 product DB 변경 시 과거 견적 보호).
-- 가이드: inpick-estimate-v2-product-price-pdf-fix-plan-20260513.md §3

-- ─── construction_estimate_lines 컬럼 보강 ─────────────────────
alter table construction_estimate_lines
  add column if not exists material_product_id uuid,
  add column if not exists brand text,
  add column if not exists manufacturer text,
  add column if not exists supplier_name text,
  add column if not exists vendor_name text,
  add column if not exists product_name text,
  add column if not exists sku text,
  add column if not exists model_no text,
  add column if not exists product_spec text,
  add column if not exists product_unit text,
  add column if not exists material_category_code text,
  add column if not exists material_category_name text,
  add column if not exists material_price_source text,
  add column if not exists material_price_source_id uuid,
  add column if not exists material_price_applied_at timestamptz,
  add column if not exists product_match_status text,
  add column if not exists product_match_confidence numeric,
  add column if not exists price_confidence numeric,
  add column if not exists fallback_reason text;

create index if not exists idx_cel_material_product_id
  on construction_estimate_lines(material_product_id) where material_product_id is not null;
create index if not exists idx_cel_product_match_status
  on construction_estimate_lines(product_match_status);

-- ─── estimate_line_product_snapshots — 발행 후 가격 변경 보호 ───
create table if not exists estimate_line_product_snapshots (
  id uuid primary key default gen_random_uuid(),
  estimate_line_id uuid references construction_estimate_lines(id) on delete cascade,
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,

  material_product_id uuid,
  brand text,
  manufacturer text,
  supplier_name text,
  vendor_name text,
  product_name text,
  sku text,
  model_no text,
  spec text,
  unit text,
  unit_price numeric,
  price_source text,
  price_source_id uuid,
  price_applied_at timestamptz,
  match_status text,
  match_confidence numeric,
  price_confidence numeric,
  fallback_reason text,
  raw_product jsonb default '{}'::jsonb,
  raw_price jsonb default '{}'::jsonb,

  created_at timestamptz default now()
);

create index if not exists idx_elps_estimate_line_id
  on estimate_line_product_snapshots(estimate_line_id);
create index if not exists idx_elps_project_id
  on estimate_line_product_snapshots(project_id, created_at desc);

alter table estimate_line_product_snapshots enable row level security;

drop policy if exists elps_select_own on estimate_line_product_snapshots;
create policy elps_select_own
  on estimate_line_product_snapshots for select
  using (user_id = auth.uid());

drop policy if exists elps_insert_own on estimate_line_product_snapshots;
create policy elps_insert_own
  on estimate_line_product_snapshots for insert
  with check (user_id = auth.uid());

comment on table estimate_line_product_snapshots is
  '견적 라인 발행 시점의 자재/단가 스냅샷 — 발행 후 material_products/price_lookup이 갱신돼도 과거 견적서 금액·상품정보 불변 보장.';

comment on column construction_estimate_lines.material_product_id is
  'material_products.id 직접 매칭 — 있으면 brand/sku/manufacturer 신뢰 가능';
comment on column construction_estimate_lines.product_match_status is
  'confirmed | recommended | category_default | standard_fallback';
comment on column construction_estimate_lines.material_price_source is
  'material_price_lookup | material_price_observations | contractor_price | catalog_price | category_standard | kpa_standard | manual_override';
comment on column construction_estimate_lines.fallback_reason is
  'standard_fallback인 이유 — admin/사용자에게 표시할 메시지';
