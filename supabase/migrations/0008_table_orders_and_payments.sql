-- Table orders, account settlement, and auditable manual payments.
-- Apply after 0007_menu_reorder_batch.sql. Do not apply the clean-install
-- baseline to a database that already contains data.

create unique index if not exists service_calls_id_restaurant_uidx
  on public.service_calls (id, restaurant_id);

create table if not exists public.restaurant_checkout_settings (
  restaurant_id uuid primary key references public.restaurants(id) on delete restrict,
  tip_mode text not null default 'disabled'
    check (tip_mode in ('disabled', 'percentage', 'fixed')),
  tip_percent_bps integer,
  tip_fixed_cents integer,
  updated_at timestamptz not null default now(),
  constraint restaurant_checkout_tip_settings_check check (
    (tip_mode = 'disabled' and tip_percent_bps is null and tip_fixed_cents is null)
    or (tip_mode = 'percentage' and tip_percent_bps between 1 and 10000 and tip_fixed_cents is null)
    or (tip_mode = 'fixed' and tip_percent_bps is null and tip_fixed_cents > 0)
  )
);

create table if not exists public.restaurant_payment_methods (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  method_type text not null check (method_type in (
    'cash', 'debit', 'credit', 'pix', 'meal_voucher', 'food_voucher',
    'voucher', 'partnership', 'other', 'custom'
  )),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  is_active boolean not null default true,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (id, restaurant_id)
);

create unique index if not exists restaurant_payment_methods_standard_uq
  on public.restaurant_payment_methods (restaurant_id, method_type)
  where method_type <> 'custom';
create unique index if not exists restaurant_payment_methods_custom_name_uq
  on public.restaurant_payment_methods (restaurant_id, lower(name))
  where method_type = 'custom';
create index if not exists restaurant_payment_methods_active_idx
  on public.restaurant_payment_methods (restaurant_id, is_active, position);

create or replace function public.prevent_payment_method_identity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if new.id <> old.id or new.restaurant_id <> old.restaurant_id or new.method_type <> old.method_type then
    raise exception 'payment_method_identity_immutable' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

drop trigger if exists restaurant_payment_methods_identity_immutable on public.restaurant_payment_methods;
create trigger restaurant_payment_methods_identity_immutable
  before update on public.restaurant_payment_methods
  for each row execute function public.prevent_payment_method_identity_change();

create table if not exists public.table_accounts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  table_number integer not null check (table_number > 0),
  status text not null default 'open' check (status in ('open', 'settling', 'closed')),
  tip_mode text not null check (tip_mode in ('disabled', 'percentage', 'fixed')),
  tip_percent_bps integer,
  tip_fixed_cents integer,
  tip_accepted boolean,
  tip_amount_cents integer not null default 0 check (tip_amount_cents >= 0),
  tip_decided_at timestamptz,
  opened_at timestamptz not null default now(),
  opened_by uuid not null references public.profiles(id) on delete restrict,
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete restrict,
  unique (id, restaurant_id),
  constraint table_accounts_tip_snapshot_check check (
    (tip_mode = 'disabled' and tip_percent_bps is null and tip_fixed_cents is null)
    or (tip_mode = 'percentage' and tip_percent_bps between 1 and 10000 and tip_fixed_cents is null)
    or (tip_mode = 'fixed' and tip_percent_bps is null and tip_fixed_cents > 0)
  ),
  constraint table_accounts_state_check check (
    (status = 'open' and tip_accepted is null and tip_decided_at is null
      and tip_amount_cents = 0 and closed_at is null and closed_by is null)
    or (status = 'settling' and tip_accepted is not null and tip_decided_at is not null
      and closed_at is null and closed_by is null)
    or (status = 'closed' and tip_accepted is not null and tip_decided_at is not null
      and closed_at is not null and closed_by is not null)
  )
);

create unique index if not exists table_accounts_one_active_per_table
  on public.table_accounts (restaurant_id, table_number)
  where status in ('open', 'settling');
create index if not exists table_accounts_restaurant_status_idx
  on public.table_accounts (restaurant_id, status, opened_at desc);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  table_account_id uuid not null,
  service_call_id uuid not null,
  request_id uuid not null,
  request_fingerprint text not null check (char_length(request_fingerprint) = 32),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, restaurant_id),
  unique (id, table_account_id, restaurant_id),
  unique (restaurant_id, request_id),
  foreign key (table_account_id, restaurant_id)
    references public.table_accounts(id, restaurant_id) on delete restrict,
  foreign key (service_call_id, restaurant_id)
    references public.service_calls(id, restaurant_id) on delete restrict
);

create index if not exists orders_account_created_idx
  on public.orders (table_account_id, created_at, id);
