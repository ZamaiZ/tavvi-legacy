-- =====================================================================
-- 0031 — Inscrições de push (recuperação do 0024)
--
-- Rode DEPOIS do 0030. Idempotente: em banco que já tem o 0024, não muda
-- nada além de recriar as mesmas funções.
--
-- Por quê: num ambiente, o 0024 nunca foi aplicado, e "Ativar
-- notificações" falhava com save_push_subscription inexistente. Aplicar o
-- 0024 agora seria errado: ele recriaria push_events, claim_push_deliveries
-- e o gatilho memberships_push_events, que o 0029 substituiu pelo
-- disparador genérico. Este arquivo traz só a parte das inscrições, igual
-- ao 0024.
-- =====================================================================

create table if not exists public.push_subscriptions (
  endpoint text primary key
    check (char_length(endpoint) between 9 and 2048 and endpoint like 'https://%'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  territory text not null check (territory in ('admin', 'painel')),
  p256dh text not null check (char_length(p256dh) between 1 and 512),
  auth text not null check (char_length(auth) between 1 and 512),
  expiration_time timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id, territory, updated_at desc);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;

-- ---------- inscrições da própria pessoa ----------
drop function if exists public.save_push_subscription(text, text, text, text, timestamptz);
create function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_territory text,
  p_expiration_time timestamptz default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'sessao ausente' using errcode = '42501';
  end if;

  -- O endpoint é do APARELHO. Se outra conta usou este navegador antes, a
  -- linha passa a ser de quem está aqui agora.
  insert into public.push_subscriptions
    (endpoint, user_id, territory, p256dh, auth, expiration_time)
  values
    (p_endpoint, v_uid, p_territory, p_p256dh, p_auth, p_expiration_time)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        territory = excluded.territory,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        expiration_time = excluded.expiration_time,
        updated_at = now();

  -- No máximo 10 aparelhos por pessoa e território: navegador esquecido não
  -- acumula para sempre.
  delete from public.push_subscriptions s
   where s.user_id = v_uid
     and s.territory = p_territory
     and s.endpoint not in (
       select k.endpoint
         from public.push_subscriptions k
        where k.user_id = v_uid and k.territory = p_territory
        order by k.updated_at desc
        limit 10
     );
end;
$fn$;

drop function if exists public.delete_push_subscription(text);
create function public.delete_push_subscription(p_endpoint text)
returns void
language sql
volatile
security definer
set search_path = ''
as $fn$
  delete from public.push_subscriptions s
   where s.endpoint = p_endpoint
     and s.user_id = (select auth.uid());
$fn$;

drop function if exists public.my_push_subscriptions(text);
create function public.my_push_subscriptions(p_territory text)
returns table (endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = ''
as $fn$
  select s.endpoint, s.p256dh, s.auth
    from public.push_subscriptions s
   where s.user_id = (select auth.uid())
     and s.territory = p_territory;
$fn$;

-- O serviço de push respondeu 404/410: o aparelho saiu. Saber o endpoint é
-- a autorização: é uma URL longa e imprevisível que só o dono conhece, e
-- apagar à toa dura até o dono abrir o app, que reinscreve.
drop function if exists public.prune_push_subscriptions(text[]);
create function public.prune_push_subscriptions(p_endpoints text[])
returns void
language sql
volatile
security definer
set search_path = ''
as $fn$
  delete from public.push_subscriptions s
   where (select auth.uid()) is not null
     and s.endpoint = any (p_endpoints[1:100]);
$fn$;

revoke all on function public.save_push_subscription(text, text, text, text, timestamptz) from public, anon;
revoke all on function public.delete_push_subscription(text) from public, anon;
revoke all on function public.my_push_subscriptions(text) from public, anon;
revoke all on function public.prune_push_subscriptions(text[]) from public, anon;

grant execute on function public.save_push_subscription(text, text, text, text, timestamptz) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;
grant execute on function public.my_push_subscriptions(text) to authenticated;
grant execute on function public.prune_push_subscriptions(text[]) to authenticated;

notify pgrst, 'reload schema';
