-- Bloqueio irreversível de escrita NDEF em etiquetas NFC já conferidas.
-- Completa também as colunas-base da 0003 para ambientes onde ela ainda não foi aplicada.

alter table public.menu_tags
  add column if not exists nfc_serial text,
  add column if not exists nfc_verified_at timestamptz,
  add column if not exists nfc_verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists nfc_protected_at timestamptz,
  add column if not exists nfc_protected_by uuid references public.profiles(id) on delete set null;

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

alter table public.menu_tags
  drop constraint if exists menu_tags_nfc_protection_complete;
alter table public.menu_tags
  add constraint menu_tags_nfc_protection_complete
  check (
    (nfc_protected_at is null or (nfc_serial is not null and nfc_verified_at is not null))
    and (nfc_protected_at is not null or nfc_protected_by is null)
  );

create or replace function public.menu_tags_guard_nfc_binding()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  if (new.nfc_serial, new.nfc_verified_at, new.nfc_verified_by,
      new.nfc_protected_at, new.nfc_protected_by)
       is distinct from
     (old.nfc_serial, old.nfc_verified_at, old.nfc_verified_by,
      old.nfc_protected_at, old.nfc_protected_by)
     and current_setting('tavvi.nfc_registration', true) is distinct from 'allowed' then
    -- ON DELETE SET NULL may clear actor references through a nested FK trigger.
    -- It must not permit changing the serial, verification, or protection state.
    if pg_trigger_depth() > 1
       and new.nfc_serial is not distinct from old.nfc_serial
       and new.nfc_verified_at is not distinct from old.nfc_verified_at
       and new.nfc_protected_at is not distinct from old.nfc_protected_at
       and (new.nfc_verified_by is null or new.nfc_verified_by is not distinct from old.nfc_verified_by)
       and (new.nfc_protected_by is null or new.nfc_protected_by is not distinct from old.nfc_protected_by) then
      return new;
    end if;
    raise exception 'nfc_binding_requires_registration' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

drop trigger if exists menu_tags_guard_nfc on public.menu_tags;
create trigger menu_tags_guard_nfc
  before update on public.menu_tags
  for each row execute function public.menu_tags_guard_nfc_binding();

-- Serialização por linha evita que um vínculo novo concorra com o bloqueio.
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
  v_protected_at timestamptz;
  v_existing_protected_at timestamptz;
  v_nfc_serial text;
begin
  if auth.uid() is null then
    raise exception 'nfc_unauthorized' using errcode = '42501';
  end if;
  if p_tag_id is null or p_operation_id is null or p_event is null or p_serial is null
     or p_event not in ('started', 'failed', 'verified', 'protected')
     or p_serial !~ '^[0-9A-F]{14}$'
     or length(coalesce(p_reason, '')) > 80
     or (p_event = 'failed' and (
       p_reason is null or p_reason not in (
         'write_error', 'read_error', 'wrong_tag', 'wrong_url', 'cancelled', 'protection_error'
       )
     ))
     or (p_event <> 'failed' and p_reason is not null) then
    raise exception 'nfc_invalid_input' using errcode = '22023';
  end if;

  select restaurant_id, nfc_protected_at, nfc_serial
    into v_restaurant_id, v_protected_at, v_nfc_serial
    from public.menu_tags
   where id = p_tag_id
   for update;

  if v_restaurant_id is null or not (
    public.is_restaurant_admin(v_restaurant_id) or public.is_platform_admin()
  ) then
    raise exception 'nfc_forbidden' using errcode = '42501';
  end if;

  if p_event = 'started' then
    if v_protected_at is not null then
      raise exception 'nfc_tag_already_protected' using errcode = '55000';
    end if;
    -- Recusar a operação antes de gravar uma etiqueta já atribuída a outra mesa.
    -- O índice único permanece como proteção para uma corrida entre aparelhos.
    if exists (
      select 1 from public.menu_tags
       where nfc_serial = p_serial and id <> p_tag_id
    ) then
      raise exception 'nfc_serial_already_bound' using errcode = '23505';
    end if;
  end if;

  if p_event = 'verified' then
    if v_protected_at is not null then
      raise exception 'nfc_tag_already_protected' using errcode = '55000';
    end if;
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
       and nfc_protected_at is null
     returning nfc_verified_at into v_verified_at;
    if v_verified_at is null then
      raise exception 'nfc_tag_already_protected' using errcode = '55000';
    end if;
  end if;

  if p_event = 'protected' then
    if v_protected_at is not null then
      select a.created_at into v_existing_protected_at
        from public.audit_log a
       where a.subject_type = 'menu_tag'
         and a.subject_id = p_tag_id
         and a.restaurant_id = v_restaurant_id
         and a.action = 'tag.nfc.protected'
         and a.metadata ->> 'operation_id' = p_operation_id::text
         and a.metadata ->> 'serial' = p_serial
       order by a.created_at desc
       limit 1;
      if v_existing_protected_at is not null then
        return v_existing_protected_at;
      end if;
      raise exception 'nfc_tag_already_protected' using errcode = '55000';
    end if;

    if v_nfc_serial is distinct from p_serial then
      raise exception 'nfc_binding_changed' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.audit_log a
       where a.subject_type = 'menu_tag'
         and a.subject_id = p_tag_id
         and a.restaurant_id = v_restaurant_id
         and a.action = 'tag.nfc.verified'
         and a.metadata ->> 'operation_id' = p_operation_id::text
         and a.metadata ->> 'serial' = p_serial
    ) then
      raise exception 'nfc_operation_not_verified' using errcode = '22023';
    end if;

    perform set_config('tavvi.nfc_registration', 'allowed', true);
    update public.menu_tags
       set nfc_protected_at = now(),
           nfc_protected_by = auth.uid()
     where id = p_tag_id
       and nfc_serial = p_serial
       and nfc_protected_at is null
     returning nfc_protected_at into v_protected_at;
    if v_protected_at is null then
      raise exception 'nfc_binding_changed' using errcode = '22023';
    end if;

    insert into public.audit_log
      (actor_id, action, subject_type, subject_id, restaurant_id, metadata)
    values
      (auth.uid(), 'tag.nfc.protected', 'menu_tag', p_tag_id, v_restaurant_id,
       jsonb_build_object('operation_id', p_operation_id,
                          'serial', p_serial, 'reason', null));

    return v_protected_at;
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
       and a.action in (
         'tag.nfc.started', 'tag.nfc.failed', 'tag.nfc.verified',
         'tag.nfc.protected', 'tag.nfc.routing_changed'
       )
     order by a.created_at desc
     limit 30;
end;
$fn$;

revoke all on function public.record_menu_tag_nfc_event(uuid, uuid, text, text, text) from public;
grant execute on function public.record_menu_tag_nfc_event(uuid, uuid, text, text, text) to authenticated;
revoke all on function public.list_menu_tag_nfc_events(uuid) from public;
grant execute on function public.list_menu_tag_nfc_events(uuid) to authenticated;

notify pgrst, 'reload schema';