create index if not exists orders_call_idx
  on public.orders (service_call_id, created_at);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  order_id uuid not null,
  menu_item_id uuid,
  menu_variant_id uuid,
  category_name text not null,
  item_name text not null,
  variant_name text,
  position integer not null check (position >= 0),
  quantity integer not null check (quantity between 1 and 99),
  note text check (note is null or char_length(note) <= 1000),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete restrict,
  cancel_reason text,
  unique (id, restaurant_id),
  unique (order_id, position),
  foreign key (order_id, restaurant_id)
    references public.orders(id, restaurant_id) on delete restrict,
  constraint order_items_cancel_fields_check check (
    (cancelled_at is null and cancelled_by is null and cancel_reason is null)
    or (cancelled_at is not null and cancelled_by is not null and cancel_reason is not null)
  )
);

create table if not exists public.table_account_payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  table_account_id uuid not null,
  method_id uuid not null,
  method_name text not null,
  entry_type text not null check (entry_type in ('received', 'refunded')),
  amount_applied_cents integer not null check (amount_applied_cents > 0),
  cash_received_cents integer,
  cash_change_cents integer not null default 0 check (cash_change_cents >= 0),
  reverses_payment_id uuid,
  reference text check (reference is null or char_length(reference) <= 300),
  reason text check (reason is null or char_length(reason) <= 500),
  request_id uuid not null,
  request_fingerprint text not null check (char_length(request_fingerprint) = 32),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, restaurant_id),
  unique (restaurant_id, request_id),
  foreign key (table_account_id, restaurant_id)
    references public.table_accounts(id, restaurant_id) on delete restrict,
  foreign key (method_id, restaurant_id)
    references public.restaurant_payment_methods(id, restaurant_id) on delete restrict,
  foreign key (reverses_payment_id, restaurant_id)
    references public.table_account_payments(id, restaurant_id) on delete restrict,
  constraint table_account_payments_entry_check check (
    (entry_type = 'received' and reverses_payment_id is null and reason is null
      and cash_change_cents = coalesce(cash_received_cents, amount_applied_cents) - amount_applied_cents
      and (cash_received_cents is null or cash_received_cents >= amount_applied_cents))
    or (entry_type = 'refunded' and reverses_payment_id is not null and reason is not null
      and cash_received_cents is null and cash_change_cents = 0)
  )
);

create index if not exists table_account_payments_account_created_idx
  on public.table_account_payments (table_account_id, created_at, id);
create index if not exists table_account_payments_reverses_idx
  on public.table_account_payments (reverses_payment_id)
  where reverses_payment_id is not null;

create table if not exists public.table_account_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  table_account_id uuid not null,
  event_type text not null check (event_type in (
    'order_recorded', 'payment_received', 'payment_refunded', 'tip_decided',
    'settlement_reopened', 'order_item_cancelled', 'account_closed',
    'account_reopened_by_refund'
  )),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid,
  request_fingerprint text,
  order_id uuid,
  order_item_id uuid,
  payment_id uuid,
  reason text check (reason is null or char_length(reason) <= 500),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (table_account_id, restaurant_id)
    references public.table_accounts(id, restaurant_id) on delete restrict,
  foreign key (order_id, restaurant_id)
    references public.orders(id, restaurant_id) on delete restrict,
  foreign key (order_item_id, restaurant_id)
    references public.order_items(id, restaurant_id) on delete restrict,
  foreign key (payment_id, restaurant_id)
    references public.table_account_payments(id, restaurant_id) on delete restrict,
  constraint table_account_events_fingerprint_check check (
    request_fingerprint is null or char_length(request_fingerprint) = 32
  )
);

create index if not exists table_account_events_account_created_idx
  on public.table_account_events (table_account_id, created_at, id);
create unique index if not exists table_account_events_request_uq
  on public.table_account_events (restaurant_id, request_id, event_type)
  where request_id is not null;

create or replace function public.seed_restaurant_checkout_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.restaurant_checkout_settings (restaurant_id)
  values (new.id)
  on conflict (restaurant_id) do nothing;

  insert into public.restaurant_payment_methods (restaurant_id, method_type, name, position)
  values
    (new.id, 'cash', 'Dinheiro', 0),
    (new.id, 'debit', 'Débito', 1),
    (new.id, 'credit', 'Crédito', 2),
    (new.id, 'pix', 'Pix', 3),
    (new.id, 'meal_voucher', 'Vale-refeição (VR)', 4),
    (new.id, 'food_voucher', 'Vale-alimentação (VA)', 5),
    (new.id, 'voucher', 'Voucher', 6),
    (new.id, 'partnership', 'Parceria', 7),
    (new.id, 'other', 'Outro', 8)
  on conflict do nothing;
  return new;
end;
$fn$;

drop trigger if exists restaurants_seed_checkout_defaults on public.restaurants;
create trigger restaurants_seed_checkout_defaults
  after insert on public.restaurants
  for each row execute function public.seed_restaurant_checkout_defaults();

