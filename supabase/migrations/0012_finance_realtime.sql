create or replace function public.restaurant_finance_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_restaurant_id uuid;
begin
  v_restaurant_id := coalesce(new.restaurant_id, old.restaurant_id);
  begin
    perform realtime.broadcast_changes(
      'restaurant_finance:' || v_restaurant_id::text,
      tg_op, tg_op, tg_table_name, tg_table_schema, new, old
    );
  exception when others then
    raise warning 'restaurant_finance broadcast failed: %', sqlerrm;
  end;
  return coalesce(new, old);
end;
$fn$;

drop trigger if exists restaurant_cash_days_finance_broadcast on public.restaurant_cash_days;
create trigger restaurant_cash_days_finance_broadcast after insert or update or delete on public.restaurant_cash_days
  for each row execute function public.restaurant_finance_broadcast();
drop trigger if exists cash_day_movements_finance_broadcast on public.cash_day_movements;
create trigger cash_day_movements_finance_broadcast after insert or update or delete on public.cash_day_movements
  for each row execute function public.restaurant_finance_broadcast();
revoke all on function public.restaurant_finance_broadcast() from public, anon, authenticated;

drop policy if exists restaurant_finance_receive_topic on realtime.messages;
create policy restaurant_finance_receive_topic on realtime.messages
  for select to authenticated using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) ~ '^restaurant_finance:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.my_role(substring((select realtime.topic()) from 20)::uuid) in ('admin', 'cashier')
  );
