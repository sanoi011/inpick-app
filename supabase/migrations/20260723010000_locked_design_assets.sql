-- Private, entitlement-gated originals for Step 2 design outputs.
-- The bucket and metadata are service-role only; authenticated users receive sanitized API payloads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-design-renders',
  'private-design-renders',
  false,
  20971520,
  array['image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "locked_design_service_role_only" on storage.objects;
create policy "locked_design_service_role_only"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'private-design-renders')
  with check (bucket_id = 'private-design-renders');

create table if not exists public.locked_design_assets (
  id uuid primary key default gen_random_uuid(),
  design_output_id uuid not null unique references public.design_outputs(id) on delete cascade,
  project_id uuid not null references public.consumer_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_bucket text not null default 'private-design-renders'
    check (storage_bucket = 'private-design-renders'),
  original_storage_path text not null unique
    check (original_storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  source_kind text not null check (source_kind in ('data_url', 'remote_url')),
  status text not null default 'completed' check (status in ('completed', 'failed')),
  unlock_cost integer not null check (unlock_cost between 1 and 1000),
  mime_type text not null default 'image/webp' check (mime_type = 'image/webp'),
  width integer not null check (width between 1 and 8192),
  height integer not null check (height between 1 and 8192),
  byte_size integer not null check (byte_size between 1 and 20971520),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_locked_design_assets_owner_project
  on public.locked_design_assets(user_id, project_id, created_at desc);

create table if not exists public.locked_design_access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.locked_design_assets(id) on delete cascade,
  design_output_id uuid not null references public.design_outputs(id) on delete cascade,
  project_id uuid not null references public.consumer_projects(id) on delete cascade,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  charged_cost integer not null check (charged_cost between 1 and 1000),
  balance_after integer not null check (balance_after >= 0),
  credit_transaction_id uuid not null references public.credit_transactions(id),
  granted_at timestamptz not null default now(),
  unique (user_id, asset_id),
  unique (user_id, idempotency_key),
  unique (credit_transaction_id)
);

create index if not exists idx_locked_design_grants_project
  on public.locked_design_access_grants(user_id, project_id, granted_at desc);

alter table public.credit_transactions
  add column if not exists locked_design_asset_id uuid references public.locked_design_assets(id),
  add column if not exists idempotency_key text;

create unique index if not exists uq_credit_transactions_locked_asset
  on public.credit_transactions(user_id, locked_design_asset_id)
  where locked_design_asset_id is not null;

create unique index if not exists uq_credit_transactions_locked_idempotency
  on public.credit_transactions(user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.locked_design_assets enable row level security;
alter table public.locked_design_assets force row level security;
alter table public.locked_design_access_grants enable row level security;
alter table public.locked_design_access_grants force row level security;

drop policy if exists "locked_design_assets_service_role" on public.locked_design_assets;
create policy "locked_design_assets_service_role"
  on public.locked_design_assets for all to service_role
  using (true) with check (true);

drop policy if exists "locked_design_grants_service_role" on public.locked_design_access_grants;
create policy "locked_design_grants_service_role"
  on public.locked_design_access_grants for all to service_role
  using (true) with check (true);

create or replace function public.unlock_locked_design_asset(
  p_asset_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_asset record;
  v_credit record;
  v_grant public.locked_design_access_grants%rowtype;
  v_transaction_id uuid;
begin
  if v_actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  if p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = 'P0001';
  end if;

  -- A key cannot be replayed against another asset.
  select * into v_grant
  from public.locked_design_access_grants
  where user_id = v_actor and idempotency_key = p_idempotency_key;
  if found and v_grant.asset_id <> p_asset_id then
    raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
  elsif found then
    return jsonb_build_object(
      'grantId', v_grant.id,
      'assetId', v_grant.asset_id,
      'charged', false,
      'cost', v_grant.charged_cost,
      'balance', v_grant.balance_after
    );
  end if;

  -- Ownership is checked at both the output and authoritative project boundaries.
  select a.*, d.status as design_output_status
    into v_asset
  from public.locked_design_assets a
  join public.design_outputs d
    on d.id = a.design_output_id
   and d.project_id = a.project_id
   and d.user_id = a.user_id
  join public.consumer_projects cp
    on cp.id = a.project_id
   and cp.user_id = a.user_id
  where a.id = p_asset_id
    and a.user_id = v_actor
  for update of a;

  if not found then
    raise exception 'LOCKED_ASSET_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_asset.status <> 'completed'
     or v_asset.design_output_status not in ('generated', 'analysis_pending', 'analysis_done', 'analysis_failed') then
    raise exception 'LOCKED_ASSET_NOT_COMPLETED' using errcode = 'P0001';
  end if;

  -- Fast idempotent path before taking a balance lock.
  select * into v_grant
  from public.locked_design_access_grants
  where user_id = v_actor and asset_id = p_asset_id;
  if found then
    return jsonb_build_object(
      'grantId', v_grant.id,
      'assetId', v_grant.asset_id,
      'charged', false,
      'cost', v_grant.charged_cost,
      'balance', v_grant.balance_after
    );
  end if;

  -- Serialize all debits for this user. The second concurrent call rechecks the grant below.
  select * into v_credit
  from public.user_credits
  where user_id = v_actor
  for update;
  if not found or v_credit.balance < v_asset.unlock_cost then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;

  -- Recheck both uniqueness boundaries after the balance lock. A concurrent request may have committed.
  select * into v_grant
  from public.locked_design_access_grants
  where user_id = v_actor and idempotency_key = p_idempotency_key;
  if found and v_grant.asset_id <> p_asset_id then
    raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
  elsif found then
    return jsonb_build_object(
      'grantId', v_grant.id,
      'assetId', v_grant.asset_id,
      'charged', false,
      'cost', v_grant.charged_cost,
      'balance', v_grant.balance_after
    );
  end if;

  select * into v_grant
  from public.locked_design_access_grants
  where user_id = v_actor and asset_id = p_asset_id;
  if found then
    return jsonb_build_object(
      'grantId', v_grant.id,
      'assetId', v_grant.asset_id,
      'charged', false,
      'cost', v_grant.charged_cost,
      'balance', v_grant.balance_after
    );
  end if;

  update public.user_credits
  set balance = balance - v_asset.unlock_cost
  where user_id = v_actor;

  insert into public.credit_transactions (
    user_id, amount, type, description, locked_design_asset_id, idempotency_key
  ) values (
    v_actor,
    -v_asset.unlock_cost,
    'USE',
    '잠금 디자인 원본 열람',
    p_asset_id,
    p_idempotency_key
  ) returning id into v_transaction_id;

  insert into public.locked_design_access_grants (
    user_id,
    asset_id,
    design_output_id,
    project_id,
    idempotency_key,
    charged_cost,
    balance_after,
    credit_transaction_id
  ) values (
    v_actor,
    p_asset_id,
    v_asset.design_output_id,
    v_asset.project_id,
    p_idempotency_key,
    v_asset.unlock_cost,
    v_credit.balance - v_asset.unlock_cost,
    v_transaction_id
  ) returning * into v_grant;

  return jsonb_build_object(
    'grantId', v_grant.id,
    'assetId', v_grant.asset_id,
    'charged', true,
    'cost', v_grant.charged_cost,
    'balance', v_grant.balance_after
  );
end;
$$;

revoke all on table public.locked_design_assets from public, anon, authenticated;
revoke all on table public.locked_design_access_grants from public, anon, authenticated;
grant select, insert, update, delete on table public.locked_design_assets to service_role;
grant select, insert, update, delete on table public.locked_design_access_grants to service_role;

revoke all on function public.unlock_locked_design_asset(uuid, text) from public, anon;
grant execute on function public.unlock_locked_design_asset(uuid, text) to authenticated;

comment on table public.locked_design_assets is
  'Private original design render metadata. Storage locations are never returned by list/register APIs.';
comment on function public.unlock_locked_design_asset(uuid, text) is
  'Owner-only atomic credit debit, ledger write, and durable access grant. Safe for retries/concurrency.';