insert into public.restaurant_checkout_settings (restaurant_id)
select r.id from public.restaurants r
on conflict (restaurant_id) do nothing;

insert into public.restaurant_payment_methods (restaurant_id, method_type, name, position)
select r.id, methods.method_type, methods.name, methods.position
  from public.restaurants r
 cross join (values
   ('cash', 'Dinheiro', 0), ('debit', 'Débito', 1), ('credit', 'Crédito', 2),
   ('pix', 'Pix', 3), ('meal_voucher', 'Vale-refeição (VR)', 4),
   ('food_voucher', 'Vale-alimentação (VA)', 5), ('voucher', 'Voucher', 6),
   ('partnership', 'Parceria', 7), ('other', 'Outro', 8)
 ) as methods(method_type, name, position)
on conflict do nothing;

create or replace function public.can_access_table_account(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
      from public.table_accounts a
      join public.memberships m
        on m.restaurant_id = a.restaurant_id
       and m.user_id = (select auth.uid())
     where a.id = p_account_id
       and (
         m.role in ('admin', 'cashier')
         or (a.status in ('open', 'settling') and exists (
           select 1
             from public.service_calls c
            where c.restaurant_id = a.restaurant_id
              and c.table_number = a.table_number
              and c.status = 'in_progress'
              and c.assigned_to = (select auth.uid())
         ))
       )
  );
$fn$;

create or replace function public.table_account_totals(p_account_id uuid)
returns table (
  subtotal_cents integer,
  tip_cents integer,
  total_cents integer,
  paid_cents integer,
  balance_due_cents integer
)
language sql
stable
security definer
set search_path = ''
as $fn$
  with account as (
    select a.id, a.tip_accepted, a.tip_amount_cents
      from public.table_accounts a
     where a.id = p_account_id
  ), item_totals as (
    select coalesce(sum(i.line_total_cents) filter (where i.cancelled_at is null), 0)::bigint as subtotal
      from public.orders o
      join public.order_items i on i.order_id = o.id and i.restaurant_id = o.restaurant_id
     where o.table_account_id = p_account_id
  ), payment_totals as (
    select coalesce(sum(case when p.entry_type = 'received' then p.amount_applied_cents else -p.amount_applied_cents end), 0)::bigint as paid
      from public.table_account_payments p
     where p.table_account_id = p_account_id
  ), calculated as (
    select i.subtotal,
           case when a.tip_accepted is true then a.tip_amount_cents::bigint else 0::bigint end as tip,
           p.paid
      from account a cross join item_totals i cross join payment_totals p
  )
  select c.subtotal::integer,
         c.tip::integer,
         (c.subtotal + c.tip)::integer,
         c.paid::integer,
         greatest(c.subtotal + c.tip - c.paid, 0)::integer
    from calculated c;
$fn$;

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

create or replace function public.prevent_table_account_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  raise exception 'financial_ledger_immutable' using errcode = '42501';
end;
$fn$;

drop trigger if exists table_account_payments_immutable on public.table_account_payments;
create trigger table_account_payments_immutable
  before update or delete on public.table_account_payments
  for each row execute function public.prevent_table_account_ledger_mutation();
drop trigger if exists table_account_events_immutable on public.table_account_events;
create trigger table_account_events_immutable
  before update or delete on public.table_account_events
  for each row execute function public.prevent_table_account_ledger_mutation();

alter table public.restaurant_checkout_settings enable row level security;
alter table public.restaurant_payment_methods enable row level security;
alter table public.table_accounts enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.table_account_payments enable row level security;
alter table public.table_account_events enable row level security;

revoke all on public.restaurant_checkout_settings, public.restaurant_payment_methods,
  public.table_accounts, public.orders, public.order_items,
  public.table_account_payments, public.table_account_events
  from public, anon, authenticated;
grant select on public.restaurant_checkout_settings to authenticated;
grant update (tip_mode, tip_percent_bps, tip_fixed_cents, updated_at)
  on public.restaurant_checkout_settings to authenticated;
grant select on public.restaurant_payment_methods to authenticated;
grant insert (restaurant_id, method_type, name, position)
  on public.restaurant_payment_methods to authenticated;
grant select on public.table_accounts, public.orders, public.order_items,
  public.table_account_payments, public.table_account_events to authenticated;

drop policy if exists restaurant_checkout_settings_select_cash_roles on public.restaurant_checkout_settings;
create policy restaurant_checkout_settings_select_cash_roles on public.restaurant_checkout_settings
  for select to authenticated
  using (public.my_role(restaurant_id) in ('admin', 'cashier'));
