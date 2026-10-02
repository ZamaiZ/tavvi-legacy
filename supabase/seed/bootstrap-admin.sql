-- =====================================================================
-- BOOTSTRAP DO PRIMEIRO ADMINISTRADOR DA PLATAFORMA
--
-- Passo MANUAL, executado uma unica vez por ambiente.
--
-- Nao existe caminho na aplicacao que promova alguem a administrador, e
-- isso e de proposito: uma porta de promocao de privilegio dentro do
-- codigo seria exatamente o que um atacante procuraria primeiro.
--
-- COMO USAR:
--   1. Crie sua conta pelo fluxo de cadastro Web ou em Authentication > Users
--      no painel do Supabase.
--   2. Troque o e-mail na linha marcada abaixo pelo seu.
--   3. Cole este arquivo inteiro no SQL Editor e execute.
--   4. Confira na listagem do final que voce aparece.
-- =====================================================================

with alvo as (
  -- >>> TROQUE O E-MAIL ABAIXO PELO SEU <<<
  select 'eduardozamai@gmail.com'::text as email
)
insert into public.platform_admins (user_id)
select u.id
from auth.users u
cross join alvo a
where lower(u.email) = lower(a.email)
on conflict (user_id) do nothing;

-- Confirmacao: quem e administrador da plataforma hoje.
select u.email, pa.granted_at
from public.platform_admins pa
join auth.users u on u.id = pa.user_id
order by pa.granted_at;
