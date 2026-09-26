-- =====================================================================
-- 0014 — Escrita no storage também exige administrador
--
-- Rode DEPOIS do 0013. Idempotente: pode rodar de novo sem quebrar.
--
-- O 0011 trocou `is_member` por `is_restaurant_admin` nas quatro tabelas do
-- cardápio e nas plaquinhas, e ESQUECEU de `storage.objects`. O resultado é
-- uma falha aberta numa camada só: pela aplicação o caminho está fechado,
-- porque `createUploadTicket` exige administrador e sem ticket não sai URL
-- assinada — mas garçom, caixa e atendente têm um JWT `authenticated` válido
-- e podem falar com o storage sem passar pelo app.
--
-- A regra do produto é "criar, editar e remover mídia é do administrador", e
-- mídia inclui o ARQUIVO, não só a linha que aponta para ele. Uma RLS mais
-- frouxa que a DAL inverte o desenho de três camadas: a última linha de
-- defesa passa a ser a mais fraca.
--
-- A leitura NÃO muda: o cardápio é público, e continua público.
-- =====================================================================

drop policy if exists menu_media_insert_member on storage.objects;
create policy menu_media_insert_member on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('menu-images', 'menu-videos')
    -- O prefixo do caminho É a fronteira do inquilino, verificada pelo
    -- banco. Quem não administra aquele restaurante não escreve na pasta
    -- dele, independentemente do que a aplicação mande.
    and public.is_restaurant_admin(public.restaurant_id_from_storage_path(name))
  );

drop policy if exists menu_media_update_member on storage.objects;
create policy menu_media_update_member on storage.objects
  for update to authenticated
  using (
    bucket_id in ('menu-images', 'menu-videos')
    and public.is_restaurant_admin(public.restaurant_id_from_storage_path(name))
  )
  with check (
    bucket_id in ('menu-images', 'menu-videos')
    and public.is_restaurant_admin(public.restaurant_id_from_storage_path(name))
  );

drop policy if exists menu_media_delete_member on storage.objects;
create policy menu_media_delete_member on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('menu-images', 'menu-videos')
    and public.is_restaurant_admin(public.restaurant_id_from_storage_path(name))
  );
