begin;

create or replace function public.can_read_guest_service_call_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(exists (
    select 1
      from public.menu_tags t
      join public.restaurants r on r.id = t.restaurant_id
     where p_topic ~ '^service_calls_guest:[0-9A-HJKMNP-TV-Z]{16}$'
       and t.public_token = substring(p_topic from 21)
       and t.is_active
       and t.table_number > 0
       and public.is_restaurant_public(t.restaurant_id)
  ), false);
$fn$;

revoke all on function public.can_read_guest_service_call_topic(text) from public;
grant execute on function public.can_read_guest_service_call_topic(text) to anon, authenticated;

drop policy if exists service_calls_guest_receive_topic on realtime.messages;
create policy service_calls_guest_receive_topic on realtime.messages
  for select to anon
  using (
    realtime.messages.extension = 'broadcast'
    and public.can_read_guest_service_call_topic((select realtime.topic()))
  );

create or replace function public.service_call_guest_status_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_token text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  select t.public_token into v_token
    from public.menu_tags t
   where t.id = new.tag_id and t.restaurant_id = new.restaurant_id and t.is_active;
  if v_token is null then return new; end if;
  begin
    perform realtime.send(
      jsonb_build_object('callId', new.id, 'status', new.status),
      'service_call_status',
      'service_calls_guest:' || v_token,
      true
    );
  exception when others then
    raise warning 'public service call broadcast failed: %', sqlerrm;
  end;
  return new;
end;
$fn$;

drop trigger if exists service_call_guest_status_broadcast on public.service_calls;
create trigger service_call_guest_status_broadcast
  after insert or update of status on public.service_calls
  for each row execute function public.service_call_guest_status_broadcast();

create or replace function public.get_public_service_call_status(p_key text, p_token text)
returns table (call_id uuid, status text)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_restaurant_id uuid;
  v_table_number integer;
begin
  if not public.check_app_server_key(p_key) then
    raise exception 'server_key' using errcode = '42501';
  end if;
  if p_token is null or char_length(p_token) <> 16 or p_token !~ '^[0-9A-HJKMNP-TV-Z]{16}$' then
    raise exception 'service_call_unavailable';
  end if;
  select t.restaurant_id, t.table_number into v_restaurant_id, v_table_number
    from public.menu_tags t
    join public.restaurants r on r.id = t.restaurant_id
   where t.public_token = p_token and t.is_active and t.table_number > 0
     and public.is_restaurant_public(t.restaurant_id);
  if not found then raise exception 'service_call_unavailable'; end if;
  return query
    select c.id, c.status
      from public.service_calls c
     where c.restaurant_id = v_restaurant_id and c.table_number = v_table_number
     order by c.created_at desc, c.id desc
     limit 1;
end;
$fn$;

revoke all on function public.get_public_service_call_status(text, text) from public;
grant execute on function public.get_public_service_call_status(text, text) to anon, authenticated;
revoke all on function public.service_call_guest_status_broadcast() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
