-- Biometria persistente (spec 2026-10-01-biometria-persistente). O registro da
-- digital deixa de guardar refresh token: guardava o mesmo da sessão do app, e
-- tudo que derrubava a sessão derrubava a digital junto. Agora o backend cria
-- uma sessão nova a cada login por digital, e a digital só deixa de valer por
-- uma revogação explícita, gravada com o motivo.

alter table public.platform_admin_device_contracts
  add column revoked_reason text;

-- Até aqui, só a desativação na tela de login revogava.
update public.platform_admin_device_contracts
   set revoked_reason = 'user_disabled'
 where revoked_at is not null;

-- Os registros ativos guardam refresh token e não servem no modelo novo: a
-- digital precisa ser ativada uma vez de novo.
update public.platform_admin_device_contracts
   set revoked_at = now(),
       revoked_reason = 'upgraded',
       updated_at = now()
 where revoked_at is null;

alter table public.platform_admin_device_contracts
  add constraint platform_admin_device_contracts_revoked_reason_check
    check (revoked_reason in ('user_disabled', 'admin_removed', 'password_changed', 'signed_out_everywhere', 'upgraded')),
  add constraint platform_admin_device_contracts_revoked_pair_check
    check ((revoked_at is null) = (revoked_reason is null));

drop function if exists public.replace_mobile_device_refresh(bytea, bytea, text, text, text);
drop function if exists public.register_mobile_device_contract(uuid, bytea, bytea, text, text, text);
drop function if exists public.get_mobile_device_contract(uuid, bytea);
drop function if exists public.revoke_mobile_device_contract(uuid, bytea);

drop index if exists public.platform_admin_device_contracts_refresh_hash_idx;

alter table public.platform_admin_device_contracts
  drop column refresh_token_hash,
  drop column refresh_token_ciphertext,
  drop column refresh_token_nonce,
  drop column refresh_token_tag;

create function public.register_mobile_device_contract(
  p_device_id uuid,
  p_device_secret_hash bytea
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
  if p_device_id is null or p_device_secret_hash is null or octet_length(p_device_secret_hash) <> 32 then
    raise exception 'invalid device contract' using errcode = '22023';
  end if;

  insert into public.platform_admin_device_contracts (
    user_id, device_id, device_secret_hash, created_at, updated_at, last_used_at, revoked_at, revoked_reason
  ) values (
    auth.uid(), p_device_id, p_device_secret_hash, now(), now(), now(), null, null
  )
  on conflict (user_id, device_id) do update set
    device_secret_hash = excluded.device_secret_hash,
    updated_at = now(),
    last_used_at = now(),
    revoked_at = null,
    revoked_reason = null
  returning id into v_id;

  return v_id;
end;
$fn$;

-- Devolve o registro mesmo revogado: o motivo vira a mensagem do app. Só o
-- backend (service_role) chama, e só depois de o aparelho provar o segredo.
create function public.get_mobile_device_contract(
  p_device_id uuid,
  p_device_secret_hash bytea
)
returns table (id uuid, user_id uuid, revoked_at timestamptz, revoked_reason text)
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if p_device_id is null or p_device_secret_hash is null or octet_length(p_device_secret_hash) <> 32 then
    return;
  end if;

  update public.platform_admin_device_contracts c
     set last_used_at = now()
   where c.device_id = p_device_id
     and c.device_secret_hash = p_device_secret_hash
     and c.revoked_at is null;

  return query
    select c.id, c.user_id, c.revoked_at, c.revoked_reason
      from public.platform_admin_device_contracts c
     where c.device_id = p_device_id
       and c.device_secret_hash = p_device_secret_hash
     order by (c.revoked_at is null) desc, c.updated_at desc
     limit 1;
end;
$fn$;

create function public.revoke_mobile_device_contract(
  p_device_id uuid,
  p_device_secret_hash bytea,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if p_reason is null or p_reason not in ('user_disabled', 'admin_removed') then
    raise exception 'invalid revocation reason' using errcode = '22023';
  end if;
  if p_device_id is null or p_device_secret_hash is null or octet_length(p_device_secret_hash) <> 32 then
    return false;
  end if;

  update public.platform_admin_device_contracts c
     set revoked_at = now(),
         revoked_reason = p_reason,
         updated_at = now()
   where c.device_id = p_device_id
     and c.device_secret_hash = p_device_secret_hash
     and c.revoked_at is null;

  return found;
end;
$fn$;

-- Depois do login com senha, o app confere se a digital que ele acha ativa
-- ainda vale ("Sair de todos" e troca de senha revogam sem o aparelho saber).
create function public.is_my_device_contract_active(p_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.platform_admin_device_contracts c
     where c.user_id = (select auth.uid())
       and c.device_id = p_device_id
       and c.revoked_at is null
  );
$fn$;

-- "Sair de todos os aparelhos": desliga as digitais e apaga as inscrições de
-- push da conta. Quem chama encerra as sessões logo depois (logout global).
create function public.revoke_all_my_devices()
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update public.platform_admin_device_contracts c
     set revoked_at = now(),
         revoked_reason = 'signed_out_everywhere',
         updated_at = now()
   where c.user_id = auth.uid()
     and c.revoked_at is null;

  delete from public.push_subscriptions s
   where s.user_id = auth.uid();
end;
$fn$;

-- Troca de senha por qualquer caminho (painel do Supabase, recuperação, API)
-- desliga a digital em todos os aparelhos.
create function public.revoke_device_contracts_on_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  update public.platform_admin_device_contracts c
     set revoked_at = now(),
         revoked_reason = 'password_changed',
         updated_at = now()
   where c.user_id = new.id
     and c.revoked_at is null;
  return new;
end;
$fn$;

drop trigger if exists revoke_device_contracts_on_password_change on auth.users;
create trigger revoke_device_contracts_on_password_change
  after update of encrypted_password on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password)
  execute function public.revoke_device_contracts_on_password_change();

revoke all on function public.register_mobile_device_contract(uuid, bytea) from public, anon;
revoke all on function public.get_mobile_device_contract(uuid, bytea) from public, anon, authenticated;
revoke all on function public.revoke_mobile_device_contract(uuid, bytea, text) from public, anon, authenticated;
revoke all on function public.is_my_device_contract_active(uuid) from public, anon;
revoke all on function public.revoke_all_my_devices() from public, anon;
revoke all on function public.revoke_device_contracts_on_password_change() from public, anon, authenticated;

grant execute on function public.register_mobile_device_contract(uuid, bytea) to authenticated;
grant execute on function public.get_mobile_device_contract(uuid, bytea) to service_role;
grant execute on function public.revoke_mobile_device_contract(uuid, bytea, text) to service_role;
grant execute on function public.is_my_device_contract_active(uuid) to authenticated;
grant execute on function public.revoke_all_my_devices() to authenticated;
