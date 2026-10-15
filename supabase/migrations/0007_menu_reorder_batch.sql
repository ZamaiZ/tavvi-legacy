-- Replace N sequential PostgREST updates with one atomic operation.
-- SECURITY INVOKER keeps the existing restaurant-admin RLS policies active.
create or replace function public.reorder_menu_categories(
  p_restaurant_id uuid,
  p_order jsonb
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $fn$
declare
  v_expected integer;
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_restaurant_id is null or p_order is null
     or jsonb_typeof(p_order) is distinct from 'array'
     or jsonb_array_length(p_order) = 0 then
    raise exception 'menu_reorder_invalid' using errcode = '22023';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(p_order) as entry(value)
     where jsonb_typeof(entry.value) is distinct from 'object'
        or entry.value ->> 'id' is null
        or entry.value ->> 'position' is null
        or (entry.value ->> 'position') !~ '^[0-9]+$'
  ) then
    raise exception 'menu_reorder_invalid' using errcode = '22023';
  end if;
  if exists (
    select 1
      from (
        select (entry.value ->> 'id')::uuid as row_id
          from jsonb_array_elements(p_order) as entry(value)
         group by 1
        having count(*) > 1
      ) duplicates
  ) then
    raise exception 'menu_reorder_duplicate_id' using errcode = '22023';
  end if;

  v_expected := jsonb_array_length(p_order);
  with requested as (
    select (entry.value ->> 'id')::uuid as row_id,
           (entry.value ->> 'position')::integer as row_position
      from jsonb_array_elements(p_order) as entry(value)
  )
  update public.menu_categories as category
     set position = requested.row_position
    from requested
   where category.id = requested.row_id
     and category.restaurant_id = p_restaurant_id;
  get diagnostics v_updated = row_count;

  if v_updated <> v_expected then
    raise exception 'menu_reorder_scope_mismatch' using errcode = '42501';
  end if;
end;
$fn$;

revoke all on function public.reorder_menu_categories(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reorder_menu_categories(uuid, jsonb) to authenticated;

create or replace function public.reorder_menu_items(
  p_restaurant_id uuid,
  p_order jsonb
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $fn$
declare
  v_expected integer;
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_restaurant_id is null or p_order is null
     or jsonb_typeof(p_order) is distinct from 'array'
     or jsonb_array_length(p_order) = 0 then
    raise exception 'menu_reorder_invalid' using errcode = '22023';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(p_order) as entry(value)
     where jsonb_typeof(entry.value) is distinct from 'object'
        or entry.value ->> 'id' is null
        or entry.value ->> 'position' is null
        or (entry.value ->> 'position') !~ '^[0-9]+$'
  ) then
    raise exception 'menu_reorder_invalid' using errcode = '22023';
  end if;
  if exists (
    select 1
      from (
        select (entry.value ->> 'id')::uuid as row_id
          from jsonb_array_elements(p_order) as entry(value)
         group by 1
        having count(*) > 1
      ) duplicates
  ) then
    raise exception 'menu_reorder_duplicate_id' using errcode = '22023';
  end if;

  v_expected := jsonb_array_length(p_order);
  with requested as (
    select (entry.value ->> 'id')::uuid as row_id,
           (entry.value ->> 'position')::integer as row_position
      from jsonb_array_elements(p_order) as entry(value)
  )
  update public.menu_items as item
     set position = requested.row_position
    from requested
   where item.id = requested.row_id
     and item.restaurant_id = p_restaurant_id;
  get diagnostics v_updated = row_count;

  if v_updated <> v_expected then
    raise exception 'menu_reorder_scope_mismatch' using errcode = '42501';
  end if;
end;
$fn$;

revoke all on function public.reorder_menu_items(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reorder_menu_items(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
