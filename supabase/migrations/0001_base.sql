-- =====================================================================
-- 0001 — Base: enums do dominio e gatilho de updated_at
--
-- COMO RODAR: cole este arquivo inteiro no SQL Editor do Supabase e
-- execute. Os arquivos sao numerados e devem rodar EM ORDEM (0001, 0002,
-- ...). Rodar o mesmo arquivo duas vezes e inofensivo: tudo aqui e
-- idempotente, porque o SQL Editor nao guarda estado de migracao e nao
-- sabe o que ja foi aplicado.
--
-- Nenhuma extensao e instalada. sha256(bytea) e convert_to(text, name)
-- sao nativas do pg_catalog desde o Postgres 11 e substituem digest() do
-- pgcrypto; slug e forcado a minusculas por CHECK, o que dispensa citext.
-- Alem de uma dependencia a menos, pg_catalog e mais previsivel do que o
-- schema extensions quando toda funcao roda com search_path travado.
-- =====================================================================

do $enum$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'restaurant_status' and n.nspname = 'public'
  ) then
    create type public.restaurant_status as enum ('draft', 'active', 'suspended');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'membership_role' and n.nspname = 'public'
  ) then
    create type public.membership_role as enum ('owner', 'manager');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'media_kind' and n.nspname = 'public'
  ) then
    create type public.media_kind as enum ('image', 'video');
  end if;
end
$enum$;

-- Gatilho compartilhado de updated_at. O search_path travado fecha
-- search_path injection: sem ele, alguem que consiga criar uma funcao num
-- schema anterior na busca sequestra a execucao com privilegio elevado.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;
