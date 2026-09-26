-- =====================================================================
-- 0002 — Identidade: perfis e administradores da plataforma
--
-- Rode DEPOIS do 0001. Idempotente: pode rodar de novo sem quebrar.
-- =====================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now()
);

-- O perfil nasce junto com o usuario. A aplicacao NUNCA insere em profiles:
-- e o gatilho que garante que todo usuario autenticado tem perfil, sem
-- depender de a aplicacao lembrar de criar.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- SECURITY DEFINER aqui cumpre dois papeis: da a leitura necessaria e,
-- sobretudo, evita recursao infinita quando chamada de dentro de uma
-- politica de RLS. search_path travado fecha search_path injection.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  );
$fn$;
