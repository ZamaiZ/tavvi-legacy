begin;

alter table public.table_accounts
  add column if not exists account_name text,
  add column if not exists walk_in_number integer;
alter table public.table_accounts alter column table_number drop not null;
alter table public.table_accounts
  drop constraint if exists table_accounts_identity_check,
  drop constraint if exists table_accounts_walk_in_number_check,
  drop constraint if exists table_accounts_account_name_check;
alter table public.table_accounts
  add constraint table_accounts_identity_check
    check ((table_number is not null and walk_in_number is null)
        or (table_number is null and walk_in_number is not null)),
  add constraint table_accounts_walk_in_number_check
    check (walk_in_number is null or walk_in_number > 0),
  add constraint table_accounts_account_name_check
    check (account_name is null or (char_length(account_name) between 1 and 80 and account_name = btrim(account_name)));

create unique index if not exists table_accounts_walk_in_number_key
  on public.table_accounts (restaurant_id, walk_in_number)
  where walk_in_number is not null;

create table if not exists public.restaurant_walk_in_sequences (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  last_number integer not null default 0 check (last_number >= 0)
);
alter table public.restaurant_walk_in_sequences enable row level security;
revoke all on public.restaurant_walk_in_sequences from public, anon, authenticated;

alter table public.orders alter column service_call_id drop not null;

