-- Aplicar apenas como migração incremental em projetos existentes. A baseline
-- 0001 continua reservada a instalações novas e vazias.
alter table public.menu_tags
  add column if not exists nfc_serial text,
  add column if not exists nfc_verified_at timestamptz,
  add column if not exists nfc_verified_by uuid references public.profiles(id) on delete set null;

alter table public.menu_tags
  drop constraint if exists menu_tags_nfc_serial_format;
alter table public.menu_tags
  add constraint menu_tags_nfc_serial_format
  check (nfc_serial is null or nfc_serial ~ '^[0-9A-F]{14}$');

alter table public.menu_tags
  drop constraint if exists menu_tags_nfc_binding_complete;
alter table public.menu_tags
  add constraint menu_tags_nfc_binding_complete
  check ((nfc_serial is null) = (nfc_verified_at is null));

create unique index if not exists menu_tags_nfc_serial_key
  on public.menu_tags (nfc_serial) where nfc_serial is not null;

create or replace function public.menu_tags_guard_nfc_binding()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  if (new.nfc_serial, new.nfc_verified_at, new.nfc_verified_by)
       is distinct from
     (old.nfc_serial, old.nfc_verified_at, old.nfc_verified_by)
     and current_setting('tavvi.nfc_registration', true) is distinct from 'allowed' then
    raise exception 'nfc_binding_requires_registration' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

drop trigger if exists menu_tags_guard_nfc on public.menu_tags;
create trigger menu_tags_guard_nfc
  before update on public.menu_tags
  for each row execute function public.menu_tags_guard_nfc_binding();

create or replace function public.menu_tags_audit_nfc_routing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if old.nfc_serial is not null and (
    new.table_number is distinct from old.table_number
    or new.is_active is distinct from old.is_active
  ) then
    insert into public.audit_log
      (actor_id, action, subject_type, subject_id, restaurant_id, metadata)
    values
      (auth.uid(), 'tag.nfc.routing_changed', 'menu_tag', new.id, new.restaurant_id,
       jsonb_build_object('serial', old.nfc_serial,
                          'old_table', old.table_number, 'new_table', new.table_number,
                          'old_active', old.is_active, 'new_active', new.is_active));
  end if;
  return new;
end;
$fn$;

drop trigger if exists menu_tags_audit_nfc_routing on public.menu_tags;
create trigger menu_tags_audit_nfc_routing
  after update on public.menu_tags
  for each row execute function public.menu_tags_audit_nfc_routing();

-- Uma única chamada efetiva asserta o vínculo e grava sua evidência.
-- Tentativas e falhas também entram no log, com o mesmo operation_id.
create or replace function public.record_menu_tag_nfc_event(
  p_tag_id uuid,
  p_operation_id uuid,
  p_event text,
  p_serial text,
  p_reason text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_restaurant_id uuid;
  v_verified_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'nfc_unauthorized' using errcode = '42501';
  end if;
  if p_tag_id is null or p_operation_id is null or p_event is null or p_serial is null
     or p_event not in ('started', 'failed', 'verified')
     or p_serial !~ '^[0-9A-F]{14}$'
     or length(coalesce(p_reason, '')) > 80
     or (p_event = 'failed' and p_reason is null)
     or (p_event <> 'failed' and p_reason is not null) then
    raise exception 'nfc_invalid_input' using errcode = '22023';
  end if;

  select restaurant_id into v_restaurant_id
    from public.menu_tags where id = p_tag_id;
  if v_restaurant_id is null or not (
    public.is_restaurant_admin(v_restaurant_id) or public.is_platform_admin()
  ) then
    raise exception 'nfc_forbidden' using errcode = '42501';
  end if;

  -- Recusar a operação antes de gravar uma etiqueta já atribuída a outra mesa.
  -- O índice único permanece como proteção para uma corrida entre aparelhos.
  if p_event = 'started' and exists (
    select 1 from public.menu_tags
     where nfc_serial = p_serial and id <> p_tag_id
  ) then
    raise exception 'nfc_serial_already_bound' using errcode = '23505';
  end if;

  if p_event = 'verified' then
    if not exists (
      select 1 from public.audit_log a
       where a.subject_type = 'menu_tag'
         and a.subject_id = p_tag_id
         and a.restaurant_id = v_restaurant_id
         and a.action = 'tag.nfc.started'
         and a.actor_id = auth.uid()
         and a.created_at > now() - interval '30 minutes'
         and a.metadata ->> 'operation_id' = p_operation_id::text
         and a.metadata ->> 'serial' = p_serial
    ) then
      raise exception 'nfc_operation_not_started' using errcode = '22023';
    end if;
    perform set_config('tavvi.nfc_registration', 'allowed', true);
    update public.menu_tags
       set nfc_serial = p_serial,
           nfc_verified_at = now(),
           nfc_verified_by = auth.uid()
     where id = p_tag_id
     returning nfc_verified_at into v_verified_at;
  end if;

  insert into public.audit_log
    (actor_id, action, subject_type, subject_id, restaurant_id, metadata)
  values
    (auth.uid(), 'tag.nfc.' || p_event, 'menu_tag', p_tag_id,
     v_restaurant_id,
     jsonb_build_object('operation_id', p_operation_id,
                        'serial', p_serial, 'reason', p_reason));

  return v_verified_at;
end;
$fn$;

revoke all on function public.record_menu_tag_nfc_event(uuid, uuid, text, text, text) from public;
grant execute on function public.record_menu_tag_nfc_event(uuid, uuid, text, text, text) to authenticated;

create or replace function public.list_menu_tag_nfc_events(p_tag_id uuid)
returns table (
  action text,
  serial text,
  reason text,
  actor_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_restaurant_id uuid;
begin
  select t.restaurant_id into v_restaurant_id
    from public.menu_tags t where t.id = p_tag_id;
  if auth.uid() is null or v_restaurant_id is null or not (
    public.is_restaurant_admin(v_restaurant_id) or public.is_platform_admin()
  ) then
    raise exception 'nfc_forbidden' using errcode = '42501';
  end if;

  return query
    select a.action, a.metadata ->> 'serial',
           case when a.action = 'tag.nfc.routing_changed'
             then 'Mesa ' || coalesce(a.metadata ->> 'old_table', 'sem número')
                  || ' → ' || coalesce(a.metadata ->> 'new_table', 'sem número')
                  || '; ' || case when a.metadata ->> 'new_active' = 'true'
                                   then 'ativo' else 'desativado' end
             else a.metadata ->> 'reason' end,
           a.actor_id, a.created_at
      from public.audit_log a
     where a.subject_type = 'menu_tag'
       and a.subject_id = p_tag_id
       and a.restaurant_id = v_restaurant_id
       and a.action in ('tag.nfc.started', 'tag.nfc.failed', 'tag.nfc.verified', 'tag.nfc.routing_changed')
     order by a.created_at desc
     limit 30;
end;
$fn$;

revoke all on function public.list_menu_tag_nfc_events(uuid) from public;
grant execute on function public.list_menu_tag_nfc_events(uuid) to authenticated;
