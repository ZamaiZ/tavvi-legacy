begin;

create or replace function public.cash_day_count_matches(p_counts jsonb, p_total_cents integer)
returns boolean
language plpgsql
immutable
set search_path = ''
as $fn$
declare
  v_entry record;
  v_sum bigint := 0;
  v_cents integer;
begin
  if p_total_cents is null or p_total_cents < 0 then return false; end if;
  if p_counts is null then return true; end if;
  if jsonb_typeof(p_counts) <> 'object' then return false; end if;
  for v_entry in select key, value from jsonb_each(p_counts) loop
    if v_entry.key not in ('0.05','0.10','0.25','0.50','1.00','2.00','5.00','10.00','20.00','50.00','100.00','200.00')
       or jsonb_typeof(v_entry.value) <> 'number'
       or (v_entry.value #>> '{}') !~ '^[0-9]{1,9}$' then return false; end if;
    v_cents := (v_entry.key::numeric * 100)::integer;
    v_sum := v_sum + v_cents::bigint * (v_entry.value #>> '{}')::integer;
    if v_sum > 2147483647 then return false; end if;
  end loop;
  return v_sum = p_total_cents;
end;
$fn$;

create table public.restaurant_cash_days (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  opened_by uuid not null references public.profiles(id) on delete restrict,
  opening_cash_cents integer not null check (opening_cash_cents >= 0),
  opening_count jsonb,
  open_request_id uuid not null,
  open_request_fingerprint text not null check (char_length(open_request_fingerprint) = 32),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete restrict,
  expected_cash_cents integer,
  counted_cash_cents integer,
  cash_difference_cents integer,
  closing_count jsonb,
  difference_reason text constraint restaurant_cash_days_difference_reason_length_check
    check (difference_reason is null or char_length(difference_reason) <= 500),
  exception_reason text check (exception_reason is null or char_length(exception_reason) <= 500),
  close_request_id uuid,
  close_request_fingerprint text,
  unique (id, restaurant_id),
  unique (restaurant_id, open_request_id),
  unique (restaurant_id, close_request_id),
  constraint restaurant_cash_days_open_state check (
    (status = 'open' and closed_at is null and closed_by is null and expected_cash_cents is null
      and counted_cash_cents is null and cash_difference_cents is null and closing_count is null
      and difference_reason is null and exception_reason is null and close_request_id is null
      and close_request_fingerprint is null)
    or (status = 'closed' and closed_at is not null and closed_by is not null
      and expected_cash_cents >= 0 and counted_cash_cents >= 0
      and cash_difference_cents = counted_cash_cents - expected_cash_cents
      and close_request_id is not null and char_length(close_request_fingerprint) = 32)
  ),
  constraint restaurant_cash_days_open_count_check check (public.cash_day_count_matches(opening_count, opening_cash_cents)),
  constraint restaurant_cash_days_close_count_check check (
    closing_count is null or public.cash_day_count_matches(closing_count, counted_cash_cents)
  ),
  constraint restaurant_cash_days_difference_reason_check check (
    cash_difference_cents is null or cash_difference_cents = 0
    or char_length(btrim(coalesce(difference_reason, ''))) >= 3
  )
);

create unique index restaurant_cash_days_one_open_per_restaurant_uq
  on public.restaurant_cash_days (restaurant_id) where status = 'open';
create index restaurant_cash_days_history_idx
  on public.restaurant_cash_days (restaurant_id, opened_at desc, id desc);

create table public.cash_day_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  cash_day_id uuid not null,
  movement_type text not null check (movement_type in ('replenishment', 'withdrawal')),
  amount_cents integer not null check (amount_cents > 0),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  request_id uuid not null,
  request_fingerprint text not null check (char_length(request_fingerprint) = 32),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (restaurant_id, request_id),
  foreign key (cash_day_id, restaurant_id)
    references public.restaurant_cash_days(id, restaurant_id) on delete restrict
);
create index cash_day_movements_day_created_idx
  on public.cash_day_movements (cash_day_id, created_at, id);

alter table public.table_accounts drop constraint table_accounts_state_check;
alter table public.table_accounts add column pending_cash_day_id uuid;
alter table public.table_accounts drop constraint table_accounts_status_check;
alter table public.table_accounts add constraint table_accounts_status_check
  check (status in ('open', 'settling', 'pending', 'closed'));
alter table public.table_accounts add constraint table_accounts_pending_day_fkey
  foreign key (pending_cash_day_id, restaurant_id)
  references public.restaurant_cash_days(id, restaurant_id) on delete restrict;
alter table public.table_accounts add constraint table_accounts_state_check check (
  (status = 'open' and tip_accepted is null and tip_decided_at is null and tip_amount_cents = 0
    and closed_at is null and closed_by is null and pending_cash_day_id is null)
  or (status = 'settling' and tip_accepted is not null and tip_decided_at is not null
    and closed_at is null and closed_by is null and pending_cash_day_id is null)
  or (status = 'pending' and tip_accepted is not null and tip_decided_at is not null
    and closed_at is null and closed_by is null and pending_cash_day_id is not null)
  or (status = 'closed' and tip_accepted is not null and tip_decided_at is not null
    and closed_at is not null and closed_by is not null and pending_cash_day_id is null)
);
create index table_accounts_pending_restaurant_idx
  on public.table_accounts (restaurant_id, opened_at desc) where status = 'pending';

alter table public.table_account_payments add column cash_day_id uuid;
alter table public.table_account_payments add constraint table_account_payments_cash_day_fkey
  foreign key (cash_day_id, restaurant_id)
  references public.restaurant_cash_days(id, restaurant_id) on delete restrict;
create index table_account_payments_cash_day_idx
  on public.table_account_payments (cash_day_id, created_at, id) where cash_day_id is not null;

alter table public.table_account_events drop constraint table_account_events_event_type_check;
alter table public.table_account_events add constraint table_account_events_event_type_check
  check (event_type in ('order_recorded', 'payment_received', 'payment_refunded', 'tip_decided',
    'settlement_reopened', 'order_item_cancelled', 'account_closed', 'account_reopened_by_refund',
    'account_carried_to_pending'));

create or replace function public.prevent_cash_day_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  raise exception 'financial_ledger_immutable' using errcode = '42501';
end;
$fn$;
create trigger cash_day_movements_immutable before update or delete on public.cash_day_movements
  for each row execute function public.prevent_cash_day_ledger_mutation();

create or replace function public.prevent_closed_cash_day_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if old.status = 'closed' then
    raise exception 'cash_day_closed' using errcode = '42501';
  end if;
  return new;
end;
$fn$;
create trigger restaurant_cash_days_closed_immutable before update or delete on public.restaurant_cash_days
  for each row execute function public.prevent_closed_cash_day_mutation();

alter table public.restaurant_cash_days enable row level security;
alter table public.cash_day_movements enable row level security;
revoke all on public.restaurant_cash_days, public.cash_day_movements from public, anon, authenticated;
grant select on public.restaurant_cash_days, public.cash_day_movements to authenticated;
create policy restaurant_cash_days_select_cash_roles on public.restaurant_cash_days
  for select to authenticated using (public.my_role(restaurant_id) in ('admin', 'cashier'));
create policy cash_day_movements_select_cash_roles on public.cash_day_movements
  for select to authenticated using (public.my_role(restaurant_id) in ('admin', 'cashier'));

-- Serialize account creation with day close so the close cannot miss a new account row.
create or replace function public.record_table_order(
  p_call_id uuid,
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
  v_membership_id uuid;
  v_settings public.restaurant_checkout_settings%rowtype;
  v_account public.table_accounts%rowtype;
  v_account_id uuid;
  v_order_id uuid;
  v_existing public.orders%rowtype;
  v_fingerprint text;
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
  if p_call_id is null or p_request_id is null then raise exception 'order_input_invalid' using errcode = '22023'; end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'order_input_invalid' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 40 then
    raise exception 'order_input_invalid' using errcode = '22023';
  end if;

  select c.restaurant_id into v_restaurant_id
    from public.service_calls c where c.id = p_call_id;
  if not found then raise exception 'service_call_not_found'; end if;

  select m.id, m.role into v_membership_id, v_role
    from public.memberships m
   where m.restaurant_id = v_restaurant_id and m.user_id = v_uid
   for share;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('finance-operating-day:' || v_restaurant_id::text, 0));
  v_recorded_at := clock_timestamp();

  select c.* into v_call
    from public.service_calls c
   where c.id = p_call_id
   for update;
  if not found or v_call.restaurant_id <> v_restaurant_id then
    raise exception 'service_call_not_found';
  end if;

  v_fingerprint := md5(p_call_id::text || ':' || p_items::text);
  select o.* into v_existing
    from public.orders o
   where o.restaurant_id = v_restaurant_id and o.request_id = p_request_id;
  if found then
    if v_existing.created_by <> v_uid or v_existing.service_call_id <> p_call_id
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'duplicate_request';
    end if;
    return public.table_account_snapshot(v_existing.table_account_id)
      || jsonb_build_object('outcome', 'already_recorded', 'orderId', v_existing.id);
  end if;

  if v_call.status <> 'in_progress' or v_call.assigned_to <> v_uid then
    raise exception 'call_conflict';
  end if;

  -- A finalized visit cannot be reopened by an older, still active call.
  if exists (
    select 1 from public.table_accounts closed_account
     where closed_account.restaurant_id = v_restaurant_id
       and closed_account.table_number = v_call.table_number
       and closed_account.status = 'closed'
       and closed_account.closed_at >= v_call.created_at
  ) then
    raise exception 'account_closed';
  end if;

  select s.* into v_settings
    from public.restaurant_checkout_settings s
   where s.restaurant_id = v_restaurant_id
   for share;
  if not found then raise exception 'checkout_settings_missing'; end if;

  insert into public.table_accounts (
    restaurant_id, table_number, status, tip_mode, tip_percent_bps,
    tip_fixed_cents, opened_by, opened_at
  ) values (
    v_restaurant_id, v_call.table_number, 'open', v_settings.tip_mode,
    v_settings.tip_percent_bps, v_settings.tip_fixed_cents, v_uid, v_recorded_at
  )
  on conflict (restaurant_id, table_number) where status in ('open', 'settling') do nothing
  returning id into v_account_id;

  if v_account_id is null then
    select a.* into v_account
      from public.table_accounts a
     where a.restaurant_id = v_restaurant_id
       and a.table_number = v_call.table_number
       and a.status in ('open', 'settling')
     for update;
    if not found then raise exception 'account_conflict'; end if;
    v_account_id := v_account.id;
  else
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
  )
  on conflict (restaurant_id, request_id) do nothing
  returning id into v_order_id;

  if v_order_id is null then
    select o.* into v_existing
      from public.orders o
     where o.restaurant_id = v_restaurant_id and o.request_id = p_request_id;
    if not found or v_existing.created_by <> v_uid or v_existing.service_call_id <> p_call_id
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'duplicate_request';
    end if;
    return public.table_account_snapshot(v_existing.table_account_id)
      || jsonb_build_object('outcome', 'already_recorded', 'orderId', v_existing.id);
  end if;

  for v_entry in select entry.value from jsonb_array_elements(p_items) as entry(value) loop
    if jsonb_typeof(v_entry) is distinct from 'object'
       or v_entry ? 'priceCents' or v_entry ? 'unitPriceCents' or v_entry ? 'totalCents'
       or (v_entry ->> 'itemId') is null
       or (v_entry ->> 'quantity') is null
       or (v_entry ->> 'quantity') !~ '^[0-9]+$'
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
           exists (
             select 1 from public.menu_item_variants v
              where v.item_id = i.id and v.restaurant_id = i.restaurant_id
           )
      into v_item_name, v_category_name, v_item_available, v_item_visible,
           v_category_visible, v_has_variants
      from public.menu_items i
      join public.menu_categories c
        on c.id = i.category_id and c.restaurant_id = i.restaurant_id
     where i.id = v_item_id and i.restaurant_id = v_restaurant_id;
    if not found or v_item_available is not true or v_item_visible is not true
       or v_category_visible is not true or not exists (
         select 1 from public.menu_item_media media
          where media.item_id = v_item_id and media.restaurant_id = v_restaurant_id
       ) then
      raise exception 'menu_stale';
    end if;

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
      select i.base_price_cents into v_unit_price
        from public.menu_items i
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
    request_id, request_fingerprint, order_id,
    details
  ) values (
    v_restaurant_id, v_account_id, 'order_recorded', v_uid,
    p_request_id, v_fingerprint, v_order_id,
    jsonb_build_object('itemCount', v_item_count, 'callId', p_call_id)
  );

  v_result := public.table_account_snapshot(v_account_id)
    || jsonb_build_object('outcome', 'recorded', 'orderId', v_order_id);
  return v_result;
