-- =====================================================================
-- 0034 — Chamados de atendimento associados a plaquinhas/mesas
-- =====================================================================

alter table public.menu_tags
  add column if not exists table_number integer;

alter table public.menu_tags
  drop constraint if exists menu_tags_table_number_positive;
alter table public.menu_tags
  add constraint menu_tags_table_number_positive
  check (table_number is null or table_number > 0);

alter table public.menu_tags
  drop constraint if exists menu_tags_id_restaurant_id_key;
alter table public.menu_tags
  add constraint menu_tags_id_restaurant_id_key unique (id, restaurant_id);

create unique index if not exists menu_tags_active_table_number_key
  on public.menu_tags (restaurant_id, table_number)
  where is_active and table_number is not null;

drop policy if exists menu_tags_insert_admin on public.menu_tags;
create policy menu_tags_insert_admin on public.menu_tags
  for insert to authenticated
  with check (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_tags_update_member on public.menu_tags;
drop policy if exists menu_tags_update_admin on public.menu_tags;
create policy menu_tags_update_admin on public.menu_tags
  for update to authenticated
  using (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin())
  with check (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

create table if not exists public.service_calls (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  tag_id uuid not null,
  table_number integer not null check (table_number > 0),
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  foreign key (tag_id, restaurant_id)
    references public.menu_tags(id, restaurant_id) on delete restrict,
  check (
    (status = 'pending' and resolved_at is null and resolved_by is null)
    or (status = 'resolved' and resolved_at is not null)
  )
);

create unique index if not exists service_calls_one_pending_per_table
  on public.service_calls (restaurant_id, table_number)
  where status = 'pending';
create index if not exists service_calls_restaurant_status_created_idx
  on public.service_calls (restaurant_id, status, created_at desc);
create index if not exists service_calls_tag_created_idx
  on public.service_calls (tag_id, created_at desc);

alter table public.service_calls enable row level security;
revoke all on public.service_calls from public, anon, authenticated;
grant select on public.service_calls to authenticated;

drop policy if exists service_calls_select_member on public.service_calls;
create policy service_calls_select_member on public.service_calls
  for select to authenticated
  using (public.is_member(restaurant_id));

alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('feedback_received', 'team_member_joined', 'restaurant_joined', 'test', 'service_call_received'));

-- Include whether the plaque is mapped so the public menu can omit the
-- call action for legacy plaques while still opening the menu itself.
drop function if exists public.resolve_menu_tag(text);
create function public.resolve_menu_tag(p_token text)
returns table (restaurant_slug text, tag_label text, table_number integer)
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
begin
  return query
    update public.menu_tags t
       set last_seen_at = now()
      from public.restaurants r
     where r.id = t.restaurant_id
       and t.public_token = p_token
       and t.is_active
       and r.status = 'active'
       and r.deleted_at is null
    returning r.slug, t.label, t.table_number;
end;
$fn$;
revoke all on function public.resolve_menu_tag(text) from public;
grant execute on function public.resolve_menu_tag(text) to anon, authenticated;

create or replace function public.service_calls_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  begin
    perform realtime.broadcast_changes(
      'service_calls:' || coalesce(new.restaurant_id, old.restaurant_id)::text,
      tg_op,
      tg_op,
      tg_table_name,
      tg_table_schema,
      new,
      old
    );
  exception when others then
    raise warning 'service_calls broadcast failed: %', sqlerrm;
  end;
  return coalesce(new, old);
end;
$fn$;

drop trigger if exists service_calls_broadcast on public.service_calls;
create trigger service_calls_broadcast
  after insert or update on public.service_calls
  for each row execute function public.service_calls_broadcast();

drop policy if exists service_calls_receive_restaurant_topic on realtime.messages;
create policy service_calls_receive_restaurant_topic on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) ~ '^service_calls:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.is_member(substring((select realtime.topic()) from 15)::uuid)
  );

