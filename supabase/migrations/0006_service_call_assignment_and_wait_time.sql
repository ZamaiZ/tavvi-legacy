-- Atomic service-call ownership, wait-time tracking, and event history.
-- Apply after 0005_restaurant_menu_presentation.sql.

alter table public.service_calls
  add column if not exists first_claimed_at timestamptz,
  add column if not exists first_claimed_by uuid references public.profiles(id) on delete set null,
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

alter table public.service_calls
  drop constraint if exists service_calls_status_check,
  drop constraint if exists service_calls_check;

alter table public.service_calls
  add constraint service_calls_status_check
    check (status in ('pending', 'in_progress', 'resolved')),
  add constraint service_calls_check
    check (
      (status = 'pending'
        and resolved_at is null
        and resolved_by is null
        and first_claimed_at is null
        and first_claimed_by is null
        and assigned_to is null)
      or (status = 'in_progress'
        and resolved_at is null
        and resolved_by is null
        and first_claimed_at is not null)
      or (status = 'resolved' and resolved_at is not null)
    );

drop index if exists public.service_calls_one_pending_per_table;
create unique index if not exists service_calls_one_active_per_table
  on public.service_calls (restaurant_id, table_number)
  where status in ('pending', 'in_progress');

create table if not exists public.service_call_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.service_calls(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  event_type text not null check (event_type in ('claimed', 'transferred', 'resolved')),
  actor_id uuid references public.profiles(id) on delete set null,
  previous_assignee_id uuid references public.profiles(id) on delete set null,
  next_assignee_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists service_call_events_call_created_idx
  on public.service_call_events (call_id, created_at, id);

alter table public.service_call_events enable row level security;
revoke all on public.service_call_events from public, anon, authenticated;
grant select on public.service_call_events to authenticated;

drop policy if exists service_call_events_select_member on public.service_call_events;
create policy service_call_events_select_member on public.service_call_events
  for select to authenticated
  using (public.is_member(restaurant_id));

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
  v_status text;
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

  -- Locking the tag serializes retries and cross-IP requests for the same table.
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

  select c.id, c.status into v_call_id, v_status
    from public.service_calls c
   where c.restaurant_id = v_restaurant_id
     and c.table_number = v_table_number
     and c.status in ('pending', 'in_progress');
  if found then
    return query select v_call_id, v_table_number, v_status, false;
    return;
  end if;

  if not p_allow_create then
    raise exception 'service_call_ip_limited';
  end if;

  select count(*) into v_recent_count
    from public.service_calls c
   where c.tag_id = v_tag_id and c.created_at > now() - interval '1 hour';
  if v_recent_count >= 10 then
    raise exception 'service_call_limited';
  end if;

  insert into public.service_calls (restaurant_id, tag_id, table_number, created_at)
  values (v_restaurant_id, v_tag_id, v_table_number, clock_timestamp())
  on conflict do nothing
  returning id into v_call_id;
  v_created := found;

  if not v_created then
    select c.id, c.status into v_call_id, v_status
      from public.service_calls c
     where c.restaurant_id = v_restaurant_id
       and c.table_number = v_table_number
       and c.status in ('pending', 'in_progress');
    if not found then
      raise exception 'service_call_race';
    end if;
  else
    v_status := 'pending';
    perform public.dispatch_notification(
      'service_call_received', 'painel', 'restaurant_roles',
      'Chamado da mesa ' || v_table_number::text,
      'Solicitação de atendimento em ' || coalesce(v_restaurant_name, 'seu restaurante') || '.',
      '/restaurantes/' || v_restaurant_id::text || '/service-calls?c=' || v_call_id::text,
      p_restaurant_id => v_restaurant_id,
      p_roles => array['admin', 'cashier', 'attendant', 'waiter']::public.member_role[],
      p_data => jsonb_build_object('callId', v_call_id, 'tableNumber', v_table_number, 'restaurantId', v_restaurant_id)
    );
  end if;

  return query select v_call_id, v_table_number, v_status, v_created;
end;
$fn$;

drop function if exists public.claim_service_call(uuid);
create function public.claim_service_call(p_call_id uuid)
returns table (
  outcome text,
  call_id uuid,
  restaurant_id uuid,
  tag_id uuid,
  table_number integer,
  status text,
  created_at timestamptz,
  first_claimed_at timestamptz,
  first_claimed_by uuid,
  assigned_to uuid,
  resolved_at timestamptz,
  resolved_by uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_call public.service_calls%rowtype;
  v_outcome text;
  v_transition_at timestamptz;
  v_restaurant_id uuid;
  v_membership_id uuid;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Use the same lock order as membership deletion: membership, then call.
  select c.restaurant_id into v_restaurant_id
    from public.service_calls c
   where c.id = p_call_id;
  if not found then
    raise exception 'service_call_not_found';
  end if;
  select m.id into v_membership_id
    from public.memberships m
   where m.restaurant_id = v_restaurant_id
     and m.user_id = auth.uid()
   for share;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.* into v_call
    from public.service_calls c
   where c.id = p_call_id
   for update;
  if not found then
    raise exception 'service_call_not_found';
  end if;

  if v_call.status = 'pending' then
    v_transition_at := clock_timestamp();
    update public.service_calls c
       set status = 'in_progress',
           first_claimed_at = v_transition_at,
           first_claimed_by = auth.uid(),
           assigned_to = auth.uid()
     where c.id = p_call_id
     returning c.* into v_call;
    insert into public.service_call_events (
      call_id, restaurant_id, event_type, actor_id, previous_assignee_id, next_assignee_id, created_at
    ) values (
      v_call.id, v_call.restaurant_id, 'claimed', auth.uid(), null, auth.uid(), v_transition_at
    );
    v_outcome := 'claimed';
  elsif v_call.status = 'in_progress' and v_call.assigned_to = auth.uid() then
    v_outcome := 'already_assigned';
  else
    v_outcome := 'claim_conflict';
  end if;

  return query select v_outcome, v_call.id, v_call.restaurant_id, v_call.tag_id,
                      v_call.table_number, v_call.status, v_call.created_at,
                      v_call.first_claimed_at, v_call.first_claimed_by, v_call.assigned_to,
                      v_call.resolved_at, v_call.resolved_by;
end;
$fn$;

create or replace function public.transfer_service_call(p_call_id uuid, p_assignee_id uuid)
returns table (
  outcome text,
  call_id uuid,
  restaurant_id uuid,
  tag_id uuid,
  table_number integer,
  status text,
  created_at timestamptz,
  first_claimed_at timestamptz,
  first_claimed_by uuid,
  assigned_to uuid,
  resolved_at timestamptz,
  resolved_by uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_call public.service_calls%rowtype;
  v_outcome text;
  v_previous_assignee_id uuid;
  v_transition_at timestamptz;
  v_restaurant_id uuid;
  v_actor_membership_id uuid;
  v_target_membership_id uuid;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.restaurant_id into v_restaurant_id
    from public.service_calls c
   where c.id = p_call_id;
  if not found then
    raise exception 'service_call_not_found';
  end if;
  if p_assignee_id is null then
    raise exception 'service_call_invalid_assignee';
  end if;

  -- Lock both memberships in a stable order before locking the call row.
  perform m.id
    from public.memberships m
   where m.restaurant_id = v_restaurant_id
     and m.user_id in (auth.uid(), p_assignee_id)
   order by m.user_id
   for share;
  select m.id into v_actor_membership_id
    from public.memberships m
   where m.restaurant_id = v_restaurant_id
     and m.user_id = auth.uid()
     and m.role = 'admin';
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select m.id into v_target_membership_id
    from public.memberships m
   where m.restaurant_id = v_restaurant_id
     and m.user_id = p_assignee_id;
  if not found then
    raise exception 'service_call_invalid_assignee';
  end if;

  select c.* into v_call
    from public.service_calls c
   where c.id = p_call_id
   for update;
  if not found then
    raise exception 'service_call_not_found';
  end if;

  if v_call.status <> 'in_progress' then
    v_outcome := 'transfer_conflict';
  else
    if v_call.assigned_to = p_assignee_id then
      v_outcome := 'already_assigned';
    else
      v_previous_assignee_id := v_call.assigned_to;
      v_transition_at := clock_timestamp();
      update public.service_calls c
         set assigned_to = p_assignee_id
       where c.id = p_call_id
       returning c.* into v_call;
      insert into public.service_call_events (
        call_id, restaurant_id, event_type, actor_id,
        previous_assignee_id, next_assignee_id, created_at
      ) values (
        v_call.id, v_call.restaurant_id, 'transferred', auth.uid(),
        v_previous_assignee_id, p_assignee_id, v_transition_at
      );
      v_outcome := 'transferred';
    end if;
  end if;

  return query select v_outcome, v_call.id, v_call.restaurant_id, v_call.tag_id,
                      v_call.table_number, v_call.status, v_call.created_at,
                      v_call.first_claimed_at, v_call.first_claimed_by, v_call.assigned_to,
                      v_call.resolved_at, v_call.resolved_by;
end;
$fn$;

drop function if exists public.resolve_service_call(uuid);
create function public.resolve_service_call(p_call_id uuid)
returns table (
  outcome text,
  call_id uuid,
  restaurant_id uuid,
  tag_id uuid,
  table_number integer,
  status text,
  created_at timestamptz,
  first_claimed_at timestamptz,
  first_claimed_by uuid,
  assigned_to uuid,
  resolved_at timestamptz,
  resolved_by uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_call public.service_calls%rowtype;
  v_outcome text;
  v_transition_at timestamptz;
  v_restaurant_id uuid;
  v_membership_id uuid;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.restaurant_id into v_restaurant_id
    from public.service_calls c
   where c.id = p_call_id;
  if not found then
    raise exception 'service_call_not_found';
  end if;
  select m.id into v_membership_id
    from public.memberships m
   where m.restaurant_id = v_restaurant_id
     and m.user_id = auth.uid()
   for share;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.* into v_call
    from public.service_calls c
   where c.id = p_call_id
   for update;
  if not found then
    raise exception 'service_call_not_found';
  end if;

  if v_call.status = 'in_progress' and v_call.assigned_to = auth.uid() then
    v_transition_at := clock_timestamp();
    update public.service_calls c
       set status = 'resolved', resolved_at = v_transition_at, resolved_by = auth.uid()
     where c.id = p_call_id
     returning c.* into v_call;
    insert into public.service_call_events (
      call_id, restaurant_id, event_type, actor_id, previous_assignee_id, next_assignee_id, created_at
    ) values (
      v_call.id, v_call.restaurant_id, 'resolved', auth.uid(), v_call.assigned_to, null, v_transition_at
    );
    v_outcome := 'resolved';
  elsif v_call.status = 'resolved' and v_call.resolved_by = auth.uid() then
    v_outcome := 'already_resolved';
  else
    v_outcome := 'resolve_conflict';
  end if;

  return query select v_outcome, v_call.id, v_call.restaurant_id, v_call.tag_id,
                      v_call.table_number, v_call.status, v_call.created_at,
                      v_call.first_claimed_at, v_call.first_claimed_by, v_call.assigned_to,
                      v_call.resolved_at, v_call.resolved_by;
end;
$fn$;

revoke all on function public.claim_service_call(uuid) from public, anon;
revoke all on function public.transfer_service_call(uuid, uuid) from public, anon;
revoke all on function public.resolve_service_call(uuid) from public, anon;
revoke all on function public.request_service_call(text, text, boolean) from public;
grant execute on function public.claim_service_call(uuid) to authenticated;
grant execute on function public.transfer_service_call(uuid, uuid) to authenticated;
grant execute on function public.resolve_service_call(uuid) to authenticated;
grant execute on function public.request_service_call(text, text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
