-- 자재 미리보기 저장 (P1) — render-space-edit로 생성한 "내 공간 자재 적용" 결과를 보관.
-- 토큰 차감은 생성 시 render-space-edit(enforceConsume, 1토큰)에서 처리. 저장은 영속화만.

create table if not exists material_previews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room text,
  surface text,
  material_name text,
  prompt text,
  source_url text,
  result_url text not null,
  model text,
  created_at timestamptz default now()
);

create index if not exists material_previews_user_idx
  on material_previews (user_id, created_at desc);

alter table material_previews enable row level security;

drop policy if exists "material_previews own select" on material_previews;
create policy "material_previews own select"
  on material_previews for select using (auth.uid() = user_id);

drop policy if exists "material_previews own insert" on material_previews;
create policy "material_previews own insert"
  on material_previews for insert with check (auth.uid() = user_id);

drop policy if exists "material_previews own delete" on material_previews;
create policy "material_previews own delete"
  on material_previews for delete using (auth.uid() = user_id);
