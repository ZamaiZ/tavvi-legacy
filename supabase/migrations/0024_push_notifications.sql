-- =====================================================================
-- 0024 — Notificações push (Web Push com VAPID)
--
-- Rode DEPOIS do 0023. Idempotente.
--
-- push_subscriptions: um aparelho inscrito por linha, POR TERRITÓRIO.
-- painel. e admin. são origens diferentes, cada uma com o próprio service
-- worker e a própria inscrição; aviso do console não cai no painel.
--
-- push_events: o que aconteceu e ainda precisa virar aviso. Nasce no
-- gatilho de memberships, na mesma transação do resgate de convite, e é
-- reivindicado UMA vez por quem resgatou (claim_push_deliveries), em até
-- 10 minutos. Sem redefinir redeem_invite nem redeem_platform_invite.
--
-- As duas tabelas ficam sem política e sem grant. Tudo passa pelas funções
-- abaixo, de escopo estreito, e a chave service_role continua fora da
-- aplicação (ver 0007).
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

create table if not exists public.push_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('team_member_joined', 'restaurant_joined')),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  member_role public.member_role,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

create index if not exists push_events_pending_idx
  on public.push_events (actor_id, created_at)
  where claimed_at is null;

alter table public.push_events enable row level security;
revoke all on public.push_events from public, anon, authenticated;

-- ---------- evento: membership nascida de um convite resgatado ----------
-- O sinal é um convite resgatado NESTA transação pela pessoa da membership
-- (redeemed_at = now() é o instante da transação). Membership criada por
-- outro caminho não gera aviso. record_audit não serve de gatilho: qualquer
-- pessoa autenticada pode chamá-lo e forjaria o evento.
create or replace function public.memberships_push_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if exists (
    select 1 from public.invites i
     where i.redeemed_by = new.user_id
       and i.redeemed_at = now()
       and i.restaurant_id is null
  ) then
    insert into public.push_events (kind, restaurant_id, actor_id)
    values ('restaurant_joined', new.restaurant_id, new.user_id);
  elsif exists (
    select 1 from public.invites i
     where i.redeemed_by = new.user_id
       and i.redeemed_at = now()
       and i.restaurant_id = new.restaurant_id
  ) then
    insert into public.push_events (kind, restaurant_id, actor_id, member_role)
    values ('team_member_joined', new.restaurant_id, new.user_id, new.role);
  end if;
  return null;
end;
$fn$;

revoke all on function public.memberships_push_events() from public, anon, authenticated;

drop trigger if exists memberships_push_events on public.memberships;
create trigger memberships_push_events
  after insert on public.memberships
  for each row execute function public.memberships_push_events();

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
-- a autorização: é uma URL longa e imprevisível que só o dono e quem
-- reivindicou um evento conhecem, e apagar à toa dura até o dono abrir o
-- app, que reinscreve.
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

-- ---------- reivindicar eventos ----------
-- Só quem causou o evento, uma vez, em até 10 minutos. Devolve, por evento,
-- os aparelhos de quem deve saber, sem o próprio autor. Endpoint e chaves
-- não mandam push sem a chave privada VAPID, que só o servidor tem.
drop function if exists public.claim_push_deliveries();
create function public.claim_push_deliveries()
returns table (
  event_id uuid,
  kind text,
  restaurant_id uuid,
  restaurant_name text,
  actor_email text,
  member_role public.member_role,
  endpoint text,
  p256dh text,
  auth text
)
language sql
volatile
security definer
set search_path = ''
as $fn$
  -- Evento que ninguém reivindicou em um dia não vira aviso atrasado.
  delete from public.push_events e
   where e.created_at < now() - interval '1 day';

  with claimed as (
    update public.push_events e
       set claimed_at = now()
     where e.actor_id = (select auth.uid())
       and e.claimed_at is null
       and e.created_at > now() - interval '10 minutes'
    returning e.id, e.kind, e.restaurant_id, e.actor_id, e.member_role
  )
  select c.id, c.kind, c.restaurant_id, r.name, u.email::text, c.member_role,
         s.endpoint, s.p256dh, s.auth
    from claimed c
    join public.restaurants r on r.id = c.restaurant_id
    join auth.users u on u.id = c.actor_id
    join public.push_subscriptions s
      on s.user_id <> c.actor_id
     and (
       (c.kind = 'team_member_joined'
         and s.territory = 'painel'
         and exists (
           select 1 from public.memberships m
            where m.restaurant_id = c.restaurant_id
              and m.user_id = s.user_id
              and m.role = 'admin'))
       or
       (c.kind = 'restaurant_joined'
         and s.territory = 'admin'
         and exists (
           select 1 from public.platform_admins pa
            where pa.user_id = s.user_id))
     );
$fn$;

revoke all on function public.save_push_subscription(text, text, text, text, timestamptz) from public, anon;
revoke all on function public.delete_push_subscription(text) from public, anon;
revoke all on function public.my_push_subscriptions(text) from public, anon;
revoke all on function public.prune_push_subscriptions(text[]) from public, anon;
revoke all on function public.claim_push_deliveries() from public, anon;

grant execute on function public.save_push_subscription(text, text, text, text, timestamptz) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;
grant execute on function public.my_push_subscriptions(text) to authenticated;
grant execute on function public.prune_push_subscriptions(text[]) to authenticated;
grant execute on function public.claim_push_deliveries() to authenticated;

notify pgrst, 'reload schema';
