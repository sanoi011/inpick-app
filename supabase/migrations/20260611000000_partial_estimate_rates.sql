-- 부분 시공 적산 단가 (관리자 단가DB) — src/lib/partial/partial-estimate.ts 의 PartialRates 와 1:1
-- 미적용 시: /api/partial/rates 는 {} 반환, 적산 엔진은 내장 기본값(DEFAULT_PARTIAL_RATES) 사용 (graceful)

create table if not exists partial_estimate_rates (
  surface text primary key check (surface in ('floor', 'wall', 'ceiling', 'etc')),
  basis text not null check (basis in ('area', 'count')),
  trade text not null,
  install_per_unit integer not null,   -- 설치/시공 노무 (㎡ 또는 EA 당)
  demo_per_unit integer not null,      -- 기존 철거 노무 (단위당)
  disposal_per_unit integer not null,  -- 폐기물 처리 (단위당)
  aux_rate numeric not null default 0.1,-- 부자재 = 자재비 × 비율
  loss numeric not null default 0,     -- 면적 자재 로스율
  min_labor integer not null default 0,-- 최소 출장 노무비
  updated_at timestamptz default now(),
  updated_by text
);

-- 기본값 시드 (DEFAULT_PARTIAL_RATES 와 동일)
insert into partial_estimate_rates
  (surface, basis, trade, install_per_unit, demo_per_unit, disposal_per_unit, aux_rate, loss, min_labor)
values
  ('floor',   'area',  '바닥공사',      28000, 9000, 4000, 0.12, 0.08, 160000),
  ('wall',    'area',  '벽체·도배공사', 18000, 5000, 2500, 0.10, 0.10, 120000),
  ('ceiling', 'area',  '천정공사',      22000, 6000, 3000, 0.10, 0.10, 130000),
  ('etc',     'count', '부분공사',     120000,45000,20000, 0.10, 0.00,      0)
on conflict (surface) do nothing;

-- 공개 읽기 (적산 계산용). 쓰기는 service_role(관리자 API) 로만.
alter table partial_estimate_rates enable row level security;
do $$ begin
  create policy partial_estimate_rates_read on partial_estimate_rates for select using (true);
exception when duplicate_object then null; end $$;
