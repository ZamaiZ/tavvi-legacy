-- Restaurant members can serve their assigned calls and operate the shared cash desk.
-- Apply after 0008. Existing orders, accounts, and payment entries are preserved.

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
  );
$fn$;

drop policy if exists restaurant_checkout_settings_select_cash_roles on public.restaurant_checkout_settings;
create policy restaurant_checkout_settings_select_cash_roles on public.restaurant_checkout_settings
  for select to authenticated
  using (public.my_role(restaurant_id) is not null);

drop policy if exists restaurant_payment_methods_select_cash_roles on public.restaurant_payment_methods;
create policy restaurant_payment_methods_select_cash_roles on public.restaurant_payment_methods
  for select to authenticated
  using (public.my_role(restaurant_id) is not null);

drop policy if exists table_accounts_receive_cash_topic on realtime.messages;
create policy table_accounts_receive_cash_topic on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) ~ '^table_accounts:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.my_role(substring((select realtime.topic()) from 16)::uuid) is not null
  );

-- Settings and available payment methods change the live cash form too.
drop trigger if exists checkout_settings_broadcast on public.restaurant_checkout_settings;
create trigger checkout_settings_broadcast after update on public.restaurant_checkout_settings
  for each row execute function public.table_accounts_broadcast();
drop trigger if exists payment_methods_broadcast on public.restaurant_payment_methods;
create trigger payment_methods_broadcast after insert or update on public.restaurant_payment_methods
  for each row execute function public.table_accounts_broadcast();

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
  if not found then
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
  if not found then
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
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;

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
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
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