drop policy if exists restaurant_checkout_settings_update_admin on public.restaurant_checkout_settings;
create policy restaurant_checkout_settings_update_admin on public.restaurant_checkout_settings
  for update to authenticated
  using (public.my_role(restaurant_id) = 'admin')
  with check (public.my_role(restaurant_id) = 'admin');

drop policy if exists restaurant_payment_methods_select_cash_roles on public.restaurant_payment_methods;
create policy restaurant_payment_methods_select_cash_roles on public.restaurant_payment_methods
  for select to authenticated
  using (public.my_role(restaurant_id) in ('admin', 'cashier'));
drop policy if exists restaurant_payment_methods_insert_admin on public.restaurant_payment_methods;
create policy restaurant_payment_methods_insert_admin on public.restaurant_payment_methods
  for insert to authenticated
  with check (public.my_role(restaurant_id) = 'admin' and method_type = 'custom');
drop policy if exists restaurant_payment_methods_update_admin on public.restaurant_payment_methods;
create policy restaurant_payment_methods_update_admin on public.restaurant_payment_methods
  for update to authenticated
  using (public.my_role(restaurant_id) = 'admin')
  with check (public.my_role(restaurant_id) = 'admin');

drop policy if exists table_accounts_select_accessible on public.table_accounts;
create policy table_accounts_select_accessible on public.table_accounts
  for select to authenticated using (public.can_access_table_account(id));
drop policy if exists orders_select_accessible on public.orders;
create policy orders_select_accessible on public.orders
  for select to authenticated using (public.can_access_table_account(table_account_id));
drop policy if exists order_items_select_accessible on public.order_items;
create policy order_items_select_accessible on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o
       where o.id = order_items.order_id
         and o.restaurant_id = order_items.restaurant_id
         and public.can_access_table_account(o.table_account_id)
    )
  );
drop policy if exists table_account_payments_select_accessible on public.table_account_payments;
create policy table_account_payments_select_accessible on public.table_account_payments
  for select to authenticated using (public.can_access_table_account(table_account_id));
drop policy if exists table_account_events_select_accessible on public.table_account_events;
create policy table_account_events_select_accessible on public.table_account_events
  for select to authenticated using (public.can_access_table_account(table_account_id));

revoke all on function public.seed_restaurant_checkout_defaults() from public, anon, authenticated;
revoke all on function public.prevent_payment_method_identity_change() from public, anon, authenticated;
revoke all on function public.can_access_table_account(uuid) from public, anon;
grant execute on function public.can_access_table_account(uuid) to authenticated;
revoke all on function public.table_account_totals(uuid) from public, anon, authenticated;
revoke all on function public.table_account_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.prevent_table_account_ledger_mutation() from public, anon, authenticated;

create or replace function public.table_accounts_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  begin
    perform realtime.broadcast_changes(
      'table_accounts:' || coalesce(new.restaurant_id, old.restaurant_id)::text,
      tg_op, tg_op, tg_table_name, tg_table_schema, new, old
    );
  exception when others then
    raise warning 'table_accounts broadcast failed: %', sqlerrm;
  end;
  return coalesce(new, old);
end;
$fn$;

drop trigger if exists table_accounts_broadcast on public.table_accounts;
create trigger table_accounts_broadcast after insert or update on public.table_accounts
  for each row execute function public.table_accounts_broadcast();
drop trigger if exists orders_broadcast on public.orders;
create trigger orders_broadcast after insert on public.orders
  for each row execute function public.table_accounts_broadcast();
drop trigger if exists order_items_broadcast on public.order_items;
create trigger order_items_broadcast after insert or update on public.order_items
  for each row execute function public.table_accounts_broadcast();
drop trigger if exists table_account_payments_broadcast on public.table_account_payments;
create trigger table_account_payments_broadcast after insert on public.table_account_payments
  for each row execute function public.table_accounts_broadcast();
drop trigger if exists table_account_events_broadcast on public.table_account_events;
create trigger table_account_events_broadcast after insert on public.table_account_events
  for each row execute function public.table_accounts_broadcast();
revoke all on function public.table_accounts_broadcast() from public, anon, authenticated;

