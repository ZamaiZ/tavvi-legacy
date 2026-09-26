-- =====================================================================
-- 0011 — Papéis: quatro em vez de dois, e escrita só do administrador
--
-- Rode DEPOIS do 0010. Idempotente: pode rodar de novo sem quebrar.
--
-- A ORDEM AQUI NÃO É ESTILO, É REQUISITO. O tipo antigo tem dependentes:
-- políticas que chamam is_owner, e três funções cuja assinatura cita
-- membership_role. Derrubar o tipo antes deles falha; derrubar is_owner
-- antes das políticas falha. A sequência é: políticas, funções, tipo.
--
-- Por que tipo novo e não `alter type add value`: Postgres acrescenta valor
-- a enum mas NUNCA remove. 'owner' e 'manager' ficariam de lixo permanente,
-- e todo CASE no código teria que tratar valores impossíveis para sempre.
-- Com zero restaurantes no ar, converter é barato.
-- =====================================================================

-- ---------- 1. as políticas que citam is_owner ----------
drop policy if exists restaurants_update  on public.restaurants;
drop policy if exists memberships_delete  on public.memberships;
drop policy if exists invites_select      on public.invites;

-- ---------- 2. as funções que citam o tipo antigo ----------
drop function if exists public.is_owner(uuid);
drop function if exists public.preview_invite(text);
drop function if exists public.redeem_invite(text);
drop function if exists public.list_restaurant_members(uuid);

-- ---------- 3. o tipo novo ----------
do $enum$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'member_role' and n.nspname = 'public'
  ) then
    create type public.member_role as enum ('admin', 'cashier', 'attendant', 'waiter');
  end if;
end
$enum$;

-- ---------- 4. a conversão das colunas ----------
-- Esta é a ÚNICA parte não idempotente por natureza, e ela é perigosa por um
-- motivo que não é óbvio: o schema.sql deste projeto concatena TODAS as
-- migrations, e o 0001 recria `membership_role` toda vez que roda. Numa
-- segunda execução do schema completo, o tipo antigo volta a existir —
-- órfão, sem coluna nenhuma usando — e uma condição ingênua do tipo "se o
-- tipo existe, converta" dispararia a conversão de novo.
--
-- Por isso a condição olha a COLUNA, não o tipo. E o ELSE preserva o valor
-- em vez de assumir 'admin'. Sem essas duas linhas, rodar o schema.sql duas
-- vezes promoveria todo garçom, caixa e atendente a administrador, em
-- silêncio, sem erro nenhum na saída.
do $conv$
begin
  if exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    where n.nspname = 'public'
      and c.relname = 'memberships'
      and a.attname = 'role'
      and t.typname = 'membership_role'
  ) then
    -- 'owner' e 'manager' viram ambos 'admin': hoje só existem donos, e
    -- rebaixar alguém numa migração seria tirar acesso sem aviso. O `else`
    -- devolve o valor como está, que é o que torna uma segunda passagem
    -- inofensiva.
    alter table public.memberships
      alter column role type public.member_role
      using (case role::text
               when 'owner'   then 'admin'
               when 'manager' then 'admin'
               else role::text
             end)::public.member_role;

    alter table public.invites
      alter column role type public.member_role
      using (case role::text
               when 'owner'   then 'admin'
               when 'manager' then 'admin'
               else role::text
             end)::public.member_role;
  end if;
end
$conv$;

-- Fora do bloco, e sem condição: varre o tipo antigo sempre que ele existir,
-- inclusive o órfão que o 0001 recria a cada geração do schema.sql. Se
-- alguma coluna ainda o usasse, este comando falharia — e falhar aqui é o
-- comportamento certo, porque significaria que a conversão acima não rodou.
drop type if exists public.membership_role;

-- ---------- 5. as funções de papel ----------
create or replace function public.is_restaurant_admin(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.memberships m
    where m.restaurant_id = rid
      and m.user_id = (select auth.uid())
      and m.role = 'admin'
  );
