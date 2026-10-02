-- =====================================================================
-- 0029 — Notificações genéricas, chave de servidor e push pelo disparador
--
-- Rode DEPOIS do 0028. Idempotente.
--
-- app_server_keys: o hash da chave que só o servidor do Next conhece
-- (APP_SERVER_KEY). Funções de escopo estreito a exigem; ela não ignora
-- RLS nem abre mais nada. A service_role continua fora (ver 0007).
--
-- notifications: uma linha por destinatário e por território. Nasce só
-- pelo dispatch_notification, que calcula quem recebe a partir dos
-- parâmetros. O gatilho de broadcast entrega em tempo real no canal
-- privado notifications:<territory>:<user_id>.
--
-- Substitui o push_events do 0024: o resgate de convite passa a chamar o
-- disparador, e o push sai de claim_notification_pushes.
--
-- Depois de aplicar: Realtime → Settings → desligar "Allow public access",
-- e rodar select public.set_app_server_key('<APP_SERVER_KEY>'); no editor
-- de SQL (docs/deployment/monorepo.md).
-- =====================================================================

-- ---------- chave de servidor ----------
create table if not exists public.app_server_keys (
  name text primary key check (char_length(name) between 1 and 40),
  key_hash bytea not null,
  updated_at timestamptz not null default now()
);

alter table public.app_server_keys enable row level security;
revoke all on public.app_server_keys from public, anon, authenticated;