drop policy if exists table_accounts_receive_cash_topic on realtime.messages;
create policy table_accounts_receive_cash_topic on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) ~ '^table_accounts:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.my_role(substring((select realtime.topic()) from 16)::uuid) in ('admin', 'cashier')
  );

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
  if not found or v_role not in ('attendant', 'waiter') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

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

  select s.* into v_settings
    from public.restaurant_checkout_settings s
   where s.restaurant_id = v_restaurant_id
   for share;
  if not found then raise exception 'checkout_settings_missing'; end if;

  insert into public.table_accounts (
    restaurant_id, table_number, status, tip_mode, tip_percent_bps,
    tip_fixed_cents, opened_by
  ) values (
    v_restaurant_id, v_call.table_number, 'open', v_settings.tip_mode,
    v_settings.tip_percent_bps, v_settings.tip_fixed_cents, v_uid
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
    request_id, request_fingerprint, created_by
  ) values (
    v_restaurant_id, v_account_id, p_call_id,
    p_request_id, v_fingerprint, v_uid
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
       or v_category_visible is not true then
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

revoke all on function public.record_table_order(uuid, uuid, jsonb) from public, anon;
grant execute on function public.record_table_order(uuid, uuid, jsonb) to authenticated;

create or replace function public.record_table_payment(
  p_account_id uuid,
  p_method_id uuid,
  p_request_id uuid,
  p_amount_applied_cents integer,
  p_cash_received_cents integer default null
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
  v_role public.member_role;
  v_method_name text;
  v_method_type text;
  v_payment_id uuid;
  v_existing public.table_account_payments%rowtype;
  v_fingerprint text;
  v_totals record;
  v_change integer := 0;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_account_id is null or p_method_id is null or p_request_id is null
     or p_amount_applied_cents is null or p_amount_applied_cents <= 0 then
    raise exception 'payment_input_invalid' using errcode = '22023';
  end if;

  select a.* into v_account from public.table_accounts a where a.id = p_account_id for update;
  if not found then raise exception 'account_not_found'; end if;
  select m.role into v_role from public.memberships m
   where m.restaurant_id = v_account.restaurant_id and m.user_id = v_uid for share;
  if not found or v_role not in ('admin', 'cashier') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

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

  if v_account.status not in ('open', 'settling') then raise exception 'account_closed'; end if;
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
  elsif p_cash_received_cents is not null then
    raise exception 'cash_amount_invalid' using errcode = '22023';
  end if;

  select * into v_totals from public.table_account_totals(p_account_id);
  if v_totals.balance_due_cents <= 0 then raise exception 'account_no_balance_due'; end if;
  if p_amount_applied_cents > v_totals.balance_due_cents then raise exception 'payment_exceeds_balance'; end if;

  insert into public.table_account_payments (
    restaurant_id, table_account_id, method_id, method_name, entry_type,
    amount_applied_cents, cash_received_cents, cash_change_cents,
    request_id, request_fingerprint, created_by
  ) values (
    v_account.restaurant_id, p_account_id, p_method_id, v_method_name, 'received',
    p_amount_applied_cents, p_cash_received_cents, v_change,
    p_request_id, v_fingerprint, v_uid
  ) on conflict (restaurant_id, request_id) do nothing
  returning id into v_payment_id;

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
      'cashReceivedCents', p_cash_received_cents, 'changeCents', v_change)
  );

  select * into v_totals from public.table_account_totals(p_account_id);
  if v_account.status = 'settling' and v_totals.balance_due_cents = 0 then
    update public.table_accounts set status = 'closed', closed_at = now(), closed_by = v_uid
     where id = p_account_id;
    insert into public.table_account_events (
      restaurant_id, table_account_id, event_type, actor_id,
      payment_id, details
    ) values (
      v_account.restaurant_id, p_account_id, 'account_closed', v_uid,
      v_payment_id, jsonb_build_object('closedByPayment', true)
    );
  end if;
  return public.table_account_snapshot(p_account_id)
    || jsonb_build_object('outcome', 'recorded', 'paymentId', v_payment_id,
      'changeCents', v_change);
end;
$fn$;