create or replace function public.table_account_snapshot(p_account_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $fn$
  select jsonb_build_object(
    'accountId', a.id,
    'restaurantId', a.restaurant_id,
    'tableNumber', a.table_number,
    'accountName', a.account_name,
    'walkInNumber', a.walk_in_number,
    'status', a.status,
    'tipMode', a.tip_mode,
    'tipPercentBps', a.tip_percent_bps,
    'tipFixedCents', a.tip_fixed_cents,
    'tipAccepted', a.tip_accepted,
    'tipAmountCents', a.tip_amount_cents,
    'openedAt', a.opened_at,
    'closedAt', a.closed_at,
    'subtotalCents', totals.subtotal_cents,
    'tipCents', totals.tip_cents,
    'totalCents', totals.total_cents,
    'paidCents', totals.paid_cents,
    'balanceDueCents', totals.balance_due_cents
  )
    from public.table_accounts a
    cross join lateral public.table_account_totals(a.id) totals
   where a.id = p_account_id;
$fn$;

create or replace function public.record_order_core(
  p_restaurant_id uuid,
  p_call_id uuid,
  p_account_id uuid,
  p_table_number integer,
  p_account_name text,
  p_request_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_restaurant_id uuid;
  v_role public.member_role;
  v_call public.service_calls%rowtype;
  v_settings public.restaurant_checkout_settings%rowtype;
  v_account public.table_accounts%rowtype;
  v_account_id uuid;
  v_order_id uuid;
  v_existing public.orders%rowtype;
  v_fingerprint text;
  v_account_name text := nullif(btrim(p_account_name), '');
  v_walk_in_number integer;
  v_entry jsonb;
  v_item_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_note text;
  v_item_name text;
  v_category_name text;
  v_variant_name text;
  v_item_available boolean;
  v_item_visible boolean;
  v_category_visible boolean;
  v_has_variants boolean;
  v_unit_price integer;
  v_expected_unit_price integer;
  v_line_total bigint;
  v_account_subtotal bigint;
  v_item_count integer := 0;
  v_result jsonb;
  v_recorded_at timestamptz;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_request_id is null or p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'order_input_invalid' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 40 then
    raise exception 'order_input_invalid' using errcode = '22023';
  end if;
  if p_call_id is not null then
    if p_restaurant_id is not null or p_account_id is not null or p_table_number is not null or p_account_name is not null then
      raise exception 'order_input_invalid' using errcode = '22023';
    end if;
    select c.restaurant_id into v_restaurant_id
      from public.service_calls c where c.id = p_call_id;
    if not found then raise exception 'service_call_not_found'; end if;
  else
    if p_restaurant_id is null or (p_account_id is not null and p_table_number is not null)
       or (p_table_number is not null and p_table_number < 1)
       or (v_account_name is not null and char_length(v_account_name) > 80) then
      raise exception 'order_input_invalid' using errcode = '22023';
    end if;
    v_restaurant_id := p_restaurant_id;
  end if;

  select m.role into v_role
    from public.memberships m
   where m.restaurant_id = v_restaurant_id and m.user_id = v_uid
   for share;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_call_id is null and v_role::text not in ('admin', 'cashier', 'attendant', 'waiter') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('finance-operating-day:' || v_restaurant_id::text, 0));
  v_recorded_at := clock_timestamp();

  if p_call_id is not null then
    select c.* into v_call from public.service_calls c where c.id = p_call_id for update;
    if not found or v_call.restaurant_id <> v_restaurant_id then raise exception 'service_call_not_found'; end if;
    v_fingerprint := md5(p_call_id::text || ':' || p_items::text);
  else
    v_fingerprint := md5('cash:' || coalesce(p_account_id::text, '') || ':'
      || coalesce(p_table_number::text, '') || ':' || coalesce(v_account_name, '') || ':' || p_items::text);
  end if;

  select o.* into v_existing from public.orders o
   where o.restaurant_id = v_restaurant_id and o.request_id = p_request_id;
  if found then
    if v_existing.created_by <> v_uid or v_existing.service_call_id is distinct from p_call_id
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'duplicate_request';
    end if;
    return public.table_account_snapshot(v_existing.table_account_id)
      || jsonb_build_object('outcome', 'already_recorded', 'orderId', v_existing.id);
  end if;

  if p_call_id is not null then
    if v_call.status <> 'in_progress' or v_call.assigned_to <> v_uid then raise exception 'call_conflict'; end if;
    if exists (
      select 1 from public.table_accounts closed_account
       where closed_account.restaurant_id = v_restaurant_id
         and closed_account.table_number = v_call.table_number
         and closed_account.status = 'closed'
         and closed_account.closed_at >= v_call.created_at
    ) then raise exception 'account_closed'; end if;
    select s.* into v_settings from public.restaurant_checkout_settings s
     where s.restaurant_id = v_restaurant_id for share;
    if not found then raise exception 'checkout_settings_missing'; end if;
    insert into public.table_accounts (
      restaurant_id, table_number, status, tip_mode, tip_percent_bps,
      tip_fixed_cents, opened_by, opened_at
    ) values (
      v_restaurant_id, v_call.table_number, 'open', v_settings.tip_mode,
      v_settings.tip_percent_bps, v_settings.tip_fixed_cents, v_uid, v_recorded_at
    ) on conflict (restaurant_id, table_number) where status in ('open', 'settling') do nothing
      returning id into v_account_id;
    if v_account_id is null then
      select a.* into v_account from public.table_accounts a
       where a.restaurant_id = v_restaurant_id and a.table_number = v_call.table_number
         and a.status in ('open', 'settling') for update;
      if not found then raise exception 'account_conflict'; end if;
      v_account_id := v_account.id;
    else
      select a.* into v_account from public.table_accounts a where a.id = v_account_id;
    end if;
  elsif p_account_id is not null then
    select a.* into v_account from public.table_accounts a
     where a.id = p_account_id and a.restaurant_id = v_restaurant_id for update;
    if not found then raise exception 'account_not_found'; end if;
    v_account_id := v_account.id;
    if v_account.account_name is null and v_account_name is not null then
      update public.table_accounts set account_name = v_account_name where id = v_account_id;
      v_account.account_name := v_account_name;
    end if;
  elsif p_table_number is not null then
    select a.* into v_account from public.table_accounts a
     where a.restaurant_id = v_restaurant_id and a.table_number = p_table_number
       and a.status in ('open', 'settling') for update;
    if found then
      v_account_id := v_account.id;
    else
      select s.* into v_settings from public.restaurant_checkout_settings s
       where s.restaurant_id = v_restaurant_id for share;
      if not found then raise exception 'checkout_settings_missing'; end if;
      insert into public.table_accounts (
        restaurant_id, table_number, account_name, status, tip_mode, tip_percent_bps,
        tip_fixed_cents, opened_by, opened_at
      ) values (
        v_restaurant_id, p_table_number, v_account_name, 'open', v_settings.tip_mode,
        v_settings.tip_percent_bps, v_settings.tip_fixed_cents, v_uid, v_recorded_at
      ) on conflict (restaurant_id, table_number) where status in ('open', 'settling') do nothing
        returning id into v_account_id;
      if v_account_id is null then
        select a.* into v_account from public.table_accounts a
         where a.restaurant_id = v_restaurant_id and a.table_number = p_table_number
           and a.status in ('open', 'settling') for update;
        if not found then raise exception 'account_conflict'; end if;
        v_account_id := v_account.id;
      else
        select a.* into v_account from public.table_accounts a where a.id = v_account_id;
      end if;
    end if;
    if v_account.account_name is null and v_account_name is not null then
      update public.table_accounts set account_name = v_account_name where id = v_account_id;
      v_account.account_name := v_account_name;
    end if;
  else
    select s.* into v_settings from public.restaurant_checkout_settings s
     where s.restaurant_id = v_restaurant_id for share;
    if not found then raise exception 'checkout_settings_missing'; end if;
    insert into public.restaurant_walk_in_sequences (restaurant_id, last_number)
    values (v_restaurant_id, 1)
    on conflict (restaurant_id) do update
      set last_number = public.restaurant_walk_in_sequences.last_number + 1
    returning last_number into v_walk_in_number;
    insert into public.table_accounts (
      restaurant_id, table_number, account_name, walk_in_number, status,
      tip_mode, tip_percent_bps, tip_fixed_cents, opened_by, opened_at
    ) values (
      v_restaurant_id, null, v_account_name, v_walk_in_number, 'open',
      v_settings.tip_mode, v_settings.tip_percent_bps, v_settings.tip_fixed_cents, v_uid, v_recorded_at
    ) returning id into v_account_id;
    select a.* into v_account from public.table_accounts a where a.id = v_account_id;
  end if;

  if v_account.status = 'settling' then raise exception 'account_settling'; end if;
  if v_account.status <> 'open' then raise exception 'account_closed'; end if;

  insert into public.orders (
    restaurant_id, table_account_id, service_call_id,
    request_id, request_fingerprint, created_by, created_at
  ) values (
    v_restaurant_id, v_account_id, p_call_id,
    p_request_id, v_fingerprint, v_uid, v_recorded_at
  ) on conflict (restaurant_id, request_id) do nothing returning id into v_order_id;
  if v_order_id is null then
    select o.* into v_existing from public.orders o
     where o.restaurant_id = v_restaurant_id and o.request_id = p_request_id;
    if not found or v_existing.created_by <> v_uid or v_existing.service_call_id is distinct from p_call_id
       or v_existing.request_fingerprint <> v_fingerprint then raise exception 'duplicate_request'; end if;
    return public.table_account_snapshot(v_existing.table_account_id)
      || jsonb_build_object('outcome', 'already_recorded', 'orderId', v_existing.id);
  end if;

  for v_entry in select entry.value from jsonb_array_elements(p_items) as entry(value) loop
    if jsonb_typeof(v_entry) is distinct from 'object'
       or v_entry ? 'priceCents' or v_entry ? 'unitPriceCents' or v_entry ? 'totalCents'
       or (v_entry ->> 'itemId') is null
       or (v_entry ->> 'quantity') is null or (v_entry ->> 'quantity') !~ '^[0-9]+$'
       or (v_entry ->> 'expectedUnitPriceCents') is null
       or (v_entry ->> 'expectedUnitPriceCents') !~ '^[0-9]+$' then
      raise exception 'order_input_invalid' using errcode = '22023';
    end if;
    begin
      v_item_id := (v_entry ->> 'itemId')::uuid;
      v_quantity := (v_entry ->> 'quantity')::integer;
      v_expected_unit_price := (v_entry ->> 'expectedUnitPriceCents')::integer;
      v_variant_id := nullif(v_entry ->> 'variantId', '')::uuid;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'order_input_invalid' using errcode = '22023';
    end;
    v_note := nullif(btrim(v_entry ->> 'note'), '');
    if v_quantity not between 1 and 99 or (v_note is not null and char_length(v_note) > 1000) then
      raise exception 'order_input_invalid' using errcode = '22023';
    end if;
    select i.name, c.name, i.is_available, i.is_visible, c.is_visible,
           exists (select 1 from public.menu_item_variants v
                    where v.item_id = i.id and v.restaurant_id = i.restaurant_id)
      into v_item_name, v_category_name, v_item_available, v_item_visible,
           v_category_visible, v_has_variants
      from public.menu_items i
      join public.menu_categories c on c.id = i.category_id and c.restaurant_id = i.restaurant_id
     where i.id = v_item_id and i.restaurant_id = v_restaurant_id;
    if not found or v_item_available is not true or v_item_visible is not true
       or v_category_visible is not true or not exists (
         select 1 from public.menu_item_media media
          where media.item_id = v_item_id and media.restaurant_id = v_restaurant_id
       ) then raise exception 'menu_stale'; end if;
    v_variant_name := null;
    if v_has_variants then
      if v_variant_id is null then raise exception 'menu_variant_required'; end if;
      select v.name, v.price_cents into v_variant_name, v_unit_price
        from public.menu_item_variants v
       where v.id = v_variant_id and v.item_id = v_item_id
         and v.restaurant_id = v_restaurant_id and v.is_available;
      if not found then raise exception 'menu_stale'; end if;
    else
      if v_variant_id is not null then raise exception 'menu_stale'; end if;
      select i.base_price_cents into v_unit_price from public.menu_items i
       where i.id = v_item_id and i.restaurant_id = v_restaurant_id;
    end if;
    if v_expected_unit_price <> v_unit_price then raise exception 'menu_stale'; end if;
    v_line_total := v_unit_price::bigint * v_quantity::bigint;
    if v_line_total > 2147483647 then raise exception 'account_total_too_large'; end if;
    insert into public.order_items (
      restaurant_id, order_id, menu_item_id, menu_variant_id,
      category_name, item_name, variant_name, position, quantity, note,
      unit_price_cents, line_total_cents
    ) values (
      v_restaurant_id, v_order_id, v_item_id, v_variant_id,
      v_category_name, v_item_name, v_variant_name, v_item_count, v_quantity, v_note,
      v_unit_price, v_line_total::integer
    );
    v_item_count := v_item_count + 1;
  end loop;

  select coalesce(sum(i.line_total_cents), 0)::bigint into v_account_subtotal
    from public.orders o
    join public.order_items i on i.order_id = o.id and i.restaurant_id = o.restaurant_id
   where o.table_account_id = v_account_id and i.cancelled_at is null;
  if v_account_subtotal > 2147483647 then raise exception 'account_total_too_large'; end if;
  perform public.table_account_totals(v_account_id);
  insert into public.table_account_events (
    restaurant_id, table_account_id, event_type, actor_id,
    request_id, request_fingerprint, order_id, details
  ) values (
    v_restaurant_id, v_account_id, 'order_recorded', v_uid,
    p_request_id, v_fingerprint, v_order_id,
    case when p_call_id is null
      then jsonb_build_object('itemCount', v_item_count, 'source', 'cash')
      else jsonb_build_object('itemCount', v_item_count, 'callId', p_call_id)
    end
  );
  v_result := public.table_account_snapshot(v_account_id)
    || jsonb_build_object('outcome', 'recorded', 'orderId', v_order_id);
  return v_result;
end;
$fn$;

create or replace function public.record_table_order(p_call_id uuid, p_request_id uuid, p_items jsonb)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $fn$
  select public.record_order_core(null, p_call_id, null, null, null, p_request_id, p_items);
$fn$;

create or replace function public.record_cash_table_order(
  p_restaurant_id uuid,
  p_account_id uuid,
  p_table_number integer,
  p_account_name text,
  p_request_id uuid,
  p_items jsonb
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $fn$
  select public.record_order_core(p_restaurant_id, null, p_account_id, p_table_number, p_account_name, p_request_id, p_items);
$fn$;

revoke all on function public.record_order_core(uuid, uuid, uuid, integer, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.record_table_order(uuid, uuid, jsonb) from public, anon;
revoke all on function public.record_cash_table_order(uuid, uuid, integer, text, uuid, jsonb) from public, anon;
grant execute on function public.record_table_order(uuid, uuid, jsonb) to authenticated;
grant execute on function public.record_cash_table_order(uuid, uuid, integer, text, uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
