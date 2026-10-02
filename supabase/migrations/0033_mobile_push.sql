-- =====================================================================
-- 0033 — Push do app do console (Expo)
--
-- O app do console registra o token de push do Expo de cada aparelho. A
-- entrega sai da API Express (POST /api/v1/internal/push/deliver): ela
-- reivindica UMA vez as notificações pendentes e envia nos dois canais,
-- Web Push (push_subscriptions, 0031) e Expo (mobile_push_tokens, aqui).
--
-- Ordem: 0029 → 0030 → 0031 → 0032 → 0033.
-- =====================================================================

-- ---------- tokens do Expo ----------
create table if not exists public.mobile_push_tokens (
  token text primary key
    check (token ~ '^Expo(nent)?PushToken\[[^]]{10,200}\]$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  territory text not null default 'admin' check (territory in ('admin', 'painel')),
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mobile_push_tokens_user_idx
  on public.mobile_push_tokens (user_id, territory, updated_at desc);

alter table public.mobile_push_tokens enable row level security;
revoke all on public.mobile_push_tokens from public, anon, authenticated;

-- ---------- aparelhos da própria pessoa ----------
drop function if exists public.save_mobile_push_token(text, text, text);
create function public.save_mobile_push_token(
  p_token text,
  p_platform text,
  p_territory text default 'admin'
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

  -- O token é do APARELHO. Se outra conta usou este celular antes, a linha
  -- passa a ser de quem está aqui agora.
  insert into public.mobile_push_tokens (token, user_id, territory, platform)
  values (p_token, v_uid, p_territory, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id,
        territory = excluded.territory,
        platform = excluded.platform,
        updated_at = now();

  -- No máximo 10 aparelhos por pessoa e território, como no Web Push.
  delete from public.mobile_push_tokens t
   where t.user_id = v_uid
     and t.territory = p_territory
     and t.token not in (
       select k.token
         from public.mobile_push_tokens k
        where k.user_id = v_uid and k.territory = p_territory
        order by k.updated_at desc
        limit 10
     );
end;
$fn$;

drop function if exists public.delete_mobile_push_token(text);
create function public.delete_mobile_push_token(p_token text)
returns void
language sql
volatile
security definer
set search_path = ''
as $fn$
  delete from public.mobile_push_tokens t
   where t.token = p_token
     and t.user_id = (select auth.uid());
$fn$;

revoke all on function public.save_mobile_push_token(text, text, text) from public, anon;
revoke all on function public.delete_mobile_push_token(text) from public, anon;
grant execute on function public.save_mobile_push_token(text, text, text) to authenticated;
grant execute on function public.delete_mobile_push_token(text) to authenticated;

-- ---------- reivindicação nos dois canais ----------
-- Mesmo comportamento do 0029 (uma vez só, skip locked, até 200 de até 10
-- minutos, limpeza oportunista). Agora devolve uma linha por aparelho de
-- cada canal: 'web' com endpoint e chaves, 'expo' com o token. O
-- restaurant_id e o data vão no push do celular, para o toque abrir a tela
-- certa.
drop function if exists public.claim_notification_pushes(text);
create function public.claim_notification_pushes(p_key text)
returns table (
  notification_id uuid,
  territory text,
  kind text,
  title text,
  body text,
  url text,
  restaurant_id uuid,
  data jsonb,
  channel text,
  endpoint text,
  p256dh text,
  auth text,
  expo_token text,
  platform text
)
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
#variable_conflict use_column
begin
  if not public.check_app_server_key(p_key) then
    raise exception 'server_key' using errcode = '42501';
  end if;

  if random() < 0.01 then
    delete from public.notifications n where n.created_at < now() - interval '90 days';
    update public.notifications n
       set push_claimed_at = now()
     where n.push_claimed_at is null
       and n.created_at <= now() - interval '10 minutes';
  end if;

  return query
  with pending as (
    select n.id
      from public.notifications n
     where n.push_claimed_at is null
       and n.created_at > now() - interval '10 minutes'
     order by n.created_at
     limit 200
     for update skip locked
  ), claimed as (
    update public.notifications n
       set push_claimed_at = now()
      from pending p
     where n.id = p.id
    returning n.id, n.user_id, n.territory, n.kind, n.title, n.body, n.url, n.restaurant_id, n.data
  )
  select c.id, c.territory, c.kind, c.title, c.body, c.url, c.restaurant_id, c.data,
         'web'::text, s.endpoint, s.p256dh, s.auth, null::text, null::text
    from claimed c
    join public.push_subscriptions s
      on s.user_id = c.user_id
     and s.territory = c.territory
  union all
  select c.id, c.territory, c.kind, c.title, c.body, c.url, c.restaurant_id, c.data,
         'expo'::text, null::text, null::text, null::text, m.token, m.platform
    from claimed c
    join public.mobile_push_tokens m
      on m.user_id = c.user_id
     and m.territory = c.territory;
end;
$fn$;

-- Tokens que o Expo deu como mortos (DeviceNotRegistered). Exige a chave,
-- como server_prune_push_subscriptions (0029).
drop function if exists public.server_prune_mobile_push_tokens(text, text[]);
create function public.server_prune_mobile_push_tokens(p_key text, p_tokens text[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
begin
  if not public.check_app_server_key(p_key) then
    raise exception 'server_key' using errcode = '42501';
  end if;
  delete from public.mobile_push_tokens t
   where t.token = any (p_tokens[1:100]);
end;
$fn$;

revoke all on function public.claim_notification_pushes(text) from public;
revoke all on function public.server_prune_mobile_push_tokens(text, text[]) from public;
grant execute on function public.claim_notification_pushes(text) to anon, authenticated;
grant execute on function public.server_prune_mobile_push_tokens(text, text[]) to anon, authenticated;