$fn$;

-- Alimenta a camada de interface: é ela que decide se o botão aparece.
-- Devolve NULO para quem não é membro, o que é diferente de um papel sem
-- poder — e a diferença importa na tela: não-membro nem enxerga o
-- restaurante; garçom enxerga e não edita.
create or replace function public.my_role(rid uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $fn$
  select m.role from public.memberships m
  where m.restaurant_id = rid and m.user_id = (select auth.uid());
$fn$;

grant execute on function public.is_restaurant_admin(uuid) to authenticated;
grant execute on function public.my_role(uuid) to authenticated;

-- ---------- 6. as políticas derrubadas, de volta ----------
create policy restaurants_update on public.restaurants
  for update to authenticated
  using (public.is_restaurant_admin(id) or public.is_platform_admin())
  with check (public.is_restaurant_admin(id) or public.is_platform_admin());

create policy memberships_delete on public.memberships
  for delete to authenticated
  using (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

create policy invites_select on public.invites
  for select to authenticated
  using (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

-- ---------- 7. a escrita do cardápio passa a exigir administrador ----------
-- ESTE é o buraco que a fase fecha. Estas políticas diziam is_member, e
-- is_member significa "trabalha aqui", não "pode editar". Enquanto só existia
-- dono, membro e dono eram a mesma pessoa e ninguém notava.
--
-- A LEITURA continua sendo de qualquer membro: as políticas *_select_member
-- ficam como estão e não são tocadas aqui.
drop policy if exists menu_categories_insert on public.menu_categories;
create policy menu_categories_insert on public.menu_categories
  for insert to authenticated
  with check (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_categories_update on public.menu_categories;
create policy menu_categories_update on public.menu_categories
  for update to authenticated
  using (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin())
  with check (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_categories_delete on public.menu_categories;
create policy menu_categories_delete on public.menu_categories
  for delete to authenticated
  using (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_items_insert on public.menu_items;
create policy menu_items_insert on public.menu_items
  for insert to authenticated
  with check (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_items_update on public.menu_items;
create policy menu_items_update on public.menu_items
  for update to authenticated
  using (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin())
  with check (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_items_delete on public.menu_items;
create policy menu_items_delete on public.menu_items
  for delete to authenticated
  using (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_variants_insert on public.menu_item_variants;
create policy menu_item_variants_insert on public.menu_item_variants
  for insert to authenticated
  with check (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_variants_update on public.menu_item_variants;
create policy menu_item_variants_update on public.menu_item_variants
  for update to authenticated
  using (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin())
  with check (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_variants_delete on public.menu_item_variants;
create policy menu_item_variants_delete on public.menu_item_variants
  for delete to authenticated
  using (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_media_insert on public.menu_item_media;
create policy menu_item_media_insert on public.menu_item_media
  for insert to authenticated
  with check (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_media_update on public.menu_item_media;
create policy menu_item_media_update on public.menu_item_media
  for update to authenticated
  using (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin())
  with check (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_media_delete on public.menu_item_media;
create policy menu_item_media_delete on public.menu_item_media
  for delete to authenticated
  using (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

-- A plaquinha é objeto físico do restaurante. Trocar o rótulo ou desligá-la é
-- decisão de administração, não de quem está no salão.
drop policy if exists menu_tags_update_member on public.menu_tags;
create policy menu_tags_update_member on public.menu_tags
  for update to authenticated
  using (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin())
  with check (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

-- ---------- 8. o gatilho de status, mais preciso ----------
-- Slug e deleted_at continuam fechados. O status ganha três casos: o
-- administrador do restaurante move entre rascunho e ativo; entrar ou sair de
-- suspenso continua exclusivo da plataforma. Suspensão que o suspenso desfaz
-- não é suspensão.
create or replace function public.restaurants_guard_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  -- auth.uid() nulo significa acesso DIRETO ao banco: SQL Editor, psql ou
  -- função SECURITY DEFINER. Todos já são privilegiados por definição, e
  -- tráfego da aplicação nunca chega aqui com uid nulo.
  if (select auth.uid()) is null or public.is_platform_admin() then
    return new;
  end if;

  if new.slug is distinct from old.slug then
    raise exception 'alterar slug exige administrador da plataforma' using errcode = '42501';
  end if;
  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'alterar deleted_at exige administrador da plataforma' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'suspended' or new.status = 'suspended' then
      raise exception 'suspender e reativar exige administrador da plataforma'
        using errcode = '42501';
    end if;
    if not public.is_restaurant_admin(new.id) then
      raise exception 'publicar exige administrador do restaurante'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$fn$;

drop trigger if exists restaurants_guard_privileged on public.restaurants;
create trigger restaurants_guard_privileged
  before update on public.restaurants
  for each row execute function public.restaurants_guard_privileged_columns();

-- ---------- 9. o restaurante nunca fica órfão ----------
create or replace function public.memberships_guard_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_remaining int;
begin
  -- Só interessa quando um vínculo de ADMINISTRADOR está deixando de ser um.
  if old.role <> 'admin' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'UPDATE' and new.role = 'admin' then
    return new;
  end if;

  -- Remoção em cascata do restaurante inteiro passa direto: a linha-pai já
  -- saiu nesta transação. Sem esta saída, apagar um restaurante travaria no
  -- primeiro administrador encontrado.
  if not exists (select 1 from public.restaurants r where r.id = old.restaurant_id) then
    return old;
  end if;

  select count(*) into v_remaining
    from public.memberships m
   where m.restaurant_id = old.restaurant_id
     and m.role = 'admin'
     and m.id <> old.id;

  if v_remaining = 0 then
    raise exception 'o restaurante precisa de ao menos um administrador'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$fn$;

drop trigger if exists memberships_guard_last_admin on public.memberships;
create trigger memberships_guard_last_admin
  before delete or update on public.memberships
  for each row execute function public.memberships_guard_last_admin();

-- ---------- 10. as três funções derrubadas, de volta ----------
-- Idênticas às do 0007 e do 0009, com membership_role trocado por member_role
-- e nada mais. A FORMA delas muda no 0012; aqui elas só precisam voltar a
-- existir, para cada migração continuar válida isoladamente — o SQL Editor
-- não guarda estado e elas são aplicadas à mão, uma de cada vez.

create function public.preview_invite(p_token text)
returns table (restaurant_name text, invite_role public.member_role)
language sql
stable
security definer
set search_path = ''
as $fn$
  select r.name, i.role
  from public.invites i
  join public.restaurants r on r.id = i.restaurant_id
  where i.token_hash = sha256(convert_to(p_token, 'UTF8'))
    and i.expires_at > now()
    and i.redeemed_at is null
    and i.revoked_at is null;
$fn$;

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

  update public.invites i
     set redeemed_at = now(),
         redeemed_by = v_uid
   where i.token_hash = sha256(convert_to(p_token, 'UTF8'))
     and i.expires_at > now()
     and i.redeemed_at is null
     and i.revoked_at is null
     and (i.email is null or lower(i.email) = lower(v_email))
  returning i.* into v_invite;

  if not found then
    raise exception 'convite invalido' using errcode = '42501';
  end if;

  insert into public.memberships (restaurant_id, user_id, role)
  values (v_invite.restaurant_id, v_uid, v_invite.role)
  on conflict (restaurant_id, user_id) do nothing;

  perform public.record_audit(
    'invite.redeemed',
    'invite',
    v_invite.id,
    v_invite.restaurant_id,
    jsonb_build_object('role', v_invite.role)
  );

  return v_invite.restaurant_id;
end;
$fn$;

create function public.list_restaurant_members(p_restaurant_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  display_name text,
  member_role public.member_role,
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

grant execute on function public.preview_invite(text) to anon, authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
grant execute on function public.list_restaurant_members(uuid) to authenticated;