create or replace function public.decide_tip_and_close_table_account(
  p_account_id uuid,
  p_tip_accepted boolean,
  p_request_id uuid
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
  v_role public.member_role;
  v_existing public.table_account_events%rowtype;
  v_fingerprint text;
  v_subtotal bigint;
  v_tip integer := 0;
  v_totals record;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_account_id is null or p_request_id is null or p_tip_accepted is null then
    raise exception 'tip_input_invalid' using errcode = '22023';
  end if;
  select a.* into v_account from public.table_accounts a where a.id = p_account_id for update;
  if not found then raise exception 'account_not_found'; end if;
  select m.role into v_role from public.memberships m
   where m.restaurant_id = v_account.restaurant_id and m.user_id = v_uid for share;
  if not found or v_role not in ('admin', 'cashier') then raise exception 'forbidden' using errcode = '42501'; end if;

  v_fingerprint := md5(concat_ws(':', p_account_id::text, p_tip_accepted::text));
  select e.* into v_existing from public.table_account_events e
   where e.restaurant_id = v_account.restaurant_id and e.request_id = p_request_id and e.event_type = 'tip_decided';
  if found then
    if v_existing.table_account_id <> p_account_id or v_existing.actor_id <> v_uid
       or v_existing.request_fingerprint <> v_fingerprint then raise exception 'duplicate_request'; end if;
    return public.table_account_snapshot(p_account_id) || jsonb_build_object('outcome', 'already_recorded');
  end if;
  if v_account.status <> 'open' then raise exception 'account_not_open'; end if;
  if p_tip_accepted and v_account.tip_mode = 'disabled' then raise exception 'tip_disabled'; end if;
  select coalesce(sum(i.line_total_cents), 0)::bigint into v_subtotal
    from public.orders o join public.order_items i on i.order_id = o.id and i.restaurant_id = o.restaurant_id
   where o.table_account_id = p_account_id and i.cancelled_at is null;
  if p_tip_accepted and v_subtotal > 0 then
    if v_account.tip_mode = 'percentage' then
      v_tip := round(v_subtotal::numeric * v_account.tip_percent_bps / 10000)::integer;
    elsif v_account.tip_mode = 'fixed' then
      v_tip := v_account.tip_fixed_cents;
    end if;
  end if;
  if v_subtotal + v_tip > 2147483647 then raise exception 'account_total_too_large'; end if;
  update public.table_accounts set status = 'settling', tip_accepted = p_tip_accepted,
    tip_amount_cents = v_tip, tip_decided_at = now() where id = p_account_id;
  insert into public.table_account_events (
    restaurant_id, table_account_id, event_type, actor_id,
    request_id, request_fingerprint, details
  ) values (
    v_account.restaurant_id, p_account_id, 'tip_decided', v_uid,
    p_request_id, v_fingerprint,
    jsonb_build_object('accepted', p_tip_accepted, 'tipCents', v_tip,
      'mode', v_account.tip_mode, 'subtotalCents', v_subtotal)
  );
  select * into v_totals from public.table_account_totals(p_account_id);
  if v_totals.balance_due_cents = 0 then
    update public.table_accounts set status = 'closed', closed_at = now(), closed_by = v_uid
     where id = p_account_id;
    insert into public.table_account_events (
      restaurant_id, table_account_id, event_type, actor_id, details
    ) values (
      v_account.restaurant_id, p_account_id, 'account_closed', v_uid,
      jsonb_build_object('closedWithTipDecision', true)
    );
  end if;
  return public.table_account_snapshot(p_account_id) || jsonb_build_object('outcome', 'recorded');
end;
$fn$;

create or replace function public.reopen_table_account(
  p_account_id uuid,
  p_reason text,
  p_request_id uuid
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
  v_role public.member_role;
  v_reason text := nullif(btrim(p_reason), '');
  v_existing public.table_account_events%rowtype;
  v_fingerprint text;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_account_id is null or p_request_id is null or v_reason is null or char_length(v_reason) > 500 then
    raise exception 'reopen_input_invalid' using errcode = '22023';
  end if;
  select a.* into v_account from public.table_accounts a where a.id = p_account_id for update;
  if not found then raise exception 'account_not_found'; end if;
  select m.role into v_role from public.memberships m
   where m.restaurant_id = v_account.restaurant_id and m.user_id = v_uid for share;
  if not found or v_role <> 'admin' then raise exception 'forbidden' using errcode = '42501'; end if;
  v_fingerprint := md5(concat_ws(':', p_account_id::text, v_reason));
  select e.* into v_existing from public.table_account_events e
   where e.restaurant_id = v_account.restaurant_id and e.request_id = p_request_id and e.event_type = 'settlement_reopened';
  if found then
    if v_existing.table_account_id <> p_account_id or v_existing.actor_id <> v_uid
       or v_existing.request_fingerprint <> v_fingerprint then raise exception 'duplicate_request'; end if;
    return public.table_account_snapshot(p_account_id) || jsonb_build_object('outcome', 'already_recorded');
  end if;
  if v_account.status not in ('settling', 'closed') then raise exception 'account_not_settling'; end if;
  if exists (
    select 1 from public.table_account_payments received
     where received.table_account_id = p_account_id and received.entry_type = 'received'
       and received.created_at > v_account.tip_decided_at
       and received.amount_applied_cents > coalesce((
         select sum(refund.amount_applied_cents) from public.table_account_payments refund
          where refund.reverses_payment_id = received.id
       ), 0)
  ) then raise exception 'reverse_post_decision_payments_first'; end if;
  update public.table_accounts set status = 'open', tip_accepted = null,
    tip_amount_cents = 0, tip_decided_at = null, closed_at = null, closed_by = null
   where id = p_account_id;
  insert into public.table_account_events (
    restaurant_id, table_account_id, event_type, actor_id,
    request_id, request_fingerprint, reason, details
  ) values (
    v_account.restaurant_id, p_account_id, 'settlement_reopened', v_uid,
    p_request_id, v_fingerprint, v_reason,
    jsonb_build_object('previousStatus', v_account.status, 'previousTipAccepted', v_account.tip_accepted,
      'previousTipCents', v_account.tip_amount_cents)
  );
  return public.table_account_snapshot(p_account_id) || jsonb_build_object('outcome', 'recorded');
end;
$fn$;

create or replace function public.reverse_table_account_payment(
  p_payment_id uuid,
  p_amount_cents integer,
  p_reason text,
  p_request_id uuid
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
  v_role public.member_role;
  v_reason text := nullif(btrim(p_reason), '');
  v_existing public.table_account_payments%rowtype;
  v_fingerprint text;
  v_refunded bigint;
  v_refund_id uuid;
  v_was_closed boolean;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_payment_id is null or p_request_id is null or p_amount_cents is null or p_amount_cents <= 0
     or v_reason is null or char_length(v_reason) > 500 then
    raise exception 'refund_input_invalid' using errcode = '22023';
  end if;
  select p.* into v_original from public.table_account_payments p where p.id = p_payment_id;
  if not found or v_original.entry_type <> 'received' then raise exception 'payment_not_reversible'; end if;
  select a.* into v_account from public.table_accounts a where a.id = v_original.table_account_id for update;
  select m.role into v_role from public.memberships m
   where m.restaurant_id = v_account.restaurant_id and m.user_id = v_uid for share;
  if not found or v_role not in ('admin', 'cashier') then raise exception 'forbidden' using errcode = '42501'; end if;
  v_fingerprint := md5(concat_ws(':', p_payment_id::text, p_amount_cents::text, v_reason));
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
  select coalesce(sum(p.amount_applied_cents), 0)::bigint into v_refunded
    from public.table_account_payments p where p.reverses_payment_id = p_payment_id;
  if v_refunded + p_amount_cents > v_original.amount_applied_cents then raise exception 'refund_exceeds_payment'; end if;
  v_was_closed := v_account.status = 'closed';
  insert into public.table_account_payments (
    restaurant_id, table_account_id, method_id, method_name, entry_type,
    amount_applied_cents, cash_received_cents, cash_change_cents,
    reverses_payment_id, reason, request_id, request_fingerprint, created_by
  ) values (
    v_account.restaurant_id, v_account.id, v_original.method_id, v_original.method_name, 'refunded',
    p_amount_cents, null, 0, p_payment_id, v_reason, p_request_id, v_fingerprint, v_uid
  ) on conflict (restaurant_id, request_id) do nothing
  returning id into v_refund_id;
  if v_refund_id is null then raise exception 'duplicate_request'; end if;
  if v_was_closed then
    update public.table_accounts set status = 'settling', closed_at = null, closed_by = null where id = v_account.id;
    insert into public.table_account_events (
      restaurant_id, table_account_id, event_type, actor_id, request_id,
      request_fingerprint, payment_id, reason, details
    ) values (
      v_account.restaurant_id, v_account.id, 'account_reopened_by_refund', v_uid,
      p_request_id, v_fingerprint, v_refund_id, v_reason,
      jsonb_build_object('reversesPaymentId', p_payment_id, 'amountCents', p_amount_cents)
    );
  end if;
  insert into public.table_account_events (
    restaurant_id, table_account_id, event_type, actor_id,
    request_id, request_fingerprint, payment_id, reason, details
  ) values (
    v_account.restaurant_id, v_account.id, 'payment_refunded', v_uid,
    p_request_id, v_fingerprint, v_refund_id, v_reason,
    jsonb_build_object('reversesPaymentId', p_payment_id, 'amountCents', p_amount_cents)
  );
  return public.table_account_snapshot(v_account.id)
    || jsonb_build_object('outcome', 'recorded', 'paymentId', v_refund_id);
end;
$fn$;

create or replace function public.set_restaurant_payment_method_active(
  p_restaurant_id uuid,
  p_method_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_role public.member_role;
  v_current_active boolean;
  v_other_active_count integer;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_restaurant_id is null or p_method_id is null or p_is_active is null then
    raise exception 'payment_method_input_invalid' using errcode = '22023';
  end if;
  select m.role into v_role from public.memberships m
   where m.restaurant_id = p_restaurant_id and m.user_id = v_uid for share;
  if not found or v_role <> 'admin' then raise exception 'forbidden' using errcode = '42501'; end if;

  perform 1 from public.restaurants r where r.id = p_restaurant_id for update;
  if not found then raise exception 'restaurant_not_found'; end if;
  select m.is_active into v_current_active from public.restaurant_payment_methods m
   where m.id = p_method_id and m.restaurant_id = p_restaurant_id for update;
  if not found then raise exception 'payment_method_not_found'; end if;

  if v_current_active and not p_is_active then
    select count(*) into v_other_active_count from public.restaurant_payment_methods m
     where m.restaurant_id = p_restaurant_id and m.is_active and m.id <> p_method_id;
    if v_other_active_count = 0 then
      raise exception 'payment_method_last_active' using errcode = '23514';
    end if;
  end if;

  update public.restaurant_payment_methods set is_active = p_is_active
   where id = p_method_id and restaurant_id = p_restaurant_id;
end;
$fn$;

create or replace function public.cancel_order_item(
  p_order_item_id uuid,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_item public.order_items%rowtype;
  v_account public.table_accounts%rowtype;
  v_role public.member_role;
  v_reason text := nullif(btrim(p_reason), '');
  v_existing public.table_account_events%rowtype;
  v_fingerprint text;
  v_subtotal bigint;
  v_paid bigint;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_order_item_id is null or p_request_id is null or v_reason is null or char_length(v_reason) > 500 then
    raise exception 'cancel_input_invalid' using errcode = '22023';
  end if;
  select i.* into v_item from public.order_items i where i.id = p_order_item_id;
  if not found then raise exception 'order_item_not_found'; end if;
  select a.* into v_account from public.orders o join public.table_accounts a on a.id = o.table_account_id
   where o.id = v_item.order_id for update of a;
  select m.role into v_role from public.memberships m
   where m.restaurant_id = v_account.restaurant_id and m.user_id = v_uid for share;
  if not found or v_role <> 'admin' then raise exception 'forbidden' using errcode = '42501'; end if;
  v_fingerprint := md5(concat_ws(':', p_order_item_id::text, v_reason));
  select e.* into v_existing from public.table_account_events e
   where e.restaurant_id = v_account.restaurant_id and e.request_id = p_request_id and e.event_type = 'order_item_cancelled';
  if found then
    if v_existing.table_account_id <> v_account.id or v_existing.order_item_id <> p_order_item_id
       or v_existing.actor_id <> v_uid or v_existing.request_fingerprint <> v_fingerprint then raise exception 'duplicate_request'; end if;
    return public.table_account_snapshot(v_account.id) || jsonb_build_object('outcome', 'already_recorded');
  end if;
  if v_account.status <> 'open' then raise exception 'account_not_open'; end if;
  if v_item.cancelled_at is not null then raise exception 'order_item_already_cancelled'; end if;
  select coalesce(sum(i.line_total_cents), 0)::bigint into v_subtotal
    from public.orders o join public.order_items i on i.order_id = o.id and i.restaurant_id = o.restaurant_id
   where o.table_account_id = v_account.id and i.cancelled_at is null and i.id <> p_order_item_id;
  select coalesce(sum(case when p.entry_type = 'received' then p.amount_applied_cents else -p.amount_applied_cents end), 0)::bigint into v_paid
    from public.table_account_payments p where p.table_account_id = v_account.id;
  if v_subtotal < v_paid then raise exception 'refund_before_cancellation'; end if;
  update public.order_items set cancelled_at = now(), cancelled_by = v_uid, cancel_reason = v_reason
   where id = p_order_item_id;
  insert into public.table_account_events (
    restaurant_id, table_account_id, event_type, actor_id,
    request_id, request_fingerprint, order_id, order_item_id, reason, details
  ) values (
    v_account.restaurant_id, v_account.id, 'order_item_cancelled', v_uid,
    p_request_id, v_fingerprint, v_item.order_id, p_order_item_id, v_reason,
    jsonb_build_object('itemName', v_item.item_name, 'quantity', v_item.quantity,
      'lineTotalCents', v_item.line_total_cents)
  );
  return public.table_account_snapshot(v_account.id) || jsonb_build_object('outcome', 'recorded');
end;
$fn$;

revoke all on function public.seed_restaurant_checkout_defaults() from public, anon, authenticated;
revoke all on function public.can_access_table_account(uuid) from public, anon;
grant execute on function public.can_access_table_account(uuid) to authenticated;
revoke all on function public.table_account_totals(uuid), public.table_account_snapshot(uuid),
  public.prevent_table_account_ledger_mutation() from public, anon, authenticated;
revoke all on function public.record_table_order(uuid, uuid, jsonb),
  public.record_table_payment(uuid, uuid, uuid, integer, integer),
  public.decide_tip_and_close_table_account(uuid, boolean, uuid),
  public.reopen_table_account(uuid, text, uuid),
  public.reverse_table_account_payment(uuid, integer, text, uuid),
  public.set_restaurant_payment_method_active(uuid, uuid, boolean),
  public.cancel_order_item(uuid, text, uuid) from public, anon;
grant execute on function public.record_table_order(uuid, uuid, jsonb),
  public.record_table_payment(uuid, uuid, uuid, integer, integer),
  public.decide_tip_and_close_table_account(uuid, boolean, uuid),
  public.reopen_table_account(uuid, text, uuid),
  public.reverse_table_account_payment(uuid, integer, text, uuid),
  public.set_restaurant_payment_method_active(uuid, uuid, boolean),
  public.cancel_order_item(uuid, text, uuid) to authenticated;

