-- =====================================================================
-- 0006 — Row Level Security: a ultima linha de defesa
--
-- Rode DEPOIS do 0005. Idempotente: cada politica e removida antes de ser
-- recriada, entao rodar de novo apenas reescreve as mesmas regras.
--
-- Depois desta migracao, TODA tabela nega por padrao. Ausencia de politica
-- nao e permissao esquecida: e negacao. So passa o que esta escrito aqui.
-- =====================================================================

alter table public.profiles            enable row level security;
alter table public.platform_admins     enable row level security;
alter table public.restaurants         enable row level security;
alter table public.memberships         enable row level security;
alter table public.invites             enable row level security;
alter table public.menu_tags           enable row level security;
alter table public.menu_categories     enable row level security;
alter table public.menu_items          enable row level security;
alter table public.menu_item_variants  enable row level security;
alter table public.menu_item_media     enable row level security;
alter table public.audit_log           enable row level security;
alter table public.rate_limit_counters enable row level security;

-- profiles -------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_platform_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- platform_admins ------------------------------------------------------
-- Sem INSERT, UPDATE ou DELETE: nao existe caminho na aplicacao que
-- promova alguem a administrador. So o seed manual de bootstrap.
drop policy if exists platform_admins_select on public.platform_admins;
create policy platform_admins_select on public.platform_admins
  for select to authenticated
  using (public.is_platform_admin());

-- restaurants ----------------------------------------------------------
drop policy if exists restaurants_select_public on public.restaurants;
create policy restaurants_select_public on public.restaurants
  for select to anon, authenticated
  using (status = 'active' and deleted_at is null);

drop policy if exists restaurants_select_member on public.restaurants;
create policy restaurants_select_member on public.restaurants
  for select to authenticated
  using (public.is_member(id) or public.is_platform_admin());

drop policy if exists restaurants_insert_admin on public.restaurants;
create policy restaurants_insert_admin on public.restaurants
  for insert to authenticated
  with check (public.is_platform_admin());

drop policy if exists restaurants_update on public.restaurants;
create policy restaurants_update on public.restaurants
  for update to authenticated
  using (public.is_owner(id) or public.is_platform_admin())
  with check (public.is_owner(id) or public.is_platform_admin());

-- Sem politica de DELETE: remover restaurante e impossivel pela
-- aplicacao. A remocao e logica, via deleted_at, e so pela plataforma.

-- memberships ----------------------------------------------------------
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists memberships_insert_admin on public.memberships;
create policy memberships_insert_admin on public.memberships
  for insert to authenticated
  with check (public.is_platform_admin());

drop policy if exists memberships_update_admin on public.memberships;
create policy memberships_update_admin on public.memberships
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete on public.memberships
  for delete to authenticated
  using (public.is_owner(restaurant_id) or public.is_platform_admin());

-- invites --------------------------------------------------------------
drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites
  for select to authenticated
  using (public.is_owner(restaurant_id) or public.is_platform_admin());

drop policy if exists invites_insert_admin on public.invites;
create policy invites_insert_admin on public.invites
  for insert to authenticated
  with check (public.is_platform_admin());

drop policy if exists invites_update_admin on public.invites;
create policy invites_update_admin on public.invites
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- menu_tags ------------------------------------------------------------
-- Anonimo nao enxerga NADA aqui. A resolucao de /t/{token} passa pela
-- funcao resolve_menu_tag do 0007, o que impede enumerar as plaquinhas
-- de todos os restaurantes.
drop policy if exists menu_tags_select_member on public.menu_tags;
create policy menu_tags_select_member on public.menu_tags
  for select to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_tags_insert_admin on public.menu_tags;
create policy menu_tags_insert_admin on public.menu_tags
  for insert to authenticated
  with check (public.is_platform_admin());

drop policy if exists menu_tags_update_member on public.menu_tags;
create policy menu_tags_update_member on public.menu_tags
  for update to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin())
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_tags_delete_admin on public.menu_tags;
create policy menu_tags_delete_admin on public.menu_tags
  for delete to authenticated
  using (public.is_platform_admin());

-- menu_categories ------------------------------------------------------
drop policy if exists menu_categories_select_public on public.menu_categories;
create policy menu_categories_select_public on public.menu_categories
  for select to anon, authenticated
  using (is_visible and public.is_restaurant_public(restaurant_id));

drop policy if exists menu_categories_select_member on public.menu_categories;
create policy menu_categories_select_member on public.menu_categories
  for select to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_categories_insert on public.menu_categories;
create policy menu_categories_insert on public.menu_categories
  for insert to authenticated
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_categories_update on public.menu_categories;
create policy menu_categories_update on public.menu_categories
  for update to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin())
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_categories_delete on public.menu_categories;
create policy menu_categories_delete on public.menu_categories
  for delete to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

-- menu_items -----------------------------------------------------------
drop policy if exists menu_items_select_public on public.menu_items;
create policy menu_items_select_public on public.menu_items
  for select to anon, authenticated
  using (
    is_visible
    and public.is_restaurant_public(restaurant_id)
    and public.is_category_visible(category_id)
  );

drop policy if exists menu_items_select_member on public.menu_items;
create policy menu_items_select_member on public.menu_items
  for select to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_items_insert on public.menu_items;
create policy menu_items_insert on public.menu_items
  for insert to authenticated
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_items_update on public.menu_items;
create policy menu_items_update on public.menu_items
  for update to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin())
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_items_delete on public.menu_items;
create policy menu_items_delete on public.menu_items
  for delete to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

-- menu_item_variants ---------------------------------------------------
drop policy if exists menu_item_variants_select_public on public.menu_item_variants;
create policy menu_item_variants_select_public on public.menu_item_variants
  for select to anon, authenticated
  using (public.is_menu_item_public(item_id));

drop policy if exists menu_item_variants_select_member on public.menu_item_variants;
create policy menu_item_variants_select_member on public.menu_item_variants
  for select to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_variants_insert on public.menu_item_variants;
create policy menu_item_variants_insert on public.menu_item_variants
  for insert to authenticated
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_variants_update on public.menu_item_variants;
create policy menu_item_variants_update on public.menu_item_variants
  for update to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin())
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_variants_delete on public.menu_item_variants;
create policy menu_item_variants_delete on public.menu_item_variants
  for delete to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

-- menu_item_media ------------------------------------------------------
drop policy if exists menu_item_media_select_public on public.menu_item_media;
create policy menu_item_media_select_public on public.menu_item_media
  for select to anon, authenticated
  using (public.is_menu_item_public(item_id));

drop policy if exists menu_item_media_select_member on public.menu_item_media;
create policy menu_item_media_select_member on public.menu_item_media
  for select to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_media_insert on public.menu_item_media;
create policy menu_item_media_insert on public.menu_item_media
  for insert to authenticated
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_media_update on public.menu_item_media;
create policy menu_item_media_update on public.menu_item_media
  for update to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin())
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_media_delete on public.menu_item_media;
create policy menu_item_media_delete on public.menu_item_media
  for delete to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

-- audit_log ------------------------------------------------------------
-- Sem politica de INSERT: so record_audit escreve aqui. Sem UPDATE nem
-- DELETE: log que pode ser editado nao serve como log.
drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using (public.is_platform_admin());

-- rate_limit_counters --------------------------------------------------
-- Nenhuma politica, de proposito. RLS ligada sem politica nega tudo, e o
-- acesso acontece exclusivamente por check_rate_limit.
