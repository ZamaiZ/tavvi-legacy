-- =====================================================================
-- 0027 — Gravação atômica do item do cardápio
--
-- Rode DEPOIS do 0026. Idempotente: `create or replace`.
--
-- Até aqui, salvar um item eram várias chamadas: o item, cada variação, o
-- registro de cada mídia, a ordem, o enquadramento. Uma falha no meio
-- deixava o item pela metade — o caso clássico era o vídeo acima de 15 s,
-- recusado só DEPOIS de o item nascer.
--
-- Agora o navegador valida e sobe os arquivos antes, e esta função grava
-- tudo numa transação: o item existe completo, ou não existe.
--
-- SECURITY INVOKER: roda com as permissões de quem chamou. As políticas de
-- RLS de menu_items, menu_item_variants e menu_item_media (0011) continuam
-- sendo a autorização; nada aqui as contorna.
-- =====================================================================

create or replace function public.save_menu_item(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_mode text := p_payload ->> 'mode';
  v_restaurant uuid := (p_payload ->> 'restaurantId')::uuid;
  v_item uuid := (p_payload ->> 'itemId')::uuid;
  v_category uuid := (p_payload ->> 'categoryId')::uuid;
  v_pricing jsonb := coalesce(p_payload -> 'pricing', '{}'::jsonb);
  v_variants jsonb := coalesce(p_payload -> 'pricing' -> 'variants', '[]'::jsonb);
  v_media jsonb := coalesce(p_payload -> 'media', '[]'::jsonb);
  v_tags text[] := array(
    select jsonb_array_elements_text(coalesce(p_payload -> 'dietaryTags', '[]'::jsonb))
  );
  v_prefix text := (p_payload ->> 'restaurantId') || '/' || (p_payload ->> 'itemId') || '/';
  v_price integer;
  v_old_category uuid;
  v_entry jsonb;
  v_index bigint;
  v_new_media integer;
  v_total integer;
  v_removed jsonb;
begin
  if v_mode is null or v_mode not in ('create', 'update') then
    raise exception 'Operação inválida.' using errcode = 'P0001';
  end if;

  -- Preço. Com variações, o do item é DERIVADO: o menor entre elas. Ninguém
  -- o vê nem o edita; ele só existe para quem ordena ou filtra por preço.
  if v_pricing ->> 'mode' = 'variants' then
    if jsonb_array_length(v_variants) = 0 then
      raise exception 'Adicione ao menos uma variação.' using errcode = 'P0001';
    end if;
    select min((value ->> 'priceCents')::integer) into v_price
      from jsonb_array_elements(v_variants);
  else
    v_price := (v_pricing ->> 'basePriceCents')::integer;
    if v_price is null then
      raise exception 'Informe o preço.' using errcode = 'P0001';
    end if;
  end if;

  -- Item.
  if v_mode = 'create' then
    insert into public.menu_items (
      id, restaurant_id, category_id, name, description, base_price_cents,
      dietary_tags, is_visible, is_available, position
    )
    values (
      v_item,
      v_restaurant,
      v_category,
      p_payload ->> 'name',
      nullif(p_payload ->> 'description', ''),
      v_price,
      v_tags,
      (p_payload ->> 'isVisible')::boolean,
      (p_payload ->> 'isAvailable')::boolean,
      -- O item novo vai para o fim da categoria (antes nascia em 0).
      (select coalesce(max(mi.position) + 1, 0) from public.menu_items mi where mi.category_id = v_category)
    );
  else
    select mi.category_id into v_old_category
      from public.menu_items mi
     where mi.id = v_item and mi.restaurant_id = v_restaurant;
    if not found then
      raise exception 'Item não encontrado.' using errcode = 'P0001';
    end if;

    update public.menu_items mi set
      category_id = v_category,
      name = p_payload ->> 'name',
      description = nullif(p_payload ->> 'description', ''),
      base_price_cents = v_price,
      dietary_tags = v_tags,
      is_visible = (p_payload ->> 'isVisible')::boolean,
      is_available = (p_payload ->> 'isAvailable')::boolean,
      -- Trocar de categoria leva o item para o fim da nova.
      position = case
        when v_category is distinct from v_old_category then
          (select coalesce(max(other.position) + 1, 0) from public.menu_items other where other.category_id = v_category)
        else mi.position
      end
    where mi.id = v_item;
  end if;

  -- Variações. A ordem da lista é a posição.
  if v_pricing ->> 'mode' = 'variants' then
    if exists (
      select 1
        from jsonb_array_elements(v_variants) v
       where v ? 'id'
         and not exists (
           select 1 from public.menu_item_variants mv
            where mv.id = (v ->> 'id')::uuid and mv.item_id = v_item
         )
    ) then
      raise exception 'Variação não pertence a este item.' using errcode = 'P0001';
    end if;

    delete from public.menu_item_variants mv
     where mv.item_id = v_item
       and mv.id not in (
         select (v ->> 'id')::uuid from jsonb_array_elements(v_variants) v where v ? 'id'
       );

    for v_entry, v_index in
      select value, ordinality - 1 from jsonb_array_elements(v_variants) with ordinality
    loop
      if v_entry ? 'id' then
        update public.menu_item_variants set
          name = v_entry ->> 'name',
          price_cents = (v_entry ->> 'priceCents')::integer,
          is_available = (v_entry ->> 'isAvailable')::boolean,
          position = v_index
        where id = (v_entry ->> 'id')::uuid;
      else
        insert into public.menu_item_variants (restaurant_id, item_id, name, price_cents, is_available, position)
        values (
          v_restaurant,
          v_item,
          v_entry ->> 'name',
          (v_entry ->> 'priceCents')::integer,
          (v_entry ->> 'isAvailable')::boolean,
          v_index
        );
      end if;
    end loop;
  else
    delete from public.menu_item_variants where item_id = v_item;
  end if;

  -- Mídia. A ordem da lista é a ordem das telas; a primeira é a capa.
  if exists (
    select 1
      from jsonb_array_elements(v_media) m
     where m ->> 'source' = 'saved'
       and not exists (
         select 1 from public.menu_item_media mm
          where mm.id = (m ->> 'id')::uuid and mm.item_id = v_item
       )
  ) then
    raise exception 'Mídia não pertence a este item.' using errcode = 'P0001';
  end if;

  select count(*) into v_new_media from jsonb_array_elements(v_media) m where m ->> 'source' = 'new';
  v_total := jsonb_array_length(v_media);
  -- O teto vale quando algo é ACRESCENTADO. Itens antigos acima de 6 seguem
  -- válidos enquanto nada novo entra, como sempre foi.
  if v_new_media > 0 and v_total > 6 then
    raise exception 'O prato ficaria com % telas; o limite é 6.', v_total using errcode = 'P0001';
  end if;

  with removed as (
    delete from public.menu_item_media mm
     where mm.item_id = v_item
       and mm.id not in (
         select (m ->> 'id')::uuid from jsonb_array_elements(v_media) m where m ->> 'source' = 'saved'
       )
    returning mm.kind, mm.storage_path, mm.poster_path
  )
  select coalesce(
    jsonb_agg(jsonb_build_object('kind', kind, 'storagePath', storage_path, 'posterPath', poster_path)),
    '[]'::jsonb
  )
    into v_removed
    from removed;

  for v_entry, v_index in
    select value, ordinality - 1 from jsonb_array_elements(v_media) with ordinality
  loop
    if v_entry ->> 'source' = 'saved' then
      update public.menu_item_media set
        position = v_index,
        focal_x = (v_entry ->> 'focalX')::numeric,
        focal_y = (v_entry ->> 'focalY')::numeric
      where id = (v_entry ->> 'id')::uuid;
    else
      -- O caminho foi montado pelo servidor ao autorizar o envio; conferir o
      -- prefixo aqui fecha a porta para registrar arquivo de outro item.
      if left(v_entry ->> 'storagePath', length(v_prefix)) <> v_prefix
         or (v_entry ->> 'posterPath' is not null
             and left(v_entry ->> 'posterPath', length(v_prefix)) <> v_prefix) then
        raise exception 'Caminho de arquivo inválido.' using errcode = 'P0001';
      end if;

      insert into public.menu_item_media (
        restaurant_id, item_id, kind, position, storage_path, poster_path,
        width, height, duration_ms, focal_x, focal_y
      )
      values (
        v_restaurant,
        v_item,
        (v_entry ->> 'kind')::public.media_kind,
        v_index,
        v_entry ->> 'storagePath',
        v_entry ->> 'posterPath',
        (v_entry ->> 'width')::integer,
        (v_entry ->> 'height')::integer,
        (v_entry ->> 'durationMs')::integer,
        (v_entry ->> 'focalX')::numeric,
        (v_entry ->> 'focalY')::numeric
      );
    end if;
  end loop;

  return jsonb_build_object('itemId', v_item, 'removed', v_removed);
end;
$fn$;

revoke all on function public.save_menu_item(jsonb) from public, anon;
grant execute on function public.save_menu_item(jsonb) to authenticated;

notify pgrst, 'reload schema';
