-- 부분 시공 설치 요청(리드) — 사용자가 자재 선택 후 "설치 요청"하면 생성.
-- 사업자/관리자가 지역 기반으로 확인해 연락(리드).

create table if not exists partial_install_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  surface text,
  material_query text,
  product_title text,
  product_price integer,
  product_link text,
  region text,
  contact text,
  note text,
  estimate_total integer,
  estimate_lines jsonb default '[]'::jsonb,
  status text not null default 'new', -- new | contacted | matched | closed
  created_at timestamptz default now()
);

create index if not exists partial_install_requests_region_idx
  on partial_install_requests (region, created_at desc);
create index if not exists partial_install_requests_user_idx
  on partial_install_requests (user_id, created_at desc);

alter table partial_install_requests enable row level security;

-- 누구나 리드 제출 가능(비로그인 포함, 연락처 입력 시)
drop policy if exists "pir insert public" on partial_install_requests;
create policy "pir insert public"
  on partial_install_requests for insert with check (true);

-- 본인 요청만 조회 (사업자/관리자는 service_role로 우회 조회)
drop policy if exists "pir select own" on partial_install_requests;
create policy "pir select own"
  on partial_install_requests for select using (auth.uid() = user_id);
