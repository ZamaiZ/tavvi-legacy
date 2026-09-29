-- The authenticated role may read only these appearance columns. Keep the
-- mutation RPC's return contract within that same column grant.
drop function public.update_platform_appearance(text, text, inet);

create function public.update_platform_appearance(
  p_brand_accent text,
  p_on_accent_override text,
  p_trusted_ip inet default null
)
returns table (
  brand_accent text,
  on_accent_override text,
  schema_version integer,
  updated_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $fn$
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_brand_accent !~ '^#[0-9A-Fa-f]{6}$'
    or (p_on_accent_override is not null and p_on_accent_override !~ '^#[0-9A-Fa-f]{6}$') then
    raise exception using errcode = '22023', message = 'invalid appearance color';
  end if;

  return query
    update public.platform_appearance as appearance
    set brand_accent = upper(p_brand_accent),
        on_accent_override = upper(p_on_accent_override)
    where appearance.singleton = true
    returning appearance.brand_accent,
              appearance.on_accent_override,
              appearance.schema_version,
              appearance.updated_at;

  if not found then
    raise exception using errcode = 'P0002', message = 'platform appearance missing';
  end if;

  perform public.record_audit(
    'platform.appearance.updated',
    'platform_appearance',
    null,
    null,
    jsonb_build_object('brandAccent', upper(p_brand_accent), 'customOnAccent', p_on_accent_override is not null),
    p_trusted_ip
  );
end;
$fn$;

revoke all on function public.update_platform_appearance(text, text, inet) from public, anon;
grant execute on function public.update_platform_appearance(text, text, inet) to authenticated;

notify pgrst, 'reload schema';
