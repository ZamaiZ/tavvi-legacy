-- =====================================================================
-- 0010 — Capa do video
--
-- Rode DEPOIS do 0009. Idempotente: pode rodar de novo sem quebrar.
--
-- O CHECK espelha o que storage_path ja tem. Sem ele, a capa poderia
-- apontar para fora da pasta do restaurante -- a fronteira do inquilino
-- vale para todo caminho de arquivo, nao so para o principal.
-- =====================================================================

alter table public.menu_item_media
  add column if not exists poster_path text;

do $guard$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'menu_item_media_poster_prefix'
      and conrelid = 'public.menu_item_media'::regclass
  ) then
    alter table public.menu_item_media
      add constraint menu_item_media_poster_prefix
      check (poster_path is null or poster_path like restaurant_id::text || '/%');
  end if;
end
$guard$;
