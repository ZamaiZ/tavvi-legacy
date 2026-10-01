-- In 0016 the INSERT used an unqualified `returning id`. Inside PL/pgSQL the
-- `returns table (id uuid, ...)` output column is also a variable named `id`,
-- so Postgres rejected every rotation with "column reference "id" is
-- ambiguous". Qualify it through an alias, as create_platform_admin_invite does.

create or replace function public.rotate_platform_admin_invite(p_invite_id uuid, p_token_hash bytea)
returns table (id uuid, email text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_old public.invites%rowtype;
  v_new_id uuid;
  v_now timestamptz := now();
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if p_token_hash is null or octet_length(p_token_hash) <> 32 then
    raise exception 'invalid invite token hash' using errcode = '22023';
  end if;

  select i.* into v_old
    from public.invites i
   where i.id = p_invite_id and i.restaurant_id is null
   for update;
  if not found then
    raise exception 'platform invite not found' using errcode = 'P0002';
  end if;
  if v_old.revoked_at is not null or v_old.redeemed_at is not null or v_old.expires_at <= v_now then
    raise exception 'invite is no longer pending' using errcode = 'P0001';
  end if;

  insert into public.invites as new_invite (created_by, email, expires_at, restaurant_id, role, token_hash)
  values (auth.uid(), v_old.email, v_old.expires_at, null, 'admin', p_token_hash)
  returning new_invite.id into v_new_id;

  update public.invites i set revoked_at = v_now
   where i.id = p_invite_id and i.revoked_at is null;

  perform public.record_audit(
    'invite.rotated', 'invite', v_new_id, null,
    jsonb_build_object('replacesInviteId', p_invite_id)
  );

  return query select v_new_id, v_old.email, v_old.expires_at;
end;
$fn$;

revoke all on function public.rotate_platform_admin_invite(uuid, bytea) from public;
grant execute on function public.rotate_platform_admin_invite(uuid, bytea) to authenticated;

notify pgrst, 'reload schema';