create or replace function public.request_service_call(p_key text, p_token text, p_allow_create boolean default true)
returns table (call_id uuid, table_number integer, status text, created boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
#variable_conflict use_column
declare
  v_tag_id uuid;
  v_restaurant_id uuid;
  v_table_number integer;
  v_call_id uuid;
  v_created boolean := false;
  v_restaurant_name text;
  v_recent_count integer;
begin
  if not public.check_app_server_key(p_key) then
    raise exception 'server_key' using errcode = '42501';
  end if;
  if p_token is null or char_length(p_token) <> 16 or p_token !~ '^[0-9A-HJKMNP-TV-Z]{16}$' then
    raise exception 'service_call_unavailable';
  end if;

  -- Locking the plaque serializes retries and cross-IP requests for the same table.
  select t.id, t.restaurant_id, t.table_number, r.name
    into v_tag_id, v_restaurant_id, v_table_number, v_restaurant_name
    from public.menu_tags t
    join public.restaurants r on r.id = t.restaurant_id
   where t.public_token = p_token
     and t.is_active
     and t.table_number > 0
     and public.is_restaurant_public(t.restaurant_id)
   for update of t;
  if not found then
    raise exception 'service_call_unavailable';
  end if;

  select c.id into v_call_id
    from public.service_calls c
   where c.restaurant_id = v_restaurant_id
     and c.table_number = v_table_number and c.status = 'pending';
  if found then
    return query select v_call_id, v_table_number, 'pending'::text, false;
    return;
  end if;

  if not p_allow_create then
    raise exception 'service_call_ip_limited';
  end if;

  -- A table may call repeatedly after service, but a lost/abused QR cannot
  -- generate an unbounded stream of historical calls and staff notifications.
  select count(*) into v_recent_count
    from public.service_calls c
   where c.tag_id = v_tag_id and c.created_at > now() - interval '1 hour';
  if v_recent_count >= 10 then
    raise exception 'service_call_limited';
  end if;

  insert into public.service_calls (restaurant_id, tag_id, table_number)
  values (v_restaurant_id, v_tag_id, v_table_number)
  on conflict do nothing
  returning id into v_call_id;
  v_created := found;

  if not v_created then
    select c.id into v_call_id
      from public.service_calls c
     where c.restaurant_id = v_restaurant_id
       and c.table_number = v_table_number and c.status = 'pending';
  else
    perform public.dispatch_notification(
      'service_call_received', 'painel', 'restaurant_roles',
      'Chamado da mesa ' || v_table_number::text,
      'Solicitação de atendimento em ' || coalesce(v_restaurant_name, 'seu restaurante') || '.',
      '/restaurantes/' || v_restaurant_id::text || '/chamados?c=' || v_call_id::text,
      p_restaurant_id => v_restaurant_id,
      p_roles => array['admin', 'cashier', 'attendant', 'waiter']::public.member_role[],
      p_data => jsonb_build_object('callId', v_call_id, 'tableNumber', v_table_number, 'restaurantId', v_restaurant_id)
    );
  end if;

  return query select v_call_id, v_table_number, 'pending'::text, v_created;
end;
$fn$;

create or replace function public.resolve_service_call(p_call_id uuid)
returns table (
  call_id uuid,
  restaurant_id uuid,
  tag_id uuid,
  table_number integer,
  status text,
  created_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
#variable_conflict use_column
declare
  v_call public.service_calls%rowtype;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_call from public.service_calls c where c.id = p_call_id for update;
  if not found then
    raise exception 'service_call_not_found';
  end if;
  if not public.is_member(v_call.restaurant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_call.status = 'pending' then
    update public.service_calls c
       set status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
     where c.id = p_call_id
     returning c.* into v_call;
  end if;
  return query select v_call.id, v_call.restaurant_id, v_call.tag_id, v_call.table_number,
                      v_call.status, v_call.created_at, v_call.resolved_at, v_call.resolved_by;
end;
$fn$;

revoke all on function public.service_calls_broadcast() from public, anon, authenticated;
revoke all on function public.request_service_call(text, text, boolean) from public;
revoke all on function public.resolve_service_call(uuid) from public, anon;
grant execute on function public.request_service_call(text, text, boolean) to anon, authenticated;
grant execute on function public.resolve_service_call(uuid) to authenticated;

notify pgrst, 'reload schema';
