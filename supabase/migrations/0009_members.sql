-- =====================================================================
-- 0009 — Listagem de membros com e-mail
--
-- Rode DEPOIS do 0008. Idempotente: pode rodar de novo sem quebrar.
--
-- O e-mail vive em auth.users, que o PostgREST nao expoe -- e e o e-mail
-- que identifica a pessoa de verdade, porque display_name pode estar
-- vazio. Havia dois caminhos: copiar o e-mail para profiles e mante-lo
-- sincronizado, ou ler de auth.users por uma funcao privilegiada. O
-- segundo evita guardar o mesmo dado em dois lugares, que e como dado
-- desatualizado nasce.
--
-- Como SECURITY DEFINER ignora a RLS, a autorizacao e feita
-- EXPLICITAMENTE no WHERE. Sem ela, qualquer autenticado listaria a
-- equipe de qualquer restaurante.
-- =====================================================================

drop function if exists public.list_restaurant_members(uuid);
create function public.list_restaurant_members(p_restaurant_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  display_name text,
  member_role public.membership_role,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $fn$
  select m.id, m.user_id, u.email::text, p.display_name, m.role, m.created_at
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.restaurant_id = p_restaurant_id
    and (
      public.is_member(p_restaurant_id)
      or public.is_platform_admin()
    )
  order by m.created_at;
$fn$;

grant execute on function public.list_restaurant_members(uuid) to authenticated;
