-- =====================================================================
-- 0026 — Nome do perfil obrigatório
--
-- Rode DEPOIS do 0025. Idempotente: pode rodar de novo sem quebrar.
--
-- Até aqui nenhum cadastro mandava `display_name` nos metadados, e todo
-- perfil nascia com o nome nulo. O cadastro passa a enviar o nome; o gatilho
-- garante um valor mesmo quando a conta nasce por outro caminho (painel do
-- Supabase, API direta): o nome informado, senão a parte do e-mail antes do
-- @, senão "Usuário".
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(left(btrim(new.raw_user_meta_data ->> 'display_name'), 80)), ''),
      nullif(left(split_part(new.email, '@', 1), 80), ''),
      'Usuário'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$fn$;

-- Perfis que já existem: a mesma regra do gatilho, só onde o nome está
-- vazio ou passa do limite.
update public.profiles p
   set display_name = coalesce(
         nullif(btrim(left(btrim(p.display_name), 80)), ''),
         nullif(left(split_part(u.email, '@', 1), 80), ''),
         'Usuário'
       )
  from auth.users u
 where u.id = p.id
   and (p.display_name is null
        or btrim(p.display_name) = ''
        or char_length(p.display_name) > 80);

alter table public.profiles alter column display_name set not null;

alter table public.profiles drop constraint if exists profiles_display_name_length;
alter table public.profiles add constraint profiles_display_name_length
  check (char_length(display_name) between 1 and 80 and btrim(display_name) <> '');

notify pgrst, 'reload schema';