end;
$fn$;

create or replace function public.record_table_payment(
  p_account_id uuid, p_method_id uuid, p_request_id uuid,
  p_amount_applied_cents integer, p_cash_received_cents integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_account public.table_accounts%rowtype;
  v_day public.restaurant_cash_days%rowtype;
  v_role public.member_role;
  v_method_name text;
  v_method_type text;
  v_payment_id uuid;
  v_existing public.table_account_payments%rowtype;
  v_fingerprint text;
  v_totals record;
  v_change integer := 0;
  v_cash_expected bigint;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_account_id is null or p_method_id is null or p_request_id is null
     or p_amount_applied_cents is null or p_amount_applied_cents <= 0 then
    raise exception 'payment_input_invalid' using errcode = '22023';
  end if;
  select a.* into v_account from public.table_accounts a where a.id = p_account_id;
  if not found then raise exception 'account_not_found'; end if;
  select m.role into v_role from public.memberships m
   where m.restaurant_id = v_account.restaurant_id and m.user_id = v_uid for share;
  if v_role is null then raise exception 'forbidden' using errcode = '42501'; end if;
  v_fingerprint := md5(concat_ws(':', p_account_id::text, p_method_id::text,
    p_amount_applied_cents::text, coalesce(p_cash_received_cents::text, 'null')));
  select p.* into v_existing from public.table_account_payments p
   where p.restaurant_id = v_account.restaurant_id and p.request_id = p_request_id;
  if found then
    if v_existing.table_account_id <> p_account_id or v_existing.created_by <> v_uid
       or v_existing.entry_type <> 'received' or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'duplicate_request';
    end if;
    return public.table_account_snapshot(p_account_id)
      || jsonb_build_object('outcome', 'already_recorded', 'paymentId', v_existing.id);
  end if;

  select d.* into v_day from public.restaurant_cash_days d
   where d.restaurant_id = v_account.restaurant_id and d.status = 'open' for update;
  if not found then raise exception 'cash_day_not_open'; end if;
  select a.* into v_account from public.table_accounts a where a.id = p_account_id for update;
  if not found then raise exception 'account_not_found'; end if;
  select p.* into v_existing from public.table_account_payments p
   where p.restaurant_id = v_account.restaurant_id and p.request_id = p_request_id;
  if found then
    if v_existing.table_account_id <> p_account_id or v_existing.created_by <> v_uid
       or v_existing.entry_type <> 'received' or v_existing.request_fingerprint <> v_fingerprint then raise exception 'duplicate_request'; end if;
    return public.table_account_snapshot(p_account_id)
      || jsonb_build_object('outcome', 'already_recorded', 'paymentId', v_existing.id);
  end if;
  if v_account.status not in ('open', 'settling', 'pending') then raise exception 'account_closed'; end if;
  select m.name, m.method_type into v_method_name, v_method_type
    from public.restaurant_payment_methods m
   where m.id = p_method_id and m.restaurant_id = v_account.restaurant_id and m.is_active;
  if not found then raise exception 'payment_method_unavailable'; end if;
  if v_method_type = 'cash' then
    if p_cash_received_cents is null or p_cash_received_cents < p_amount_applied_cents then
      raise exception 'cash_amount_invalid' using errcode = '22023';
    end if;
    if p_cash_received_cents > 2147483647 then raise exception 'payment_input_invalid' using errcode = '22023'; end if;
    v_change := p_cash_received_cents - p_amount_applied_cents;
    select v_day.opening_cash_cents
        + coalesce(sum(case when p.entry_type = 'received' then p.amount_applied_cents else -p.amount_applied_cents end), 0)
        + coalesce((select sum(case when x.movement_type = 'replenishment' then x.amount_cents else -x.amount_cents end)
            from public.cash_day_movements x where x.cash_day_id = v_day.id), 0)
      into v_cash_expected
      from public.table_account_payments p
      join public.restaurant_payment_methods pm on pm.id = p.method_id and pm.restaurant_id = p.restaurant_id
     where p.cash_day_id = v_day.id and pm.method_type = 'cash';
    if v_cash_expected + p_amount_applied_cents > 2147483647 then raise exception 'cash_day_expected_cash_invalid'; end if;
  elsif p_cash_received_cents is not null then
    raise exception 'cash_amount_invalid' using errcode = '22023';
  end if;
  select * into v_totals from public.table_account_totals(p_account_id);
  if v_totals.balance_due_cents <= 0 then raise exception 'account_no_balance_due'; end if;
  if p_amount_applied_cents > v_totals.balance_due_cents then raise exception 'payment_exceeds_balance'; end if;

  insert into public.table_account_payments (
    restaurant_id, table_account_id, method_id, method_name, entry_type,
    amount_applied_cents, cash_received_cents, cash_change_cents,
    request_id, request_fingerprint, created_by, cash_day_id
  ) values (
    v_account.restaurant_id, p_account_id, p_method_id, v_method_name, 'received',
    p_amount_applied_cents, p_cash_received_cents, v_change,
    p_request_id, v_fingerprint, v_uid, v_day.id
  ) on conflict (restaurant_id, request_id) do nothing returning id into v_payment_id;
  if v_payment_id is null then
    select p.* into v_existing from public.table_account_payments p
     where p.restaurant_id = v_account.restaurant_id and p.request_id = p_request_id;
    if not found or v_existing.table_account_id <> p_account_id or v_existing.created_by <> v_uid
       or v_existing.request_fingerprint <> v_fingerprint then raise exception 'duplicate_request'; end if;
    return public.table_account_snapshot(p_account_id)
      || jsonb_build_object('outcome', 'already_recorded', 'paymentId', v_existing.id);
  end if;
  insert into public.table_account_events (
    restaurant_id, table_account_id, event_type, actor_id,
    request_id, request_fingerprint, payment_id, details
  ) values (
    v_account.restaurant_id, p_account_id, 'payment_received', v_uid,
    p_request_id, v_fingerprint, v_payment_id,
    jsonb_build_object('method', v_method_name, 'appliedCents', p_amount_applied_cents,
      'cashReceivedCents', p_cash_received_cents, 'changeCents', v_change, 'cashDayId', v_day.id)
  );
  select * into v_totals from public.table_account_totals(p_account_id);
  if v_account.status in ('settling', 'pending') and v_totals.balance_due_cents = 0 then
    update public.table_accounts set status = 'closed', closed_at = now(), closed_by = v_uid,
      pending_cash_day_id = null where id = p_account_id;
    insert into public.table_account_events (
      restaurant_id, table_account_id, event_type, actor_id, payment_id, details
    ) values (
      v_account.restaurant_id, p_account_id, 'account_closed', v_uid, v_payment_id,
      jsonb_build_object('closedByPayment', true, 'cashDayId', v_day.id)
    );
  end if;
  return public.table_account_snapshot(p_account_id)
    || jsonb_build_object('outcome', 'recorded', 'paymentId', v_payment_id, 'changeCents', v_change);
end;
$fn$;

drop function public.reverse_table_account_payment(uuid, integer, text, uuid);
create function public.reverse_table_account_payment(
  p_payment_id uuid, p_amount_cents integer, p_refund_method_id uuid, p_reason text, p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_original public.table_account_payments%rowtype;
  v_account public.table_accounts%rowtype;
  v_day public.restaurant_cash_days%rowtype;
  v_role public.member_role;
  v_reason text := nullif(btrim(p_reason), '');
  v_existing public.table_account_payments%rowtype;
  v_fingerprint text;
  v_refunded bigint;
  v_refund_id uuid;
  v_refund_method_name text;
  v_refund_method_type text;
  v_expected_cash bigint;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_payment_id is null or p_refund_method_id is null or p_request_id is null
     or p_amount_cents is null or p_amount_cents <= 0 or v_reason is null or char_length(v_reason) > 500 then
    raise exception 'refund_input_invalid' using errcode = '22023';
  end if;
  select p.* into v_original from public.table_account_payments p where p.id = p_payment_id;
  if not found or v_original.entry_type <> 'received' then raise exception 'payment_not_reversible'; end if;
  select a.* into v_account from public.table_accounts a where a.id = v_original.table_account_id;
  select m.role into v_role from public.memberships m
   where m.restaurant_id = v_account.restaurant_id and m.user_id = v_uid for share;
  if v_role is null then raise exception 'forbidden' using errcode = '42501'; end if;
  v_fingerprint := md5(concat_ws(':', p_payment_id::text, p_amount_cents::text, p_refund_method_id::text, v_reason));
  select p.* into v_existing from public.table_account_payments p
   where p.restaurant_id = v_account.restaurant_id and p.request_id = p_request_id;
  if found then
    if v_existing.table_account_id <> v_account.id or v_existing.created_by <> v_uid
       or v_existing.entry_type <> 'refunded' or v_existing.reverses_payment_id <> p_payment_id
       or v_existing.amount_applied_cents <> p_amount_cents or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'duplicate_request';
    end if;
    return public.table_account_snapshot(v_account.id)
      || jsonb_build_object('outcome', 'already_recorded', 'paymentId', v_existing.id);
  end if;

  select d.* into v_day from public.restaurant_cash_days d
   where d.restaurant_id = v_account.restaurant_id and d.status = 'open' for update;
  if not found then raise exception 'cash_day_not_open'; end if;
  select a.* into v_account from public.table_accounts a where a.id = v_account.id for update;
  select p.* into v_existing from public.table_account_payments p
   where p.restaurant_id = v_account.restaurant_id and p.request_id = p_request_id;
  if found then
    if v_existing.table_account_id <> v_account.id or v_existing.created_by <> v_uid
       or v_existing.entry_type <> 'refunded' or v_existing.reverses_payment_id <> p_payment_id
       or v_existing.amount_applied_cents <> p_amount_cents or v_existing.request_fingerprint <> v_fingerprint then raise exception 'duplicate_request'; end if;
    return public.table_account_snapshot(v_account.id)
      || jsonb_build_object('outcome', 'already_recorded', 'paymentId', v_existing.id);
  end if;
  select p.* into v_original from public.table_account_payments p where p.id = p_payment_id;
  select pm.name, pm.method_type into v_refund_method_name, v_refund_method_type
    from public.restaurant_payment_methods pm
   where pm.id = p_refund_method_id and pm.restaurant_id = v_account.restaurant_id
     and (pm.id = v_original.method_id or pm.is_active);
  if not found then raise exception 'refund_method_unavailable'; end if;
  select coalesce(sum(p.amount_applied_cents), 0)::bigint into v_refunded
    from public.table_account_payments p where p.reverses_payment_id = p_payment_id;
  if v_refunded + p_amount_cents > v_original.amount_applied_cents then raise exception 'refund_exceeds_payment'; end if;
  if v_refund_method_type = 'cash' then
    select v_day.opening_cash_cents
        + coalesce(sum(case when p.entry_type = 'received' then p.amount_applied_cents else -p.amount_applied_cents end), 0)
        + coalesce((select sum(case when x.movement_type = 'replenishment' then x.amount_cents else -x.amount_cents end)
            from public.cash_day_movements x where x.cash_day_id = v_day.id), 0)
      into v_expected_cash
      from public.table_account_payments p
      join public.restaurant_payment_methods pm on pm.id = p.method_id and pm.restaurant_id = p.restaurant_id
     where p.cash_day_id = v_day.id and pm.method_type = 'cash';
    if p_amount_cents > v_expected_cash then raise exception 'cash_day_insufficient_cash'; end if;
  end if;

  insert into public.table_account_payments (
    restaurant_id, table_account_id, method_id, method_name, entry_type,
    amount_applied_cents, cash_received_cents, cash_change_cents, reverses_payment_id,
    reason, request_id, request_fingerprint, created_by, cash_day_id
  ) values (
    v_account.restaurant_id, v_account.id, p_refund_method_id, v_refund_method_name, 'refunded',
    p_amount_cents, null, 0, p_payment_id, v_reason, p_request_id, v_fingerprint, v_uid, v_day.id
  ) on conflict (restaurant_id, request_id) do nothing returning id into v_refund_id;
  if v_refund_id is null then raise exception 'duplicate_request'; end if;
  if v_account.status = 'closed' then
    update public.table_accounts set status = 'pending', closed_at = null, closed_by = null,
      pending_cash_day_id = v_day.id where id = v_account.id;
    insert into public.table_account_events (
      restaurant_id, table_account_id, event_type, actor_id, request_id,
      request_fingerprint, payment_id, reason, details
    ) values (
      v_account.restaurant_id, v_account.id, 'account_reopened_by_refund', v_uid,
      p_request_id, v_fingerprint, v_refund_id, v_reason,
      jsonb_build_object('reversesPaymentId', p_payment_id, 'amountCents', p_amount_cents,
        'cashDayId', v_day.id, 'reopenedAsPending', true)
    );
  end if;
  insert into public.table_account_events (
    restaurant_id, table_account_id, event_type, actor_id,
    request_id, request_fingerprint, payment_id, reason, details
  ) values (
    v_account.restaurant_id, v_account.id, 'payment_refunded', v_uid,
    p_request_id, v_fingerprint, v_refund_id, v_reason,
    jsonb_build_object('reversesPaymentId', p_payment_id, 'amountCents', p_amount_cents,
      'refundMethod', v_refund_method_name, 'cashDayId', v_day.id)
  );
  return public.table_account_snapshot(v_account.id)
    || jsonb_build_object('outcome', 'recorded', 'paymentId', v_refund_id);
end;
$fn$;

create or replace function public.open_restaurant_cash_day(
  p_restaurant_id uuid, p_opening_cash_cents integer, p_opening_count jsonb, p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_role public.member_role;
  v_existing public.restaurant_cash_days%rowtype;
  v_day public.restaurant_cash_days%rowtype;
  v_fingerprint text;
  v_opened_at timestamptz;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_restaurant_id is null or p_request_id is null or p_opening_cash_cents is null
     or p_opening_cash_cents < 0 or not public.cash_day_count_matches(p_opening_count, p_opening_cash_cents) then
    raise exception 'cash_day_open_input_invalid' using errcode = '22023';
  end if;
  select m.role into v_role from public.memberships m
   where m.restaurant_id = p_restaurant_id and m.user_id = v_uid for share;
  if v_role is null or v_role not in ('admin', 'cashier') then raise exception 'forbidden' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('finance-operating-day:' || p_restaurant_id::text, 0));
  v_fingerprint := md5(concat_ws(':', p_restaurant_id::text, p_opening_cash_cents::text, coalesce(p_opening_count::text, 'null')));
  select d.* into v_existing from public.restaurant_cash_days d
   where d.restaurant_id = p_restaurant_id and d.open_request_id = p_request_id;
  if found then
    if v_existing.opened_by <> v_uid or v_existing.open_request_fingerprint <> v_fingerprint then raise exception 'duplicate_request'; end if;
    return to_jsonb(v_existing) || jsonb_build_object('outcome', 'already_recorded');
  end if;
  perform 1 from public.restaurants r where r.id = p_restaurant_id for update;
  if not found then raise exception 'restaurant_not_found'; end if;
  select d.* into v_existing from public.restaurant_cash_days d
   where d.restaurant_id = p_restaurant_id and d.open_request_id = p_request_id;
  if found then
    if v_existing.opened_by <> v_uid or v_existing.open_request_fingerprint <> v_fingerprint then raise exception 'duplicate_request'; end if;
    return to_jsonb(v_existing) || jsonb_build_object('outcome', 'already_recorded');
  end if;
  if exists (select 1 from public.restaurant_cash_days d where d.restaurant_id = p_restaurant_id and d.status = 'open') then
    raise exception 'cash_day_already_open';
  end if;
  v_opened_at := clock_timestamp();
  insert into public.restaurant_cash_days (
    restaurant_id, opened_by, opening_cash_cents, opening_count, open_request_id,
    open_request_fingerprint, opened_at
  ) values (
    p_restaurant_id, v_uid, p_opening_cash_cents, p_opening_count, p_request_id, v_fingerprint, v_opened_at
  ) returning * into v_day;
  return to_jsonb(v_day) || jsonb_build_object('outcome', 'recorded');
end;
$fn$;

create or replace function public.record_cash_day_movement(
  p_cash_day_id uuid, p_movement_type text, p_amount_cents integer, p_reason text, p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_day public.restaurant_cash_days%rowtype;
  v_existing public.cash_day_movements%rowtype;
  v_role public.member_role;
  v_fingerprint text;
  v_movement public.cash_day_movements%rowtype;
  v_expected bigint;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_cash_day_id is null or p_request_id is null or p_movement_type is null
     or p_movement_type not in ('replenishment', 'withdrawal')
     or p_amount_cents is null or p_amount_cents <= 0 or nullif(btrim(p_reason), '') is null
     or char_length(btrim(p_reason)) > 500 then
    raise exception 'cash_day_movement_input_invalid' using errcode = '22023';
  end if;
  select d.* into v_day from public.restaurant_cash_days d where d.id = p_cash_day_id for update;
  if not found then raise exception 'cash_day_not_found'; end if;
  select m.role into v_role from public.memberships m
   where m.restaurant_id = v_day.restaurant_id and m.user_id = v_uid for share;
  if v_role is null or v_role not in ('admin', 'cashier') then raise exception 'forbidden' using errcode = '42501'; end if;
  v_fingerprint := md5(concat_ws(':', p_cash_day_id::text, p_movement_type, p_amount_cents::text, btrim(p_reason)));
  select m.* into v_existing from public.cash_day_movements m
   where m.restaurant_id = v_day.restaurant_id and m.request_id = p_request_id;
  if found then
    if v_existing.created_by <> v_uid or v_existing.request_fingerprint <> v_fingerprint then raise exception 'duplicate_request'; end if;
    return to_jsonb(v_existing) || jsonb_build_object('outcome', 'already_recorded');
  end if;
  if v_day.status <> 'open' then raise exception 'cash_day_closed'; end if;
  select v_day.opening_cash_cents
      + coalesce(sum(case when p.entry_type = 'received' then p.amount_applied_cents else -p.amount_applied_cents end), 0)
      + coalesce((select sum(case when x.movement_type = 'replenishment' then x.amount_cents else -x.amount_cents end)
          from public.cash_day_movements x where x.cash_day_id = v_day.id), 0)
      into v_expected
      from public.table_account_payments p
      join public.restaurant_payment_methods pm on pm.id = p.method_id and pm.restaurant_id = p.restaurant_id
     where p.cash_day_id = v_day.id and pm.method_type = 'cash';
  if p_movement_type = 'withdrawal' and p_amount_cents > v_expected then
    raise exception 'cash_day_insufficient_cash';
  elsif p_movement_type = 'replenishment' and v_expected + p_amount_cents > 2147483647 then
    raise exception 'cash_day_expected_cash_invalid';
  end if;
  insert into public.cash_day_movements (
    restaurant_id, cash_day_id, movement_type, amount_cents, reason, request_id, request_fingerprint, created_by
  ) values (
    v_day.restaurant_id, v_day.id, p_movement_type, p_amount_cents, btrim(p_reason), p_request_id, v_fingerprint, v_uid
  ) returning * into v_movement;
  return to_jsonb(v_movement) || jsonb_build_object('outcome', 'recorded');
end;
$fn$;

create or replace function public.close_restaurant_cash_day(
  p_cash_day_id uuid, p_counted_cash_cents integer, p_closing_count jsonb,
  p_difference_reason text, p_exception_reason text, p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_day public.restaurant_cash_days%rowtype;
  v_existing public.restaurant_cash_days%rowtype;
  v_restaurant_id uuid;
  v_role public.member_role;
  v_fingerprint text;
  v_expected bigint;
  v_difference bigint;
  v_open_count integer;
  v_account public.table_accounts%rowtype;
  v_call public.service_calls%rowtype;
  v_transition_at timestamptz;
  v_totals record;
  v_tip_accepted boolean;
  v_tip_amount integer;
  v_tip_decided_at timestamptz;
  v_closed_at timestamptz;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_cash_day_id is null or p_request_id is null or p_counted_cash_cents is null
     or p_counted_cash_cents < 0 or not public.cash_day_count_matches(p_closing_count, p_counted_cash_cents)
     or (p_difference_reason is not null and char_length(btrim(p_difference_reason)) > 500)
     or (p_exception_reason is not null and char_length(btrim(p_exception_reason)) > 500) then
    raise exception 'cash_day_close_input_invalid' using errcode = '22023';
  end if;
  -- Use the same lock as account creation before locking the day and its accounts.
  select d.restaurant_id into v_restaurant_id
    from public.restaurant_cash_days d where d.id = p_cash_day_id;
  if not found then raise exception 'cash_day_not_found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('finance-operating-day:' || v_restaurant_id::text, 0));
  select d.* into v_day from public.restaurant_cash_days d where d.id = p_cash_day_id for update;
  if not found then raise exception 'cash_day_not_found'; end if;
  select m.role into v_role from public.memberships m
   where m.restaurant_id = v_day.restaurant_id and m.user_id = v_uid for share;
  if v_role is null or v_role not in ('admin', 'cashier') then raise exception 'forbidden' using errcode = '42501'; end if;
  v_fingerprint := md5(concat_ws(':', p_cash_day_id::text, p_counted_cash_cents::text,
    coalesce(p_closing_count::text, 'null'), coalesce(btrim(p_difference_reason), ''), coalesce(btrim(p_exception_reason), '')));
  select d.* into v_existing from public.restaurant_cash_days d
   where d.restaurant_id = v_day.restaurant_id and d.close_request_id = p_request_id;
  if found then
    if v_existing.closed_by <> v_uid or v_existing.close_request_fingerprint <> v_fingerprint then raise exception 'duplicate_request'; end if;
    return to_jsonb(v_existing) || jsonb_build_object('outcome', 'already_recorded');
  end if;
  if v_day.status <> 'open' then raise exception 'cash_day_closed'; end if;
  if coalesce(btrim(p_exception_reason), '') <> '' and v_role <> 'admin' then
    raise exception 'cash_day_exception_admin_only' using errcode = '42501';
  end if;
  if coalesce(btrim(p_exception_reason), '') <> '' and char_length(btrim(p_exception_reason)) < 3 then
    raise exception 'cash_day_exception_reason_required' using errcode = '22023';
  end if;

  perform a.id from public.table_accounts a
   where a.restaurant_id = v_day.restaurant_id and a.status in ('open', 'settling')
   order by a.id for update;
  select count(*)::integer into v_open_count from public.table_accounts a
   where a.restaurant_id = v_day.restaurant_id and a.status in ('open', 'settling');
  if v_open_count > 0 and coalesce(btrim(p_exception_reason), '') = '' then
    raise exception 'cash_day_open_accounts:%', v_open_count;
  end if;

  select v_day.opening_cash_cents
      + coalesce(sum(case when p.entry_type = 'received' then p.amount_applied_cents else -p.amount_applied_cents end), 0)
      + coalesce((select sum(case when x.movement_type = 'replenishment' then x.amount_cents else -x.amount_cents end)
          from public.cash_day_movements x where x.cash_day_id = v_day.id), 0)
    into v_expected
    from public.table_account_payments p
    join public.restaurant_payment_methods pm on pm.id = p.method_id and pm.restaurant_id = p.restaurant_id
   where p.cash_day_id = v_day.id and pm.method_type = 'cash';
  if v_expected < 0 or v_expected > 2147483647 then raise exception 'cash_day_expected_cash_invalid'; end if;
  v_difference := p_counted_cash_cents::bigint - v_expected;
  if v_difference <> 0 and char_length(btrim(coalesce(p_difference_reason, ''))) < 3 then
    raise exception 'cash_day_difference_reason_required' using errcode = '22023';
  end if;

  v_closed_at := clock_timestamp();
  if v_open_count > 0 then
    for v_account in
      select a.* from public.table_accounts a
       where a.restaurant_id = v_day.restaurant_id and a.status in ('open', 'settling') order by a.id
    loop
      select * into v_totals from public.table_account_totals(v_account.id);
      v_tip_accepted := coalesce(v_account.tip_accepted, false);
      v_tip_amount := case when v_account.tip_accepted then v_account.tip_amount_cents else 0 end;
      v_tip_decided_at := coalesce(v_account.tip_decided_at, now());
      if v_totals.balance_due_cents > 0 then
        update public.table_accounts set status = 'pending', tip_accepted = v_tip_accepted,
          tip_amount_cents = v_tip_amount, tip_decided_at = v_tip_decided_at, pending_cash_day_id = v_day.id
         where id = v_account.id;
        insert into public.table_account_events (
          restaurant_id, table_account_id, event_type, actor_id, reason, details, created_at
        ) values (
          v_day.restaurant_id, v_account.id, 'account_carried_to_pending', v_uid,
          btrim(p_exception_reason), jsonb_build_object('cashDayId', v_day.id,
            'balanceDueCents', v_totals.balance_due_cents, 'tipPreserved', v_account.tip_accepted is true,
            'tipAdded', false), v_closed_at
        );
      else
        update public.table_accounts set status = 'closed', tip_accepted = v_tip_accepted,
          tip_amount_cents = v_tip_amount, tip_decided_at = v_tip_decided_at, closed_at = v_closed_at, closed_by = v_uid
         where id = v_account.id;
        insert into public.table_account_events (
          restaurant_id, table_account_id, event_type, actor_id, reason, details, created_at
        ) values (
          v_day.restaurant_id, v_account.id, 'account_closed', v_uid, btrim(p_exception_reason),
          jsonb_build_object('cashDayId', v_day.id, 'closedByCashDay', true, 'balanceDueCents', 0), v_closed_at
        );
      end if;

      for v_call in
        select c.* from public.service_calls c
         where c.restaurant_id = v_day.restaurant_id and c.status = 'in_progress'
           and exists (
             select 1 from public.orders o
              where o.table_account_id = v_account.id and o.service_call_id = c.id
                and o.restaurant_id = v_day.restaurant_id
           )
         order by c.id for update
      loop
        v_transition_at := v_closed_at;
        update public.service_calls set status = 'resolved', resolved_at = v_transition_at, resolved_by = v_uid
         where id = v_call.id;
        insert into public.service_call_events (
          call_id, restaurant_id, event_type, actor_id, previous_assignee_id, next_assignee_id, created_at
        ) values (
          v_call.id, v_day.restaurant_id, 'resolved', v_uid, v_call.assigned_to, null, v_transition_at
        );
      end loop;
    end loop;
  end if;

  update public.restaurant_cash_days set status = 'closed', closed_at = v_closed_at, closed_by = v_uid,
    expected_cash_cents = v_expected::integer, counted_cash_cents = p_counted_cash_cents,
    cash_difference_cents = v_difference::integer, closing_count = p_closing_count,
    difference_reason = nullif(btrim(p_difference_reason), ''),
    exception_reason = nullif(btrim(p_exception_reason), ''), close_request_id = p_request_id,
    close_request_fingerprint = v_fingerprint
   where id = v_day.id returning * into v_day;
  return to_jsonb(v_day) || jsonb_build_object('outcome', 'recorded', 'carriedAccounts', v_open_count);
end;
$fn$;

create or replace function public.legacy_restaurant_finance_report(
  p_restaurant_id uuid, p_from timestamptz, p_to timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_role public.member_role;
  v_timezone text;
  v_evaluated_at timestamptz := statement_timestamp();
  v_to timestamptz;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_restaurant_id is null or (p_from is not null and p_to is not null and p_from > p_to) then
    raise exception 'finance_period_invalid' using errcode = '22023';
  end if;
  select m.role into v_role from public.memberships m
   where m.restaurant_id = p_restaurant_id and m.user_id = v_uid;
  if v_role is null or v_role not in ('admin', 'cashier') then raise exception 'forbidden' using errcode = '42501'; end if;
  select r.timezone into v_timezone from public.restaurants r where r.id = p_restaurant_id;
  if not found then raise exception 'restaurant_not_found'; end if;
  v_to := least(coalesce(p_to, v_evaluated_at), v_evaluated_at);

  return (
    with cash_periods as materialized (
      select d.opened_at as period_start,
        least(coalesce(d.closed_at, v_evaluated_at), v_to) as period_end
        from public.restaurant_cash_days d
       where d.restaurant_id = p_restaurant_id and d.opened_at <= v_to
    ),
    legacy_orders as materialized (
      select o.id, o.created_at
        from public.orders o
       where o.restaurant_id = p_restaurant_id
         and (p_from is null or o.created_at >= p_from) and o.created_at <= v_to
         and not exists (
           select 1 from cash_periods cp
            where o.created_at >= cp.period_start and o.created_at <= cp.period_end
         )
    ),
    legacy_tips as materialized (
      select a.tip_amount_cents, a.tip_decided_at
        from public.table_accounts a
       where a.restaurant_id = p_restaurant_id and a.tip_accepted is true
         and a.tip_decided_at is not null
         and (p_from is null or a.tip_decided_at >= p_from) and a.tip_decided_at <= v_to
         and not exists (
           select 1 from cash_periods cp
            where a.tip_decided_at >= cp.period_start and a.tip_decided_at <= cp.period_end
         )
    ),
    legacy_payments as materialized (
      select p.method_id, p.method_name, p.entry_type, p.amount_applied_cents
        from public.table_account_payments p
       where p.restaurant_id = p_restaurant_id and p.cash_day_id is null
         and (p_from is null or p.created_at >= p_from) and p.created_at <= v_to
    ),
    method_totals as (
      select p.method_id, p.method_name,
        coalesce(sum(p.amount_applied_cents) filter (where p.entry_type = 'received'), 0) as received_cents,
        coalesce(sum(p.amount_applied_cents) filter (where p.entry_type = 'refunded'), 0) as refunded_cents
        from legacy_payments p
       group by p.method_id, p.method_name
    )
    select jsonb_build_object(
      'timezone', v_timezone,
      'evaluatedAt', v_evaluated_at,
      'hasHistory', exists (select 1 from legacy_orders)
        or exists (select 1 from legacy_payments) or exists (select 1 from legacy_tips),
      'consumptionSalesCents', (
        select coalesce(sum(i.line_total_cents::bigint), 0)
          from legacy_orders o join public.order_items i on i.order_id = o.id
         where i.restaurant_id = p_restaurant_id
           and (i.cancelled_at is null or i.cancelled_at > v_evaluated_at)
      ),
      'grossTipsCents', (select coalesce(sum(t.tip_amount_cents::bigint), 0) from legacy_tips t),
      'receivedCents', (select coalesce(sum(p.amount_applied_cents::bigint), 0)
        from legacy_payments p where p.entry_type = 'received'),
      'refundedCents', (select coalesce(sum(p.amount_applied_cents::bigint), 0)
        from legacy_payments p where p.entry_type = 'refunded'),
      'methods', coalesce((
        select jsonb_agg(jsonb_build_object(
          'methodId', m.method_id, 'methodName', m.method_name,
          'receivedCents', m.received_cents, 'refundedCents', m.refunded_cents
        ) order by m.method_name)
          from method_totals m
      ), '[]'::jsonb)
    )
  );
end;
$fn$;

revoke all on function public.cash_day_count_matches(jsonb, integer) from public, anon, authenticated;
revoke all on function public.prevent_cash_day_ledger_mutation() from public, anon, authenticated;
revoke all on function public.prevent_closed_cash_day_mutation() from public, anon, authenticated;
revoke all on function public.open_restaurant_cash_day(uuid, integer, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.record_cash_day_movement(uuid, text, integer, text, uuid) from public, anon, authenticated;
revoke all on function public.close_restaurant_cash_day(uuid, integer, jsonb, text, text, uuid) from public, anon, authenticated;
revoke all on function public.record_table_payment(uuid, uuid, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.reverse_table_account_payment(uuid, integer, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.legacy_restaurant_finance_report(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.open_restaurant_cash_day(uuid, integer, jsonb, uuid) to authenticated;
grant execute on function public.record_cash_day_movement(uuid, text, integer, text, uuid) to authenticated;
grant execute on function public.close_restaurant_cash_day(uuid, integer, jsonb, text, text, uuid) to authenticated;
grant execute on function public.record_table_payment(uuid, uuid, uuid, integer, integer) to authenticated;
grant execute on function public.reverse_table_account_payment(uuid, integer, uuid, text, uuid) to authenticated;
grant execute on function public.legacy_restaurant_finance_report(uuid, timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
commit;
