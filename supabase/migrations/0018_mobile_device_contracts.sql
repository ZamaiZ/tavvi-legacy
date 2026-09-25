-- Device contracts let the Express API restore one mobile session per installation.
-- Refresh tokens are encrypted by the backend before they enter this table.

create table public.platform_admin_device_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  device_secret_hash bytea not null check (octet_length(device_secret_hash) = 32),
  refresh_token_hash bytea not null check (octet_length(refresh_token_hash) = 32),
  refresh_token_ciphertext text not null,
  refresh_token_nonce text not null,
  refresh_token_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  unique (user_id, device_id)
);

create unique index platform_admin_device_contracts_active_secret_idx
  on public.platform_admin_device_contracts (device_secret_hash)
  where revoked_at is null;

create index platform_admin_device_contracts_refresh_hash_idx
  on public.platform_admin_device_contracts (refresh_token_hash)
  where revoked_at is null;

alter table public.platform_admin_device_contracts enable row level security;
revoke all on table public.platform_admin_device_contracts from public, anon, authenticated;

create or replace function public.register_mobile_device_contract(
  p_device_id uuid,
  p_device_secret_hash bytea,
  p_refresh_token_hash bytea,
  p_refresh_token_ciphertext text,
  p_refresh_token_nonce text,
  p_refresh_token_tag text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if p_device_secret_hash is null or octet_length(p_device_secret_hash) <> 32
    or p_refresh_token_hash is null or octet_length(p_refresh_token_hash) <> 32
    or p_refresh_token_ciphertext is null or length(p_refresh_token_ciphertext) = 0
    or p_refresh_token_nonce is null or length(p_refresh_token_nonce) = 0
    or p_refresh_token_tag is null or length(p_refresh_token_tag) = 0 then
    raise exception 'invalid device contract' using errcode = '22023';
  end if;

  insert into public.platform_admin_device_contracts (
    user_id, device_id, device_secret_hash, refresh_token_hash,
    refresh_token_ciphertext, refresh_token_nonce, refresh_token_tag,
    created_at, updated_at, last_used_at, revoked_at
  ) values (
    auth.uid(), p_device_id, p_device_secret_hash, p_refresh_token_hash,
    p_refresh_token_ciphertext, p_refresh_token_nonce, p_refresh_token_tag,
    now(), now(), now(), null
  )
  on conflict (user_id, device_id) do update set
    device_secret_hash = excluded.device_secret_hash,
    refresh_token_hash = excluded.refresh_token_hash,
    refresh_token_ciphertext = excluded.refresh_token_ciphertext,
    refresh_token_nonce = excluded.refresh_token_nonce,
    refresh_token_tag = excluded.refresh_token_tag,
    updated_at = now(),
    last_used_at = now(),
    revoked_at = null
  returning id into v_id;

  return v_id;
end;
$fn$;

create or replace function public.get_mobile_device_contract(
  p_device_id uuid,
  p_device_secret_hash bytea
)
returns table (
  id uuid,
  user_id uuid,
  refresh_token_hash text,
  refresh_token_ciphertext text,
  refresh_token_nonce text,
  refresh_token_tag text
)
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if p_device_secret_hash is null or octet_length(p_device_secret_hash) <> 32 then
    return;
  end if;

  return query
    update public.platform_admin_device_contracts c
       set last_used_at = now()
     where c.device_id = p_device_id
       and c.device_secret_hash = p_device_secret_hash
       and c.revoked_at is null
     returning c.id, c.user_id, encode(c.refresh_token_hash, 'hex'),
               c.refresh_token_ciphertext, c.refresh_token_nonce, c.refresh_token_tag;
end;
$fn$;

create or replace function public.replace_mobile_device_refresh(
  p_old_refresh_token_hash bytea,
  p_new_refresh_token_hash bytea,
  p_refresh_token_ciphertext text,
  p_refresh_token_nonce text,
  p_refresh_token_tag text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if p_old_refresh_token_hash is null or octet_length(p_old_refresh_token_hash) <> 32
    or p_new_refresh_token_hash is null or octet_length(p_new_refresh_token_hash) <> 32
    or p_refresh_token_ciphertext is null or length(p_refresh_token_ciphertext) = 0
    or p_refresh_token_nonce is null or length(p_refresh_token_nonce) = 0
    or p_refresh_token_tag is null or length(p_refresh_token_tag) = 0 then
    raise exception 'invalid device contract refresh' using errcode = '22023';
  end if;

  update public.platform_admin_device_contracts c
     set refresh_token_hash = p_new_refresh_token_hash,
         refresh_token_ciphertext = p_refresh_token_ciphertext,
         refresh_token_nonce = p_refresh_token_nonce,
         refresh_token_tag = p_refresh_token_tag,
         updated_at = now(),
         last_used_at = now()
   where c.refresh_token_hash = p_old_refresh_token_hash
     and c.revoked_at is null;

  return found;
end;
$fn$;

create or replace function public.revoke_mobile_device_contract(
  p_device_id uuid,
  p_device_secret_hash bytea
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if p_device_secret_hash is null or octet_length(p_device_secret_hash) <> 32 then
    return false;
  end if;

  update public.platform_admin_device_contracts c
     set revoked_at = coalesce(c.revoked_at, now()),
         updated_at = now()
   where c.device_id = p_device_id
     and c.device_secret_hash = p_device_secret_hash
     and c.revoked_at is null;

  return found;
end;
$fn$;

revoke all on function public.register_mobile_device_contract(uuid, bytea, bytea, text, text, text) from public;
revoke all on function public.get_mobile_device_contract(uuid, bytea) from public;
revoke all on function public.replace_mobile_device_refresh(bytea, bytea, text, text, text) from public;
revoke all on function public.revoke_mobile_device_contract(uuid, bytea) from public;

grant execute on function public.register_mobile_device_contract(uuid, bytea, bytea, text, text, text) to authenticated;
grant execute on function public.get_mobile_device_contract(uuid, bytea) to anon, authenticated;
grant execute on function public.replace_mobile_device_refresh(bytea, bytea, text, text, text) to anon, authenticated;
grant execute on function public.revoke_mobile_device_contract(uuid, bytea) to anon, authenticated;
