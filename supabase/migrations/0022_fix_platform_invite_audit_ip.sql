-- Keep platform invite writes atomic while passing the audit IP into the
-- correct record_audit argument. In 0017 the IP was passed as the
-- restaurant UUID, which made both RPCs fail when recording their audit row.

create or replace function public.create_platform_admin_invite(
  p_email text,
  p_expires_in_days integer,
  p_token_hash bytea,
  p_trusted_ip inet default null
)
returns table (id uuid)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_id uuid;
  v_expires_at timestamptz;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if p_token_hash is null or octet_length(p_token_hash) <> 32 then
    raise exception 'invalid invite token hash' using errcode = '22023';
  end if;
  if p_expires_in_days is null or p_expires_in_days < 1 or p_expires_in_days > 30 then
    raise exception 'invalid invite expiry' using errcode = '22023';
  end if;
  if p_email is not null
     and p_email <> ''
     and (length(p_email) > 254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then
    raise exception 'invalid invite email' using errcode = '22023';
  end if;

  v_expires_at := now() + make_interval(days => p_expires_in_days);

  insert into public.invites as new_invite (created_by, email, expires_at, restaurant_id, role, token_hash)
  values (auth.uid(), nullif(p_email, ''), v_expires_at, null, 'admin', p_token_hash)
  returning new_invite.id into v_id;

  perform public.record_audit(
    p_action => 'invite.created',
    p_subject_type => 'invite',
    p_subject_id => v_id,
    p_restaurant_id => null,
    p_metadata => jsonb_build_object('expiresInDays', p_expires_in_days, 'restrictedEmail', p_email is not null and p_email <> ''),
    p_ip => p_trusted_ip
  );

  return query select v_id;
end;
$fn$;

create or replace function public.revoke_platform_admin_invite(p_invite_id uuid, p_trusted_ip inet default null)
returns table (id uuid, revoked_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_invite public.invites%rowtype;
  v_revoked_at timestamptz;
  v_now timestamptz := now();
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  select i.* into v_invite
    from public.invites i
   where i.id = p_invite_id and i.restaurant_id is null
   for update;
  if not found then
    raise exception 'platform invite not found' using errcode = 'P0002';
  end if;
  if v_invite.revoked_at is not null then
    return query select v_invite.id, v_invite.revoked_at;
    return;
  end if;
  if v_invite.redeemed_at is not null or v_invite.expires_at <= v_now then
    raise exception 'invite is no longer pending' using errcode = 'P0001';
  end if;

  update public.invites i
     set revoked_at = v_now
   where i.id = p_invite_id
  returning i.revoked_at into v_revoked_at;

  perform public.record_audit(
    p_action => 'invite.revoked',
    p_subject_type => 'invite',
    p_subject_id => p_invite_id,
    p_restaurant_id => null,
    p_metadata => '{}'::jsonb,
    p_ip => p_trusted_ip
  );

  return query select p_invite_id, v_revoked_at;
end;
$fn$;

revoke all on function public.create_platform_admin_invite(text, integer, bytea, inet) from public;
revoke all on function public.revoke_platform_admin_invite(uuid, inet) from public;
grant execute on function public.create_platform_admin_invite(text, integer, bytea, inet) to authenticated;
grant execute on function public.revoke_platform_admin_invite(uuid, inet) to authenticated;

notify pgrst, 'reload schema';
