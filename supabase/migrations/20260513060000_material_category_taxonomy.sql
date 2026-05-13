-- P15-1: 자재 카테고리 Taxonomy 베이스
-- 가이드: inpick-material-category-taxonomy-base-20260513.md §10
--
-- 5대 discipline (MAT/ARC/MEC/ELE/FUR) × 카테고리 코드 체계
-- AI는 카테고리만 판단, DB가 brand/manufacturer/sku/price 결정.

create extension if not exists "pgcrypto";

-- ─── material_category_taxonomy — 카테고리 마스터 ────────────────
create table if not exists material_category_taxonomy (
  category_code text primary key,
  discipline text not null check (discipline in ('MAT', 'ARC', 'MEC', 'ELE', 'FUR')),
  major_name_ko text not null,
  middle_name_ko text not null,
  minor_name_ko text not null,
  display_name_ko text not null,

  trade_codes text[] not null default '{}',
  default_unit text not null,
  spec_schema jsonb not null default '{}'::jsonb,
  keywords text[] not null default '{}',

  requires_product_match boolean not null default true,
  high_value boolean not null default false,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mct_discipline on material_category_taxonomy(discipline);
create index if not exists idx_mct_trade_codes on material_category_taxonomy using gin (trade_codes);
create index if not exists idx_mct_active on material_category_taxonomy(active) where active = true;
create index if not exists idx_mct_high_value on material_category_taxonomy(high_value) where high_value = true;

-- ─── material_category_aliases — 한국어/영어/검색어 → category_code ──
create table if not exists material_category_aliases (
  id uuid primary key default gen_random_uuid(),
  alias text not null,
  category_code text not null references material_category_taxonomy(category_code) on delete cascade,
  weight numeric not null default 1.0,
  locale text not null default 'ko',
  created_at timestamptz not null default now()
);

create unique index if not exists uq_mca_alias_code on material_category_aliases(alias, category_code);
create index if not exists idx_mca_alias_lower on material_category_aliases(lower(alias));

-- ─── material_product_category_map — material_products → category_code ──
create table if not exists material_product_category_map (
  id uuid primary key default gen_random_uuid(),
  material_product_id uuid not null,
  category_code text not null references material_category_taxonomy(category_code) on delete cascade,
  confidence numeric not null default 1.0,
  source text not null default 'admin_or_seed',
  created_at timestamptz not null default now()
);

create unique index if not exists uq_mpcm_product_category
  on material_product_category_map(material_product_id, category_code);
create index if not exists idx_mpcm_category on material_product_category_map(category_code);

-- ─── construction_estimate_lines에 추가 컬럼 ──────────────────
alter table construction_estimate_lines
  add column if not exists material_brand text,
  add column if not exists material_manufacturer text,
  add column if not exists material_supplier text,
  add column if not exists material_model_name text,
  add column if not exists material_model_no text,
  add column if not exists material_sku text,
  add column if not exists material_spec_text text,
  add column if not exists material_unit_price numeric,
  add column if not exists material_fallback_reason text,
  add column if not exists material_match_confidence numeric;

-- ─── RLS — material_category_taxonomy/aliases는 공용 read ────
alter table material_category_taxonomy enable row level security;
alter table material_category_aliases enable row level security;
alter table material_product_category_map enable row level security;

drop policy if exists mct_public_read on material_category_taxonomy;
create policy mct_public_read
  on material_category_taxonomy for select using (true);

drop policy if exists mca_public_read on material_category_aliases;
create policy mca_public_read
  on material_category_aliases for select using (true);

drop policy if exists mpcm_public_read on material_product_category_map;
create policy mpcm_public_read
  on material_product_category_map for select using (true);

comment on table material_category_taxonomy is
  '5대 discipline (MAT/ARC/MEC/ELE/FUR) 카테고리 마스터 — WorkPackageOutput.materialCategoryCode와 매칭.';
comment on table material_category_aliases is
  '한국어/영어 자연어 → category_code alias. AI가 카테고리 판단할 때 lookup.';
