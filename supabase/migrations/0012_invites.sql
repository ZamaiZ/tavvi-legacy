-- =====================================================================
-- 0012 — Convite de plataforma: o restaurante nasce do resgate
--
-- Rode DEPOIS do 0011. Idempotente: pode rodar de novo sem quebrar.
--
-- restaurant_id anulável passa a ter SIGNIFICADO:
--   nulo        -> convite de plataforma. Resgatar CRIA um restaurante.
--   preenchido  -> convite de equipe. Resgatar só insere o vínculo.
--
-- Duas tabelas separadas foram consideradas e recusadas: duplicariam o
-- manejo de token, que é a parte sensível. A diferença real é uma coluna.
-- =====================================================================

alter table public.invites alter column restaurant_id drop not null;

-- Convite sem restaurante SEMPRE cria um administrador. Não existe convite de
-- plataforma que produza garçom: não haveria restaurante para ele servir.
alter table public.invites drop constraint if exists invites_platform_role;
alter table public.invites add constraint invites_platform_role
  check (restaurant_id is not null or role = 'admin');

-- ---------- políticas ----------
-- Repare que a forma simples basta, e por quê: is_restaurant_admin(null)
-- devolve FALSO, porque `restaurant_id = null` nunca é verdadeiro num EXISTS.
-- Então um administrador de restaurante tentando inserir um convite de
-- plataforma cai em `falso or falso` e é recusado, sem precisar de CASE.
drop policy if exists invites_insert_admin on public.invites;
drop policy if exists invites_insert on public.invites;
create policy invites_insert on public.invites
  for insert to authenticated
  with check (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites
  for select to authenticated
  using (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

drop policy if exists invites_update_admin on public.invites;
drop policy if exists invites_update on public.invites;
create policy invites_update on public.invites
  for update to authenticated
  using (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin())
  with check (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

-- ---------- preview: agora diz de que TIPO é o convite ----------
-- Continua devolvendo ZERO linhas para token desconhecido, vencido, revogado
-- OU já usado. As quatro situações são indistinguíveis de fora, o que impede
-- descobrir que um convite existe.
--
-- `left join` porque convite de plataforma não tem restaurante: com join
-- interno ele sumiria do resultado e a tela diria "convite inválido" para um
-- convite perfeitamente bom.
drop function if exists public.preview_invite(text);
create function public.preview_invite(p_token text)
returns table (
  invite_kind text,
  restaurant_name text,
  invite_role public.member_role
)
language sql
stable
security definer
set search_path = ''
as $fn$
  select
    case when i.restaurant_id is null then 'platform' else 'team' end,
    r.name,
    i.role
  from public.invites i
  left join public.restaurants r on r.id = i.restaurant_id
  where i.token_hash = sha256(convert_to(p_token, 'UTF8'))
    and i.expires_at > now()
    and i.redeemed_at is null
    and i.revoked_at is null;
$fn$;

-- ---------- resgate de equipe: agora EXIGE restaurante ----------
-- Sem esta linha, um convite de plataforma resgatado por aqui marcaria o
-- convite como usado e não criaria restaurante nenhum — queimando o convite e
-- deixando a pessoa sem nada.
drop function if exists public.redeem_invite(text);
create function public.redeem_invite(p_token text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_invite public.invites%rowtype;
begin
  if v_uid is null then
    raise exception 'convite invalido' using errcode = '42501';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  -- A corrida entre dois cliques simultâneos no mesmo link é resolvida aqui
  -- pelo próprio Postgres: só uma transação encontra redeemed_at ainda nulo.
  -- Sem lock na aplicação, sem janela entre checar e gravar.
  update public.invites i
     set redeemed_at = now(),
         redeemed_by = v_uid
   where i.token_hash = sha256(convert_to(p_token, 'UTF8'))
     and i.expires_at > now()
     and i.redeemed_at is null
     and i.revoked_at is null
     and i.restaurant_id is not null
     and (i.email is null or lower(i.email) = lower(v_email))
  returning i.* into v_invite;

  if not found then
    raise exception 'convite invalido' using errcode = '42501';
  end if;

  insert into public.memberships (restaurant_id, user_id, role)
  values (v_invite.restaurant_id, v_uid, v_invite.role)
  on conflict (restaurant_id, user_id) do nothing;

  perform public.record_audit(
    'invite.redeemed', 'invite', v_invite.id, v_invite.restaurant_id,
    jsonb_build_object('kind', 'team', 'role', v_invite.role)
  );

  return v_invite.restaurant_id;
end;
$fn$;

-- ---------- resgate de plataforma: cria o restaurante ----------
-- Esta função é o coração da fase. Ela roda com privilégio elevado, o que
-- significa que o INSERT em restaurants passa mesmo com a política
-- restaurants_insert_admin fechada. É DELIBERADO: a política continua negando
-- para todo mundo, e o único caminho que cria restaurante é este. Ninguém
-- ganha o direito de criar; ganha o direito de resgatar.
drop function if exists public.redeem_platform_invite(text, text, text);
create function public.redeem_platform_invite(
  p_token text,
  p_name text,
  p_slug text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_invite public.invites%rowtype;
  v_restaurant_id uuid;
begin
  if v_uid is null then
    raise exception 'convite invalido' using errcode = '42501';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  update public.invites i
     set redeemed_at = now(),
         redeemed_by = v_uid
   where i.token_hash = sha256(convert_to(p_token, 'UTF8'))
     and i.expires_at > now()
     and i.redeemed_at is null
     and i.revoked_at is null
     and i.restaurant_id is null
     and (i.email is null or lower(i.email) = lower(v_email))
  returning i.* into v_invite;

  if not found then
    raise exception 'convite invalido' using errcode = '42501';
  end if;

  begin
    insert into public.restaurants (slug, name, status, created_by)
    values (p_slug, p_name, 'draft', v_uid)
    returning id into v_restaurant_id;
  exception
    when unique_violation then
      -- Erro DISTINTO do opaco acima, e isso é seguro: quem chegou até aqui
      -- já provou ter um convite válido, então "endereço em uso" não revela
      -- nada a quem estivesse sondando. E como a exceção desfaz a transação
      -- inteira, o resgate volta atrás junto: o convite CONTINUA VALENDO e a
      -- pessoa tenta outro nome.
      raise exception 'Este endereço já está em uso.' using errcode = 'P0001';
    when check_violation then
      raise exception 'Este endereço não é permitido.' using errcode = 'P0001';
  end;

  insert into public.memberships (restaurant_id, user_id, role)
  values (v_restaurant_id, v_uid, 'admin');

  perform public.record_audit(
    'invite.redeemed', 'invite', v_invite.id, v_restaurant_id,
    jsonb_build_object('kind', 'platform')
  );
  perform public.record_audit(
    'restaurant.created', 'restaurant', v_restaurant_id, v_restaurant_id,
    jsonb_build_object('slug', p_slug)
  );

  return v_restaurant_id;
end;
$fn$;

grant execute on function public.preview_invite(text) to anon, authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
grant execute on function public.redeem_platform_invite(text, text, text) to authenticated;
