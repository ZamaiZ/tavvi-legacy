-- =====================================================================
-- 0010 — Criação em massa de itens do cardápio
-- Limites e autorização também são conferidos no banco. A RPC é invoker e
-- reutiliza save_menu_item dentro da mesma transação PostgreSQL.
-- =====================================================================

create or replace function public.menu_item_media_sync_alt_text()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  select mi.name into new.alt_text
    from public.menu_items mi
   where mi.id = new.item_id
     and mi.restaurant_id = new.restaurant_id;
  return new;
end;
$fn$;

drop trigger if exists menu_item_media_sync_alt_text on public.menu_item_media;
create trigger menu_item_media_sync_alt_text
  before insert or update of item_id, restaurant_id, alt_text on public.menu_item_media
  for each row execute function public.menu_item_media_sync_alt_text();

create or replace function public.menu_items_sync_media_alt_text()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  if new.name is distinct from old.name then
    update public.menu_item_media
       set alt_text = new.name
     where item_id = new.id
       and restaurant_id = new.restaurant_id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists menu_items_sync_media_alt_text on public.menu_items;
create trigger menu_items_sync_media_alt_text
  after update of name on public.menu_items
  for each row execute function public.menu_items_sync_media_alt_text();

update public.menu_item_media mm
   set alt_text = mi.name
  from public.menu_items mi
 where mi.id = mm.item_id
   and mi.restaurant_id = mm.restaurant_id
   and mm.alt_text is distinct from mi.name;

create or replace function public.save_menu_items_batch(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_restaurant uuid := (p_payload ->> 'restaurantId')::uuid;
  v_categories jsonb := coalesce(p_payload -> 'categories', '[]'::jsonb);
  v_items jsonb := coalesce(p_payload -> 'items', '[]'::jsonb);
  v_category jsonb;
  v_item jsonb;
  v_item_result jsonb;
  v_index bigint;
  v_category_start integer;
  v_category_ids jsonb := '[]'::jsonb;
  v_item_ids jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(v_categories) is distinct from 'array'
     or jsonb_typeof(v_items) is distinct from 'array' then
    raise exception 'Conteúdo do lote inválido.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(v_categories) > 20 then
    raise exception 'Use no máximo 20 categorias novas por lote.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(v_items) > 50 then
    raise exception 'Use no máximo 50 itens por lote.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(v_categories) = 0 and jsonb_array_length(v_items) = 0 then
    raise exception 'Adicione uma categoria ou um item ao lote.' using errcode = 'P0001';
  end if;

  select coalesce(max(mc.position) + 1, 0)
    into v_category_start
    from public.menu_categories mc
   where mc.restaurant_id = v_restaurant;

  for v_category, v_index in
    select value, ordinality - 1
      from jsonb_array_elements(v_categories) with ordinality
  loop
    insert into public.menu_categories (id, restaurant_id, name, description, position)
    values (
      (v_category ->> 'id')::uuid,
      v_restaurant,
      v_category ->> 'name',
      nullif(v_category ->> 'description', ''),
      v_category_start + v_index
    );
    v_category_ids := v_category_ids || jsonb_build_array(v_category ->> 'id');
  end loop;

  if exists (
    select 1
      from jsonb_array_elements(v_items) item
      left join public.menu_categories category
        on category.id = (item.value ->> 'categoryId')::uuid
       and category.restaurant_id = v_restaurant
     where category.id is null
  ) then
    raise exception 'Uma categoria do lote não pertence a este restaurante.' using errcode = 'P0001';
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    v_item_result := public.save_menu_item(
      v_item || jsonb_build_object('mode', 'create', 'restaurantId', v_restaurant::text)
    );
    v_item_ids := v_item_ids || jsonb_build_array(v_item ->> 'itemId');
  end loop;

  return jsonb_build_object('itemIds', v_item_ids, 'categoryIds', v_category_ids);
end;
$fn$;

revoke all on function public.save_menu_items_batch(jsonb) from public, anon;
grant execute on function public.save_menu_items_batch(jsonb) to authenticated;

notify pgrst, 'reload schema';