-- Roda pelo editor de SQL do Supabase, nunca pela aplicação: recebe a
-- chave em claro uma vez e guarda só o hash.
create or replace function public.set_app_server_key(p_key text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
begin
  if p_key is null or char_length(p_key) < 32 then
    raise exception 'a chave precisa de ao menos 32 caracteres';
  end if;
  insert into public.app_server_keys (name, key_hash, updated_at)
  values ('server', sha256(convert_to(p_key, 'UTF8')), now())
  on conflict (name) do update
    set key_hash = excluded.key_hash, updated_at = now();
end;
$fn$;

revoke all on function public.set_app_server_key(text) from public, anon, authenticated;

-- Recebe a chave EM CLARO e calcula o hash aqui dentro, pelo mesmo motivo
-- do preview_invite (0007): aceitar o hash faria um vazamento do banco
-- entregar algo diretamente utilizável.
create or replace function public.check_app_server_key(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select p_key is not null and exists (
    select 1 from public.app_server_keys k
     where k.name = 'server'
       and k.key_hash = sha256(convert_to(p_key, 'UTF8'))
  );
$fn$;

revoke all on function public.check_app_server_key(text) from public, anon, authenticated;

-- ---------- notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  territory text not null check (territory in ('admin', 'painel')),
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  kind text not null
    check (kind in ('feedback_received', 'team_member_joined', 'restaurant_joined')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  url text not null
    check (char_length(url) between 2 and 300 and url like '/%' and url not like '//%'),
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  push_claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_feed_idx
  on public.notifications (user_id, territory, created_at desc, id desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, territory)
  where read_at is null;
create index if not exists notifications_push_pending_idx
  on public.notifications (created_at)
  where push_claimed_at is null;
create index if not exists notifications_feedback_idx
  on public.notifications ((data ->> 'feedbackId'))
  where kind = 'feedback_received';

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
-- A pessoa só marca como lida. Título, corpo, destino e dono não mudam.
grant update (read_at) on public.notifications to authenticated;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------- disparador ----------
-- Calcula os destinatários a partir dos parâmetros e grava uma linha por
-- pessoa. Ninguém de fora chama: só funções security definer e gatilhos.
-- Título e corpo são cortados aqui, para um nome de restaurante longo
-- nunca derrubar a operação que disparou o aviso.
drop function if exists public.dispatch_notification(
  text, text, text, text, text, text, uuid, public.member_role[], uuid[], uuid, jsonb
);
create function public.dispatch_notification(
  p_kind text,
  p_territory text,
  p_audience text,
  p_title text,
  p_body text,
  p_url text,
  p_restaurant_id uuid default null,
  p_roles public.member_role[] default null,
  p_user_ids uuid[] default null,
  p_exclude_user uuid default null,
  p_data jsonb default '{}'::jsonb
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_count integer;
begin
  if p_audience in ('restaurant_roles', 'restaurant_members') then
    if p_territory is distinct from 'painel' or p_restaurant_id is null then
      raise exception 'notification_audience' using detail = p_audience;
    end if;
    if p_audience = 'restaurant_roles' and coalesce(cardinality(p_roles), 0) = 0 then
      raise exception 'notification_audience' using detail = 'restaurant_roles sem papéis';
    end if;
  elsif p_audience = 'platform_admins' then
    if p_territory is distinct from 'admin' then
      raise exception 'notification_audience' using detail = p_audience;
    end if;
  elsif p_audience = 'users' then
    if p_territory not in ('admin', 'painel') or coalesce(cardinality(p_user_ids), 0) = 0 then
      raise exception 'notification_audience' using detail = p_audience;
    end if;
  else
    raise exception 'notification_audience' using detail = coalesce(p_audience, 'nulo');
  end if;

  with recipients as (
    select m.user_id
      from public.memberships m
     where p_audience = 'restaurant_roles'
       and m.restaurant_id = p_restaurant_id
       and m.role = any (p_roles)
    union
    select m.user_id
      from public.memberships m
     where p_audience = 'restaurant_members'
       and m.restaurant_id = p_restaurant_id
    union
    select pa.user_id
      from public.platform_admins pa
     where p_audience = 'platform_admins'
    union
    select p.id
      from public.profiles p
     where p_audience = 'users'
       and p.id = any (p_user_ids)
       -- No painel, aviso sobre um restaurante só vai para quem é dele.
       and (
         p_territory = 'admin'
         or p_restaurant_id is null
         or exists (
           select 1 from public.memberships m
            where m.restaurant_id = p_restaurant_id and m.user_id = p.id
         )
       )
  )
  insert into public.notifications
    (user_id, territory, restaurant_id, kind, title, body, url, data)
  select r.user_id, p_territory, p_restaurant_id, p_kind,
         left(p_title, 120), left(p_body, 500), p_url, coalesce(p_data, '{}'::jsonb)
    from recipients r
   where r.user_id is distinct from p_exclude_user;

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

revoke all on function public.dispatch_notification(
  text, text, text, text, text, text, uuid, public.member_role[], uuid[], uuid, jsonb
) from public, anon, authenticated;

-- ---------- tempo real ----------
-- O tempo real é um extra. Falhar nele não pode desfazer a gravação que
-- disparou o aviso (um feedback publicado, um convite resgatado).
create or replace function public.notifications_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  begin
    perform realtime.broadcast_changes(
      'notifications:' || coalesce(new.territory, old.territory) || ':'
        || coalesce(new.user_id, old.user_id)::text,
      tg_op,
      tg_op,
      tg_table_name,
      tg_table_schema,
      new,
      old
    );
  exception when others then
    raise warning 'notifications_broadcast: %', sqlerrm;
  end;
  return null;
end;
$fn$;

revoke all on function public.notifications_broadcast() from public, anon, authenticated;

drop trigger if exists notifications_broadcast on public.notifications;
create trigger notifications_broadcast
  after insert or update or delete on public.notifications
  for each row execute function public.notifications_broadcast();

-- Cada pessoa escuta só os próprios dois canais. A referência do zamai.os
-- usava `extension = 'broadcast'` sozinho, o que deixava qualquer usuário
-- logado assinar o canal de outro. Sem política de INSERT: o navegador não
-- publica nesses tópicos. A RLS de realtime.messages já vem ligada; rodar
-- ENABLE aqui falharia com 42501.
drop policy if exists notifications_receive_own_topic on realtime.messages;
create policy notifications_receive_own_topic on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) in (
      'notifications:painel:' || (select auth.uid())::text,
      'notifications:admin:' || (select auth.uid())::text
    )
  );

-- ---------- push ----------
-- Reivindica UMA vez as notificações recentes ainda sem push e devolve os
-- aparelhos de cada destinatário no mesmo território. `skip locked` impede
-- duas chamadas simultâneas de pegarem a mesma linha. Endpoint e chaves não
-- mandam push sem a chave privada VAPID, que só o servidor tem.
drop function if exists public.claim_notification_pushes(text);
create function public.claim_notification_pushes(p_key text)
returns table (
  notification_id uuid,
  territory text,
  kind text,
  title text,
  body text,
  url text,
  endpoint text,
  p256dh text,
  auth text
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

  -- Limpeza oportunista, como em check_rate_limit (0005): em cerca de 1%
  -- das chamadas, apaga o que passou de 90 dias e dá por perdido o push
  -- que ninguém reivindicou em 10 minutos.
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
    returning n.id, n.user_id, n.territory, n.kind, n.title, n.body, n.url
  )
  select c.id, c.territory, c.kind, c.title, c.body, c.url, s.endpoint, s.p256dh, s.auth
    from claimed c
    join public.push_subscriptions s
      on s.user_id = c.user_id
     and s.territory = c.territory;
end;
$fn$;

-- O push de um feedback parte do território público, sem sessão. A
-- prune_push_subscriptions do 0024 exige sessão; esta exige a chave.
drop function if exists public.server_prune_push_subscriptions(text, text[]);
create function public.server_prune_push_subscriptions(p_key text, p_endpoints text[])
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
  delete from public.push_subscriptions s
   where s.endpoint = any (p_endpoints[1:100]);
end;
$fn$;

revoke all on function public.claim_notification_pushes(text) from public;
revoke all on function public.server_prune_push_subscriptions(text, text[]) from public;
grant execute on function public.claim_notification_pushes(text) to anon, authenticated;
grant execute on function public.server_prune_push_subscriptions(text, text[]) to anon, authenticated;

-- ---------- resgate de convite → disparador ----------
-- O mesmo sinal do 0024: um convite resgatado NESTA transação pela pessoa
-- da membership (redeemed_at = now() é o instante da transação).
drop trigger if exists memberships_push_events on public.memberships;
drop function if exists public.memberships_push_events();

create or replace function public.memberships_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_restaurant_name text;
  v_email text;
  v_role_label text;
begin
  select r.name into v_restaurant_name
    from public.restaurants r where r.id = new.restaurant_id;
  select u.email::text into v_email
    from auth.users u where u.id = new.user_id;
  v_email := coalesce(v_email, 'Alguém');

  begin
    if exists (
      select 1 from public.invites i
       where i.redeemed_by = new.user_id
         and i.redeemed_at = now()
         and i.restaurant_id is null
    ) then
      perform public.dispatch_notification(
        'restaurant_joined', 'admin', 'platform_admins',
        'Novo restaurante na Tavvi',
        coalesce(v_restaurant_name, 'Um restaurante') || ' aceitou o convite (' || v_email || ').',
        '/restaurantes/' || new.restaurant_id::text,
        p_restaurant_id => new.restaurant_id,
        p_exclude_user => new.user_id,
        p_data => jsonb_build_object('restaurantId', new.restaurant_id)
      );
    elsif exists (
      select 1 from public.invites i
       where i.redeemed_by = new.user_id
         and i.redeemed_at = now()
         and i.restaurant_id = new.restaurant_id
    ) then
      -- Os mesmos rótulos de MEMBER_ROLE_LABELS (domain/invite.ts), em minúsculas.
      v_role_label := case new.role
        when 'admin' then 'administrador'
        when 'cashier' then 'caixa'
        when 'attendant' then 'atendente'
        when 'waiter' then 'garçom'
        else 'membro'
      end;
      perform public.dispatch_notification(
        'team_member_joined', 'painel', 'restaurant_roles',
        'Novo membro em ' || coalesce(v_restaurant_name, 'seu restaurante'),
        v_email || ' entrou na equipe como ' || v_role_label || '.',
        '/restaurantes/' || new.restaurant_id::text || '/equipe',
        p_restaurant_id => new.restaurant_id,
        p_roles => array['admin']::public.member_role[],
        p_exclude_user => new.user_id,
        p_data => jsonb_build_object('restaurantId', new.restaurant_id)
      );
    end if;
  exception when others then
    -- O aviso nunca desfaz o resgate.
    raise warning 'memberships_notify: %', sqlerrm;
  end;
  return null;
end;
$fn$;

revoke all on function public.memberships_notify() from public, anon, authenticated;

drop trigger if exists memberships_notify on public.memberships;
create trigger memberships_notify
  after insert on public.memberships
  for each row execute function public.memberships_notify();

-- ---------- o push antigo sai ----------
drop function if exists public.claim_push_deliveries();
drop table if exists public.push_events;

notify pgrst, 'reload schema';
