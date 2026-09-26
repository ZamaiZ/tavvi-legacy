create table public.platform_appearance (
  singleton boolean primary key default true check (singleton),
  brand_accent text not null default '#2563EB' check (brand_accent ~ '^#[0-9A-Fa-f]{6}$'),
  on_accent_override text check (on_accent_override is null or on_accent_override ~ '^#[0-9A-Fa-f]{6}$'),
  schema_version integer not null default 1 check (schema_version = 1),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

insert into public.platform_appearance (singleton, brand_accent, on_accent_override)
values (true, '#2563EB', null);

alter table public.platform_appearance enable row level security;

create policy platform_appearance_public_read on public.platform_appearance
  for select to anon, authenticated using (true);

create policy platform_appearance_admin_update on public.platform_appearance
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

revoke select on public.platform_appearance from anon, authenticated;
grant select (brand_accent, on_accent_override, schema_version, updated_at)
  on public.platform_appearance to anon, authenticated;
grant update (brand_accent, on_accent_override) on public.platform_appearance to authenticated;

create or replace function public.touch_platform_appearance()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$fn$;

create trigger platform_appearance_touch
before update on public.platform_appearance
for each row execute function public.touch_platform_appearance();

create or replace function public.update_platform_appearance(
  p_brand_accent text,
  p_on_accent_override text,
  p_trusted_ip inet default null
)
returns setof public.platform_appearance
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
    update public.platform_appearance
    set brand_accent = upper(p_brand_accent),
        on_accent_override = upper(p_on_accent_override)
    where singleton = true
    returning *;

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
