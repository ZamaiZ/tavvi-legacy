-- =====================================================================
-- 0008 — Storage: buckets de midia e fronteira por prefixo de caminho
--
-- Rode DEPOIS do 0007. Idempotente.
-- =====================================================================

-- Dois buckets em vez de um porque o limite de tamanho e a lista de tipos
-- aceitos sao configuracao DO BUCKET, aplicada pelo proprio Supabase no
-- servidor -- nao dependem de codigo nosso. Com um bucket so, o teto teria
-- que ser o maior dos dois e alguem subiria uma "foto" de 10 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('menu-images', 'menu-images', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('menu-videos', 'menu-videos', true, 10485760,
   array['video/mp4', 'video/webm'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Extrai o id do restaurante do prefixo do caminho. Devolve null quando o
-- caminho nao comeca com um uuid, para que a politica NEGUE em vez de
-- levantar erro de conversao -- politica que estoura em vez de negar e
-- uma falha aberta disfarcada de erro.
create or replace function public.restaurant_id_from_storage_path(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $fn$
declare
  v_first text := split_part(p_name, '/', 1);
begin
  return v_first::uuid;
exception when others then
  return null;
end;
$fn$;

-- Leitura publica: o cardapio e publico.
drop policy if exists menu_media_select_public on storage.objects;
create policy menu_media_select_public on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('menu-images', 'menu-videos'));

-- Escrita: o prefixo do caminho E a fronteira do inquilino, verificada
-- pelo banco. Quem nao e membro daquele restaurante nao escreve na pasta
-- dele, independentemente do que a aplicacao mande.
drop policy if exists menu_media_insert_member on storage.objects;
create policy menu_media_insert_member on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('menu-images', 'menu-videos')
    and public.is_member(public.restaurant_id_from_storage_path(name))
  );

drop policy if exists menu_media_update_member on storage.objects;
create policy menu_media_update_member on storage.objects
  for update to authenticated
  using (
    bucket_id in ('menu-images', 'menu-videos')
    and public.is_member(public.restaurant_id_from_storage_path(name))
  )
  with check (
    bucket_id in ('menu-images', 'menu-videos')
    and public.is_member(public.restaurant_id_from_storage_path(name))
  );

drop policy if exists menu_media_delete_member on storage.objects;
create policy menu_media_delete_member on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('menu-images', 'menu-videos')
    and public.is_member(public.restaurant_id_from_storage_path(name))
  );
