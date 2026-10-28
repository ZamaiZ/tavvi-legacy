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

commit;
