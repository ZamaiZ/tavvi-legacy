-- Tavvi Web-only database baseline.
-- Apply once to a newly created, empty Supabase project.
-- This file defines the current product schema; it is not an upgrade for databases with data.
-- The first platform administrator is granted manually with seed/bootstrap-admin.sql.

do $enum$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'restaurant_status' and n.nspname = 'public'
  ) then
    create type public.restaurant_status as enum ('draft', 'active', 'suspended');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'membership_role' and n.nspname = 'public'
  ) then
    create type public.membership_role as enum ('owner', 'manager');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'media_kind' and n.nspname = 'public'
  ) then
    create type public.media_kind as enum ('image', 'video');
  end if;
end
$enum$;

-- Gatilho compartilhado de updated_at. O search_path travado fecha
-- search_path injection: sem ele, alguem que consiga criar uma funcao num
-- schema anterior na busca sequestra a execucao com privilegio elevado.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

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

-- =====================================================================
-- 0003 — Tenancy: restaurantes, vinculos, convites e plaquinhas
--
-- Rode DEPOIS do 0002. Idempotente: pode rodar de novo sem quebrar.
-- =====================================================================

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  status public.restaurant_status not null default 'draft',
  currency text not null default 'BRL',
  timezone text not null default 'America/Sao_Paulo',
  logo_path text,
  cover_path text,
  theme jsonb not null default '{}'::jsonb,
  contact jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Forca minusculas, o que dispensa a extensao citext.
  constraint restaurants_slug_shape
    check (slug ~ '^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])$'),
  -- Impede slug que colida com rota interna do app.
  constraint restaurants_slug_not_reserved
    check (slug not in (
      'admin', 'painel', 'api', 't', 'entrar', 'convite',
      'assets', 'static', 'public', 'favicon', 'robots', 'sitemap'
    ))
);

drop trigger if exists restaurants_set_updated_at on public.restaurants;
create trigger restaurants_set_updated_at
  before update on public.restaurants
  for each row execute function public.set_updated_at();

create index if not exists restaurants_public_slug_idx
  on public.restaurants (slug)
  where status = 'active' and deleted_at is null;

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.membership_role not null,
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

create index if not exists memberships_user_idx on public.memberships (user_id);
create index if not exists memberships_restaurant_idx on public.memberships (restaurant_id);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  role public.membership_role not null,
  -- SO o hash do token vive aqui. Vazar o banco nao entrega acesso a
  -- ninguem, porque o hash nao volta a ser token.
  token_hash bytea not null unique,
  email text,
  created_by uuid not null references public.profiles (id),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references public.profiles (id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invites_expires_after_creation check (expires_at > created_at)
);

create index if not exists invites_restaurant_idx on public.invites (restaurant_id);

-- A plaquinha fisica. O token fica em texto puro de proposito: ele esta
-- impresso num QR pendurado na parede, nao e segredo, e guardar so o hash
-- impediria reimprimir a plaquinha depois.
create table if not exists public.menu_tags (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  public_token text not null unique,
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create index if not exists menu_tags_restaurant_idx on public.menu_tags (restaurant_id);

create or replace function public.is_member(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.memberships m
    where m.restaurant_id = rid and m.user_id = (select auth.uid())
  );
$fn$;

create or replace function public.is_owner(rid uuid)
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
      and m.role = 'owner'
  );
$fn$;

create or replace function public.is_restaurant_public(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.restaurants r
    where r.id = rid and r.status = 'active' and r.deleted_at is null
  );
$fn$;

-- O dono edita identidade e tema, mas endereco, situacao e remocao sao
-- privilegio da plataforma. Garantido aqui, nao por convencao no codigo.
create or replace function public.restaurants_guard_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  -- auth.uid() nulo significa acesso DIRETO ao banco: SQL Editor, psql ou
  -- funcao SECURITY DEFINER. Todos ja sao privilegiados por definicao, e
  -- trafego da aplicacao nunca chega aqui com uid nulo -- anonimo sequer
  -- tem politica de UPDATE nesta tabela. Sem esta saida, o proprio
  -- administrador ficaria impedido de fazer manutencao pelo dashboard.
  if (select auth.uid()) is null or public.is_platform_admin() then
    return new;
  end if;

  if new.slug is distinct from old.slug then
    raise exception 'alterar slug exige administrador da plataforma' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    raise exception 'alterar status exige administrador da plataforma' using errcode = '42501';
  end if;
  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'alterar deleted_at exige administrador da plataforma' using errcode = '42501';
  end if;

  return new;
end;
$fn$;

drop trigger if exists restaurants_guard_privileged on public.restaurants;
create trigger restaurants_guard_privileged
  before update on public.restaurants
  for each row execute function public.restaurants_guard_privileged_columns();

-- O token gravado no NFC e o restaurante de origem nunca mudam: a
-- plaquinha e hardware, e reatribui-la seria trocar o significado de um
-- objeto fisico que ja esta na parede de alguem.
create or replace function public.menu_tags_guard_immutable_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  if new.public_token is distinct from old.public_token then
    raise exception 'public_token da plaquinha e imutavel' using errcode = '42501';
  end if;
  if new.restaurant_id is distinct from old.restaurant_id then
    raise exception 'restaurant_id da plaquinha e imutavel' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

drop trigger if exists menu_tags_guard_immutable on public.menu_tags;
create trigger menu_tags_guard_immutable
  before update on public.menu_tags
  for each row execute function public.menu_tags_guard_immutable_columns();

-- =====================================================================
-- 0004 — Cardapio: categorias, itens, variacoes e midia
--
-- Rode DEPOIS do 0003. Idempotente: pode rodar de novo sem quebrar.
--
-- Esta e a migracao que torna vazamento entre restaurantes INEXPRESSAVEL,
-- e nao apenas improvavel. Veja o comentario da constraint
-- menu_items_category_same_restaurant.
-- =====================================================================

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  description text,
  position integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Alvo da chave estrangeira composta de menu_items. Redundante como
  -- unicidade (id ja e chave primaria), mas necessario para que uma FK
  -- possa referenciar o par (id, restaurant_id).
  unique (id, restaurant_id)
);

drop trigger if exists menu_categories_set_updated_at on public.menu_categories;
create trigger menu_categories_set_updated_at
  before update on public.menu_categories
  for each row execute function public.set_updated_at();

create index if not exists menu_categories_restaurant_idx
  on public.menu_categories (restaurant_id, position);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid not null,
  name text not null,
  description text,
  -- Centavos, inteiro. Ponto flutuante nao representa 19.90 exatamente, e
  -- contabilidade de restaurante nao perdoa arredondamento.
  base_price_cents integer not null check (base_price_cents >= 0),
  is_available boolean not null default true,
  is_visible boolean not null default true,
  position integer not null default 0,
  dietary_tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, restaurant_id),
  -- O CORACAO DO ISOLAMENTO: o item so aponta para uma categoria do MESMO
  -- restaurante. Referencia cruzada e recusada pelo banco, nao validada
  -- por um if em TypeScript que alguem pode esquecer de chamar. Deixa de
  -- ser um bug possivel e passa a ser um estado inexpressavel.
  constraint menu_items_category_same_restaurant
    foreign key (category_id, restaurant_id)
    references public.menu_categories (id, restaurant_id)
    on delete cascade
);

drop trigger if exists menu_items_set_updated_at on public.menu_items;
create trigger menu_items_set_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

create index if not exists menu_items_category_idx on public.menu_items (category_id, position);
create index if not exists menu_items_restaurant_idx on public.menu_items (restaurant_id);

create table if not exists public.menu_item_variants (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  item_id uuid not null,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  position integer not null default 0,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_item_variants_item_same_restaurant
    foreign key (item_id, restaurant_id)
    references public.menu_items (id, restaurant_id)
    on delete cascade
);

drop trigger if exists menu_item_variants_set_updated_at on public.menu_item_variants;
create trigger menu_item_variants_set_updated_at
  before update on public.menu_item_variants
  for each row execute function public.set_updated_at();

create index if not exists menu_item_variants_item_idx
  on public.menu_item_variants (item_id, position);

create table if not exists public.menu_item_media (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  item_id uuid not null,
  kind public.media_kind not null,
  storage_path text not null unique,
  alt_text text,
  width integer,
  height integer,
  duration_ms integer,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint menu_item_media_item_same_restaurant
    foreign key (item_id, restaurant_id)
    references public.menu_items (id, restaurant_id)
    on delete cascade,
  -- O caminho no storage precisa comecar pelo id do restaurante: o prefixo
  -- do caminho E a fronteira do inquilino, e a politica de storage decide
  -- permissao lendo exatamente esse prefixo.
  constraint menu_item_media_path_prefix
    check (storage_path like restaurant_id::text || '/%')
);

create index if not exists menu_item_media_item_idx
  on public.menu_item_media (item_id, position);

create or replace function public.is_category_visible(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.menu_categories c
    where c.id = cid and c.is_visible
  );
$fn$;

-- Item publico exige as tres condicoes: o item visivel, a categoria dele
-- visivel e o restaurante no ar. Esconder a categoria esconde os itens.
create or replace function public.is_menu_item_public(iid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
    from public.menu_items i
    join public.menu_categories c
      on c.id = i.category_id and c.restaurant_id = i.restaurant_id
    where i.id = iid
      and i.is_visible
      and c.is_visible
      and public.is_restaurant_public(i.restaurant_id)
  );
$fn$;

-- =====================================================================
-- 0005 — Infraestrutura: rate limit e log de auditoria
--
-- Rode DEPOIS do 0004. Idempotente: pode rodar de novo sem quebrar.
--
-- As duas tabelas aqui nao sao acessiveis por ninguem: RLS ligada sem
-- politica nenhuma, mais REVOKE explicito. So as funcoes SECURITY DEFINER
-- deste arquivo conseguem toca-las.
-- =====================================================================

create table if not exists public.rate_limit_counters (
  bucket text not null,
  identifier text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, identifier, window_start)
);

create index if not exists rate_limit_counters_window_idx
  on public.rate_limit_counters (window_start);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  subject_type text not null,
  subject_id uuid,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_restaurant_idx
  on public.audit_log (restaurant_id, created_at desc);
create index if not exists audit_log_actor_idx
  on public.audit_log (actor_id, created_at desc);

-- Janela fixa. O UPSERT e atomico: duas requisicoes simultaneas nunca
-- conseguem ler o mesmo contador e gravar o mesmo incremento, que e a
-- falha classica de rate limit feito em duas etapas na aplicacao.
create or replace function public.check_rate_limit(
  p_bucket text,
  p_identifier text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_window_start timestamptz;
  v_hits integer;
begin
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_counters (bucket, identifier, window_start, hits)
  values (p_bucket, p_identifier, v_window_start, 1)
  on conflict (bucket, identifier, window_start)
    do update set hits = rate_limit_counters.hits + 1
  returning hits into v_hits;

  -- Limpeza oportunista: em cerca de 1% das chamadas, remove janelas
  -- velhas. Evita crescimento indefinido da tabela sem exigir rotina
  -- agendada, que seria mais uma peca para manter e esquecer.
  if random() < 0.01 then
    delete from public.rate_limit_counters
    where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_max;
end;
$fn$;

create or replace function public.record_audit(
  p_action text,
  p_subject_type text,
  p_subject_id uuid default null,
  p_restaurant_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_ip inet default null
)
returns void
language sql
volatile
security definer
set search_path = ''
as $fn$
  insert into public.audit_log
    (actor_id, action, subject_type, subject_id, restaurant_id, metadata, ip)
  values
    ((select auth.uid()), p_action, p_subject_type, p_subject_id,
     p_restaurant_id, p_metadata, p_ip);
$fn$;

revoke all on public.rate_limit_counters from anon, authenticated;
revoke all on public.audit_log from anon, authenticated;

-- Politica de RLS opera EM CIMA do grant de tabela, nao no lugar dele.
-- Sem este grant, a politica audit_log_select_admin nunca seria alcancada
-- e o log de auditoria seria so-escrita: nem o administrador conseguiria
-- le-lo. A leitura de fato continua restrita ao administrador -- quem
-- estreita e a politica; este grant so abre a porta para ela decidir.
grant select on public.audit_log to authenticated;

grant execute on function public.check_rate_limit(text, text, integer, integer)
  to anon, authenticated;
grant execute on function public.record_audit(text, text, uuid, uuid, jsonb, inet)
  to authenticated;

-- =====================================================================
-- 0006 — Row Level Security: a ultima linha de defesa
--
-- Rode DEPOIS do 0005. Idempotente: cada politica e removida antes de ser
-- recriada, entao rodar de novo apenas reescreve as mesmas regras.
--
-- Depois desta migracao, TODA tabela nega por padrao. Ausencia de politica
-- nao e permissao esquecida: e negacao. So passa o que esta escrito aqui.
-- =====================================================================

alter table public.profiles            enable row level security;
alter table public.platform_admins     enable row level security;
alter table public.restaurants         enable row level security;
alter table public.memberships         enable row level security;
alter table public.invites             enable row level security;
alter table public.menu_tags           enable row level security;
alter table public.menu_categories     enable row level security;
alter table public.menu_items          enable row level security;
alter table public.menu_item_variants  enable row level security;
alter table public.menu_item_media     enable row level security;
alter table public.audit_log           enable row level security;
alter table public.rate_limit_counters enable row level security;

-- profiles -------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_platform_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- platform_admins ------------------------------------------------------
-- Sem INSERT, UPDATE ou DELETE: nao existe caminho na aplicacao que
-- promova alguem a administrador. So o seed manual de bootstrap.
drop policy if exists platform_admins_select on public.platform_admins;
create policy platform_admins_select on public.platform_admins
  for select to authenticated
  using (public.is_platform_admin());

-- restaurants ----------------------------------------------------------
drop policy if exists restaurants_select_public on public.restaurants;
create policy restaurants_select_public on public.restaurants
  for select to anon, authenticated
  using (status = 'active' and deleted_at is null);

drop policy if exists restaurants_select_member on public.restaurants;
create policy restaurants_select_member on public.restaurants
  for select to authenticated
  using (public.is_member(id) or public.is_platform_admin());

drop policy if exists restaurants_insert_admin on public.restaurants;
create policy restaurants_insert_admin on public.restaurants
  for insert to authenticated
  with check (public.is_platform_admin());

drop policy if exists restaurants_update on public.restaurants;
create policy restaurants_update on public.restaurants
  for update to authenticated
  using (public.is_owner(id) or public.is_platform_admin())
  with check (public.is_owner(id) or public.is_platform_admin());

-- Sem politica de DELETE: remover restaurante e impossivel pela
-- aplicacao. A remocao e logica, via deleted_at, e so pela plataforma.

-- memberships ----------------------------------------------------------
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists memberships_insert_admin on public.memberships;
create policy memberships_insert_admin on public.memberships
  for insert to authenticated
  with check (public.is_platform_admin());

drop policy if exists memberships_update_admin on public.memberships;
create policy memberships_update_admin on public.memberships
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete on public.memberships
  for delete to authenticated
  using (public.is_owner(restaurant_id) or public.is_platform_admin());

-- invites --------------------------------------------------------------
drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites
  for select to authenticated
  using (public.is_owner(restaurant_id) or public.is_platform_admin());

drop policy if exists invites_insert_admin on public.invites;
create policy invites_insert_admin on public.invites
  for insert to authenticated
  with check (public.is_platform_admin());

drop policy if exists invites_update_admin on public.invites;
create policy invites_update_admin on public.invites
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- menu_tags ------------------------------------------------------------
-- Anonimo nao enxerga NADA aqui. A resolucao de /t/{token} passa pela
-- funcao resolve_menu_tag do 0007, o que impede enumerar as plaquinhas
-- de todos os restaurantes.
drop policy if exists menu_tags_select_member on public.menu_tags;
create policy menu_tags_select_member on public.menu_tags
  for select to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_tags_insert_admin on public.menu_tags;
create policy menu_tags_insert_admin on public.menu_tags
  for insert to authenticated
  with check (public.is_platform_admin());

drop policy if exists menu_tags_update_member on public.menu_tags;
create policy menu_tags_update_member on public.menu_tags
  for update to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin())
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_tags_delete_admin on public.menu_tags;
create policy menu_tags_delete_admin on public.menu_tags
  for delete to authenticated
  using (public.is_platform_admin());

-- menu_categories ------------------------------------------------------
drop policy if exists menu_categories_select_public on public.menu_categories;
create policy menu_categories_select_public on public.menu_categories
  for select to anon, authenticated
  using (is_visible and public.is_restaurant_public(restaurant_id));

drop policy if exists menu_categories_select_member on public.menu_categories;
create policy menu_categories_select_member on public.menu_categories
  for select to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_categories_insert on public.menu_categories;
create policy menu_categories_insert on public.menu_categories
  for insert to authenticated
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_categories_update on public.menu_categories;
create policy menu_categories_update on public.menu_categories
  for update to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin())
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_categories_delete on public.menu_categories;
create policy menu_categories_delete on public.menu_categories
  for delete to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

-- menu_items -----------------------------------------------------------
drop policy if exists menu_items_select_public on public.menu_items;
create policy menu_items_select_public on public.menu_items
  for select to anon, authenticated
  using (
    is_visible
    and public.is_restaurant_public(restaurant_id)
    and public.is_category_visible(category_id)
  );

drop policy if exists menu_items_select_member on public.menu_items;
create policy menu_items_select_member on public.menu_items
  for select to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_items_insert on public.menu_items;
create policy menu_items_insert on public.menu_items
  for insert to authenticated
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_items_update on public.menu_items;
create policy menu_items_update on public.menu_items
  for update to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin())
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_items_delete on public.menu_items;
create policy menu_items_delete on public.menu_items
  for delete to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

-- menu_item_variants ---------------------------------------------------
drop policy if exists menu_item_variants_select_public on public.menu_item_variants;
create policy menu_item_variants_select_public on public.menu_item_variants
  for select to anon, authenticated
  using (public.is_menu_item_public(item_id));

drop policy if exists menu_item_variants_select_member on public.menu_item_variants;
create policy menu_item_variants_select_member on public.menu_item_variants
  for select to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_variants_insert on public.menu_item_variants;
create policy menu_item_variants_insert on public.menu_item_variants
  for insert to authenticated
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_variants_update on public.menu_item_variants;
create policy menu_item_variants_update on public.menu_item_variants
  for update to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin())
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_variants_delete on public.menu_item_variants;
create policy menu_item_variants_delete on public.menu_item_variants
  for delete to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

-- menu_item_media ------------------------------------------------------
drop policy if exists menu_item_media_select_public on public.menu_item_media;
create policy menu_item_media_select_public on public.menu_item_media
  for select to anon, authenticated
  using (public.is_menu_item_public(item_id));

drop policy if exists menu_item_media_select_member on public.menu_item_media;
create policy menu_item_media_select_member on public.menu_item_media
  for select to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_media_insert on public.menu_item_media;
create policy menu_item_media_insert on public.menu_item_media
  for insert to authenticated
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_media_update on public.menu_item_media;
create policy menu_item_media_update on public.menu_item_media
  for update to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin())
  with check (public.is_member(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_item_media_delete on public.menu_item_media;
create policy menu_item_media_delete on public.menu_item_media
  for delete to authenticated
  using (public.is_member(restaurant_id) or public.is_platform_admin());

-- audit_log ------------------------------------------------------------
-- Sem politica de INSERT: so record_audit escreve aqui. Sem UPDATE nem
-- DELETE: log que pode ser editado nao serve como log.
drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using (public.is_platform_admin());

-- rate_limit_counters --------------------------------------------------
-- Nenhuma politica, de proposito. RLS ligada sem politica nega tudo, e o
-- acesso acontece exclusivamente por check_rate_limit.

-- =====================================================================
-- 0007 — Operacoes privilegiadas: convite e plaquinha
--
-- Rode DEPOIS do 0006. Idempotente.
--
-- Estas funcoes existem para que a chave service_role NUNCA precise
-- entrar na aplicacao. Cada uma tem escopo estreito, e escopo estreito e
-- auditavel; uma chave que ignora toda a RLS nao e.
-- =====================================================================

-- Recebe o token EM CLARO e calcula o hash aqui dentro. Isso e essencial e
-- nao e detalhe: se a funcao aceitasse o hash, um vazamento do banco
-- entregaria hashes diretamente utilizaveis, anulando todo o motivo de
-- guardar hash em vez do token.
--
-- Retorna ZERO linhas para token desconhecido, expirado, revogado OU ja
-- usado. As quatro situacoes sao indistinguiveis de fora, o que impede
-- descobrir que um convite existe.
drop function if exists public.preview_invite(text);
create function public.preview_invite(p_token text)
returns table (restaurant_name text, invite_role public.membership_role)
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

  -- A corrida entre dois cliques simultaneos no mesmo link e resolvida
  -- aqui pelo proprio Postgres: so uma transacao encontra redeemed_at
  -- ainda nulo. Sem lock na aplicacao, sem janela entre checar e gravar.
  update public.invites i
     set redeemed_at = now(),
         redeemed_by = v_uid
   where i.token_hash = sha256(convert_to(p_token, 'UTF8'))
     and i.expires_at > now()
     and i.redeemed_at is null
     and i.revoked_at is null
     and (i.email is null or lower(i.email) = lower(v_email))
  returning i.* into v_invite;

  -- Mensagem unica para todos os modos de falha, pela mesma razao de
  -- preview_invite: nao revelar qual condicao falhou.
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

-- Resolve a plaquinha sem dar a anonimos qualquer leitura sobre menu_tags,
-- o que permitiria enumerar as plaquinhas de todos os restaurantes.
drop function if exists public.resolve_menu_tag(text);
create function public.resolve_menu_tag(p_token text)
returns table (restaurant_slug text, tag_label text)
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
begin
  return query
    update public.menu_tags t
       set last_seen_at = now()
      from public.restaurants r
     where r.id = t.restaurant_id
       and t.public_token = p_token
       and t.is_active
       and r.status = 'active'
       and r.deleted_at is null
    returning r.slug, t.label;
end;
$fn$;

grant execute on function public.preview_invite(text) to anon, authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
grant execute on function public.resolve_menu_tag(text) to anon, authenticated;

-- =====================================================================
-- 0008 — Storage: buckets de midia e fronteira por prefixo de caminho
--
-- Rode DEPOIS do 0007. Idempotente.
-- =====================================================================

-- Dois buckets em vez de um porque o limite de tamanho e a lista de tipos
-- aceitos sao configuracao DO BUCKET, aplicada pelo proprio Supabase no
-- servidor -- nao dependem de codigo nosso. Com um bucket so, o teto teria
-- que ser o maior dos dois e alguem subiria uma "foto" de 10 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('menu-images', 'menu-images', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('menu-videos', 'menu-videos', true, 10485760,
   array['video/mp4', 'video/webm'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Extrai o id do restaurante do prefixo do caminho. Devolve null quando o
-- caminho nao comeca com um uuid, para que a politica NEGUE em vez de
-- levantar erro de conversao -- politica que estoura em vez de negar e
-- uma falha aberta disfarcada de erro.
create or replace function public.restaurant_id_from_storage_path(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $fn$
declare
  v_first text := split_part(p_name, '/', 1);
begin
  return v_first::uuid;
exception when others then
  return null;
end;
$fn$;

-- Leitura publica: o cardapio e publico.
drop policy if exists menu_media_select_public on storage.objects;
create policy menu_media_select_public on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('menu-images', 'menu-videos'));

-- Escrita: o prefixo do caminho E a fronteira do inquilino, verificada
-- pelo banco. Quem nao e membro daquele restaurante nao escreve na pasta
-- dele, independentemente do que a aplicacao mande.
drop policy if exists menu_media_insert_member on storage.objects;
create policy menu_media_insert_member on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('menu-images', 'menu-videos')
    and public.is_member(public.restaurant_id_from_storage_path(name))
  );

drop policy if exists menu_media_update_member on storage.objects;
create policy menu_media_update_member on storage.objects
  for update to authenticated
  using (
    bucket_id in ('menu-images', 'menu-videos')
    and public.is_member(public.restaurant_id_from_storage_path(name))
  )
  with check (
    bucket_id in ('menu-images', 'menu-videos')
    and public.is_member(public.restaurant_id_from_storage_path(name))
  );

drop policy if exists menu_media_delete_member on storage.objects;
create policy menu_media_delete_member on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('menu-images', 'menu-videos')
    and public.is_member(public.restaurant_id_from_storage_path(name))
  );

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

-- =====================================================================
-- 0010 — Capa do video
--
-- Rode DEPOIS do 0009. Idempotente: pode rodar de novo sem quebrar.
--
-- O CHECK espelha o que storage_path ja tem. Sem ele, a capa poderia
-- apontar para fora da pasta do restaurante -- a fronteira do inquilino
-- vale para todo caminho de arquivo, nao so para o principal.
-- =====================================================================

alter table public.menu_item_media
  add column if not exists poster_path text;

do $guard$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'menu_item_media_poster_prefix'
      and conrelid = 'public.menu_item_media'::regclass
  ) then
    alter table public.menu_item_media
      add constraint menu_item_media_poster_prefix
      check (poster_path is null or poster_path like restaurant_id::text || '/%');
  end if;
end
$guard$;

-- =====================================================================
-- 0011 — Papéis: quatro em vez de dois, e escrita só do administrador
--
-- Rode DEPOIS do 0010. Idempotente: pode rodar de novo sem quebrar.
--
-- A ORDEM AQUI NÃO Ã‰ ESTILO, Ã‰ REQUISITO. O tipo antigo tem dependentes:
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
-- Esta é a ÃšNICA parte não idempotente por natureza, e ela é perigosa por um
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
-- restaurants_insert_admin fechada. Ã‰ DELIBERADO: a política continua negando
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

-- =====================================================================
-- 0013 — Segmento do restaurante e disponibilidade de endereço
--
-- Rode DEPOIS do 0012. Idempotente: pode rodar de novo sem quebrar.
-- =====================================================================

alter table public.restaurants add column if not exists segment text;

alter table public.restaurants drop constraint if exists restaurants_segment_length;
alter table public.restaurants add constraint restaurants_segment_length
  check (segment is null or char_length(segment) between 2 and 60);

-- O assistente precisa dizer "este endereço está livre" enquanto a pessoa
-- digita, e ela ainda não é membro de nada — a política de SELECT em
-- restaurants só a deixaria ver os ativos. Daí SECURITY DEFINER.
--
-- Isto é um oráculo de existência, e é aceitável: o endereço é uma URL
-- pública, e visitá-la já responde a mesma pergunta. O limite de tentativas
-- fica na DAL, no balde que a Fase 0 já definiu.
--
-- Devolve falso também para endereço que o CHECK recusaria, para a tela nunca
-- dizer "livre" sobre algo que o banco vai rejeitar no fim. A lista de
-- reservadas é a MESMA do restaurants_slug_not_reserved, no 0003: se uma
-- mudar, a outra precisa mudar junto.
drop function if exists public.is_slug_available(text);
create function public.is_slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select
    p_slug ~ '^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])$'
    and p_slug not in (
      'admin', 'painel', 'api', 't', 'entrar', 'convite',
      'assets', 'static', 'public', 'favicon', 'robots', 'sitemap'
    )
    and not exists (select 1 from public.restaurants r where r.slug = p_slug);
$fn$;

grant execute on function public.is_slug_available(text) to authenticated;

-- =====================================================================
-- 0014 — Escrita no storage também exige administrador
--
-- Rode DEPOIS do 0013. Idempotente: pode rodar de novo sem quebrar.
--
-- O 0011 trocou `is_member` por `is_restaurant_admin` nas quatro tabelas do
-- cardápio e nas plaquinhas, e ESQUECEU de `storage.objects`. O resultado é
-- uma falha aberta numa camada só: pela aplicação o caminho está fechado,
-- porque `createUploadTicket` exige administrador e sem ticket não sai URL
-- assinada — mas garçom, caixa e atendente têm um JWT `authenticated` válido
-- e podem falar com o storage sem passar pelo app.
--
-- A regra do produto é "criar, editar e remover mídia é do administrador", e
-- mídia inclui o ARQUIVO, não só a linha que aponta para ele. Uma RLS mais
-- frouxa que a DAL inverte o desenho de três camadas: a última linha de
-- defesa passa a ser a mais fraca.
--
-- A leitura NÃO muda: o cardápio é público, e continua público.
-- =====================================================================

drop policy if exists menu_media_insert_member on storage.objects;
create policy menu_media_insert_member on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('menu-images', 'menu-videos')
    -- O prefixo do caminho Ã‰ a fronteira do inquilino, verificada pelo
    -- banco. Quem não administra aquele restaurante não escreve na pasta
    -- dele, independentemente do que a aplicação mande.
    and public.is_restaurant_admin(public.restaurant_id_from_storage_path(name))
  );

drop policy if exists menu_media_update_member on storage.objects;
create policy menu_media_update_member on storage.objects
  for update to authenticated
  using (
    bucket_id in ('menu-images', 'menu-videos')
    and public.is_restaurant_admin(public.restaurant_id_from_storage_path(name))
  )
  with check (
    bucket_id in ('menu-images', 'menu-videos')
    and public.is_restaurant_admin(public.restaurant_id_from_storage_path(name))
  );

drop policy if exists menu_media_delete_member on storage.objects;
create policy menu_media_delete_member on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('menu-images', 'menu-videos')
    and public.is_restaurant_admin(public.restaurant_id_from_storage_path(name))
  );

-- Fase 4. O feed desenha a midia em tela cheia, com object-fit: cover. Foto
-- quadrada ou em paisagem vira recorte central cego, e o prato sai do quadro.
-- O ponto focal e o pixel que o dono marcou como "nao pode sair", e vira
-- object-position na hora de desenhar.
--
-- Padrao 0.5/0.5 e o centro, que e exatamente o que o cover ja fazia: nenhuma
-- midia existente muda de aparencia ao aplicar esta migration.

alter table public.menu_item_media
  add column if not exists focal_x numeric not null default 0.5;

alter table public.menu_item_media
  add column if not exists focal_y numeric not null default 0.5;

-- `add constraint` nao aceita `if not exists`, e o schema.sql reexecuta tudo
-- a cada aplicacao. O bloco condicional e o que torna isto idempotente.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'menu_item_media_focal_range'
  ) then
    alter table public.menu_item_media
      add constraint menu_item_media_focal_range
      check (focal_x between 0 and 1 and focal_y between 0 and 1);
  end if;
end $$;

-- Reparo da POSICAO, que ate aqui era contada por TIPO de midia.
--
-- O `registerItemMedia` gravava `position` igual a contagem de midias do
-- mesmo kind: imagens ficavam em 0, 1, 2 -- e o video TAMBEM ficava em 0.
-- Numa lista isso nunca apareceu, porque so `media[0]` virava miniatura e o
-- filtro por kind separava os dois. No feed a ordem das midias E a ordem das
-- telas, e duas em `position: 0` deixam indefinido qual abre o prato.
--
-- Renumera cada item de 0 em diante, imagem antes de video, preservando a
-- ordem relativa que ja existia dentro de cada tipo. Idempotente: na segunda
-- passagem o `is distinct from` nao encontra nada para atualizar.
with renumerado as (
  select
    id,
    row_number() over (
      partition by item_id
      order by (kind = 'video'), position, created_at
    ) - 1 as nova
  from public.menu_item_media
)
update public.menu_item_media m
set position = r.nova
from renumerado r
where m.id = r.id and m.position is distinct from r.nova;

-- Platform invite read and rotation functions used by the web console.
-- Only platform admins can read invite actor emails or rotate a platform invite.

create or replace function public.list_platform_admin_invites()
returns table (
  id uuid,
  email text,
  expires_at timestamptz,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz,
  created_by_email text,
  redeemed_by_email text
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  return query
    select i.id, i.email, i.expires_at, i.redeemed_at, i.revoked_at, i.created_at,
           creator.email::text, redeemer.email::text
      from public.invites i
      join auth.users creator on creator.id = i.created_by
      left join auth.users redeemer on redeemer.id = i.redeemed_by
     where i.restaurant_id is null
     order by i.created_at desc;
end;
$fn$;

create or replace function public.get_platform_admin_invite(p_invite_id uuid)
returns table (
  id uuid,
  email text,
  expires_at timestamptz,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz,
  created_by_email text,
  redeemed_by_email text
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  return query
    select i.id, i.email, i.expires_at, i.redeemed_at, i.revoked_at, i.created_at,
           creator.email::text, redeemer.email::text
      from public.invites i
      join auth.users creator on creator.id = i.created_by
      left join auth.users redeemer on redeemer.id = i.redeemed_by
     where i.id = p_invite_id and i.restaurant_id is null;
end;
$fn$;

create or replace function public.rotate_platform_admin_invite(p_invite_id uuid, p_token_hash bytea)
returns table (id uuid, email text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_old public.invites%rowtype;
  v_new_id uuid;
  v_now timestamptz := now();
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if p_token_hash is null or octet_length(p_token_hash) <> 32 then
    raise exception 'invalid invite token hash' using errcode = '22023';
  end if;

  select i.* into v_old
    from public.invites i
   where i.id = p_invite_id and i.restaurant_id is null
   for update;
  if not found then
    raise exception 'platform invite not found' using errcode = 'P0002';
  end if;
  if v_old.revoked_at is not null or v_old.redeemed_at is not null or v_old.expires_at <= v_now then
    raise exception 'invite is no longer pending' using errcode = 'P0001';
  end if;

  insert into public.invites (created_by, email, expires_at, restaurant_id, role, token_hash)
  values (auth.uid(), v_old.email, v_old.expires_at, null, 'admin', p_token_hash)
  returning id into v_new_id;

  update public.invites i set revoked_at = v_now
   where i.id = p_invite_id and i.revoked_at is null;

  perform public.record_audit(
    'invite.rotated', 'invite', v_new_id, null,
    jsonb_build_object('replacesInviteId', p_invite_id)
  );

  return query select v_new_id, v_old.email, v_old.expires_at;
end;
$fn$;

revoke all on function public.list_platform_admin_invites() from public;
revoke all on function public.get_platform_admin_invite(uuid) from public;
revoke all on function public.rotate_platform_admin_invite(uuid, bytea) from public;
grant execute on function public.list_platform_admin_invites() to authenticated;
grant execute on function public.get_platform_admin_invite(uuid) to authenticated;
grant execute on function public.rotate_platform_admin_invite(uuid, bytea) to authenticated;

-- =====================================================================
-- 0023 — Marca de "Primeiros passos" concluídos
--
-- O cabeçalho do cardápio mostra "Primeiros passos" só enquanto esta coluna
-- for nula. Quem grava é `completeOnboardingAction`, ao concluir ou pular o
-- assistente.
--
-- A coluna nasce com DEFAULT now() e o default sai em seguida: assim as
-- linhas que já existem ficam marcadas (o assistente é para quem acabou de
-- chegar) sem disparar os gatilhos de UPDATE, e as novas nascem nulas.
-- =====================================================================

alter table public.restaurants
  add column if not exists onboarding_completed_at timestamptz default now();

alter table public.restaurants
  alter column onboarding_completed_at drop default;

notify pgrst, 'reload schema';

-- In 0016 the INSERT used an unqualified `returning id`. Inside PL/pgSQL the
-- `returns table (id uuid, ...)` output column is also a variable named `id`,
-- so Postgres rejected every rotation with "column reference "id" is
-- ambiguous". Qualify it through an alias, as create_platform_admin_invite does.

create or replace function public.rotate_platform_admin_invite(p_invite_id uuid, p_token_hash bytea)
returns table (id uuid, email text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_old public.invites%rowtype;
  v_new_id uuid;
  v_now timestamptz := now();
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if p_token_hash is null or octet_length(p_token_hash) <> 32 then
    raise exception 'invalid invite token hash' using errcode = '22023';
  end if;

  select i.* into v_old
    from public.invites i
   where i.id = p_invite_id and i.restaurant_id is null
   for update;
  if not found then
    raise exception 'platform invite not found' using errcode = 'P0002';
  end if;
  if v_old.revoked_at is not null or v_old.redeemed_at is not null or v_old.expires_at <= v_now then
    raise exception 'invite is no longer pending' using errcode = 'P0001';
  end if;

  insert into public.invites as new_invite (created_by, email, expires_at, restaurant_id, role, token_hash)
  values (auth.uid(), v_old.email, v_old.expires_at, null, 'admin', p_token_hash)
  returning new_invite.id into v_new_id;

  update public.invites i set revoked_at = v_now
   where i.id = p_invite_id and i.revoked_at is null;

  perform public.record_audit(
    'invite.rotated', 'invite', v_new_id, null,
    jsonb_build_object('replacesInviteId', p_invite_id)
  );

  return query select v_new_id, v_old.email, v_old.expires_at;
end;
$fn$;

revoke all on function public.rotate_platform_admin_invite(uuid, bytea) from public;
grant execute on function public.rotate_platform_admin_invite(uuid, bytea) to authenticated;

notify pgrst, 'reload schema';

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

-- =====================================================================
-- 0027 — Gravação atômica do item do cardápio
--
-- Rode DEPOIS do 0026. Idempotente: `create or replace`.
--
-- Até aqui, salvar um item eram várias chamadas: o item, cada variação, o
-- registro de cada mídia, a ordem, o enquadramento. Uma falha no meio
-- deixava o item pela metade — o caso clássico era o vídeo acima de 15 s,
-- recusado só DEPOIS de o item nascer.
--
-- Agora o navegador valida e sobe os arquivos antes, e esta função grava
-- tudo numa transação: o item existe completo, ou não existe.
--
-- SECURITY INVOKER: roda com as permissões de quem chamou. As políticas de
-- RLS de menu_items, menu_item_variants e menu_item_media (0011) continuam
-- sendo a autorização; nada aqui as contorna.
-- =====================================================================

create or replace function public.save_menu_item(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_mode text := p_payload ->> 'mode';
  v_restaurant uuid := (p_payload ->> 'restaurantId')::uuid;
  v_item uuid := (p_payload ->> 'itemId')::uuid;
  v_category uuid := (p_payload ->> 'categoryId')::uuid;
  v_pricing jsonb := coalesce(p_payload -> 'pricing', '{}'::jsonb);
  v_variants jsonb := coalesce(p_payload -> 'pricing' -> 'variants', '[]'::jsonb);
  v_media jsonb := coalesce(p_payload -> 'media', '[]'::jsonb);
  v_tags text[] := array(
    select jsonb_array_elements_text(coalesce(p_payload -> 'dietaryTags', '[]'::jsonb))
  );
  v_prefix text := (p_payload ->> 'restaurantId') || '/' || (p_payload ->> 'itemId') || '/';
  v_price integer;
  v_old_category uuid;
  v_entry jsonb;
  v_index bigint;
  v_new_media integer;
  v_total integer;
  v_removed jsonb;
begin
  if v_mode is null or v_mode not in ('create', 'update') then
    raise exception 'Operação inválida.' using errcode = 'P0001';
  end if;

  -- Preço. Com variações, o do item é DERIVADO: o menor entre elas. Ninguém
  -- o vê nem o edita; ele só existe para quem ordena ou filtra por preço.
  if v_pricing ->> 'mode' = 'variants' then
    if jsonb_array_length(v_variants) = 0 then
      raise exception 'Adicione ao menos uma variação.' using errcode = 'P0001';
    end if;
    select min((value ->> 'priceCents')::integer) into v_price
      from jsonb_array_elements(v_variants);
  else
    v_price := (v_pricing ->> 'basePriceCents')::integer;
    if v_price is null then
      raise exception 'Informe o preço.' using errcode = 'P0001';
    end if;
  end if;

  -- Item.
  if v_mode = 'create' then
    insert into public.menu_items (
      id, restaurant_id, category_id, name, description, base_price_cents,
      dietary_tags, is_visible, is_available, position
    )
    values (
      v_item,
      v_restaurant,
      v_category,
      p_payload ->> 'name',
      nullif(p_payload ->> 'description', ''),
      v_price,
      v_tags,
      (p_payload ->> 'isVisible')::boolean,
      (p_payload ->> 'isAvailable')::boolean,
      -- O item novo vai para o fim da categoria (antes nascia em 0).
      (select coalesce(max(mi.position) + 1, 0) from public.menu_items mi where mi.category_id = v_category)
    );
  else
    select mi.category_id into v_old_category
      from public.menu_items mi
     where mi.id = v_item and mi.restaurant_id = v_restaurant;
    if not found then
      raise exception 'Item não encontrado.' using errcode = 'P0001';
    end if;

    update public.menu_items mi set
      category_id = v_category,
      name = p_payload ->> 'name',
      description = nullif(p_payload ->> 'description', ''),
      base_price_cents = v_price,
      dietary_tags = v_tags,
      is_visible = (p_payload ->> 'isVisible')::boolean,
      is_available = (p_payload ->> 'isAvailable')::boolean,
      -- Trocar de categoria leva o item para o fim da nova.
      position = case
        when v_category is distinct from v_old_category then
          (select coalesce(max(other.position) + 1, 0) from public.menu_items other where other.category_id = v_category)
        else mi.position
      end
    where mi.id = v_item;
  end if;

  -- Variações. A ordem da lista é a posição.
  if v_pricing ->> 'mode' = 'variants' then
    if exists (
      select 1
        from jsonb_array_elements(v_variants) v
       where v ? 'id'
         and not exists (
           select 1 from public.menu_item_variants mv
            where mv.id = (v ->> 'id')::uuid and mv.item_id = v_item
         )
    ) then
      raise exception 'Variação não pertence a este item.' using errcode = 'P0001';
    end if;

    delete from public.menu_item_variants mv
     where mv.item_id = v_item
       and mv.id not in (
         select (v ->> 'id')::uuid from jsonb_array_elements(v_variants) v where v ? 'id'
       );

    for v_entry, v_index in
      select value, ordinality - 1 from jsonb_array_elements(v_variants) with ordinality
    loop
      if v_entry ? 'id' then
        update public.menu_item_variants set
          name = v_entry ->> 'name',
          price_cents = (v_entry ->> 'priceCents')::integer,
          is_available = (v_entry ->> 'isAvailable')::boolean,
          position = v_index
        where id = (v_entry ->> 'id')::uuid;
      else
        insert into public.menu_item_variants (restaurant_id, item_id, name, price_cents, is_available, position)
        values (
          v_restaurant,
          v_item,
          v_entry ->> 'name',
          (v_entry ->> 'priceCents')::integer,
          (v_entry ->> 'isAvailable')::boolean,
          v_index
        );
      end if;
    end loop;
  else
    delete from public.menu_item_variants where item_id = v_item;
  end if;

  -- Mídia. A ordem da lista é a ordem das telas; a primeira é a capa.
  if exists (
    select 1
      from jsonb_array_elements(v_media) m
     where m ->> 'source' = 'saved'
       and not exists (
         select 1 from public.menu_item_media mm
          where mm.id = (m ->> 'id')::uuid and mm.item_id = v_item
       )
  ) then
    raise exception 'Mídia não pertence a este item.' using errcode = 'P0001';
  end if;

  select count(*) into v_new_media from jsonb_array_elements(v_media) m where m ->> 'source' = 'new';
  v_total := jsonb_array_length(v_media);
  -- O teto vale quando algo é ACRESCENTADO. Itens antigos acima de 6 seguem
  -- válidos enquanto nada novo entra, como sempre foi.
  if v_new_media > 0 and v_total > 6 then
    raise exception 'O prato ficaria com % telas; o limite é 6.', v_total using errcode = 'P0001';
  end if;

  with removed as (
    delete from public.menu_item_media mm
     where mm.item_id = v_item
       and mm.id not in (
         select (m ->> 'id')::uuid from jsonb_array_elements(v_media) m where m ->> 'source' = 'saved'
       )
    returning mm.kind, mm.storage_path, mm.poster_path
  )
  select coalesce(
    jsonb_agg(jsonb_build_object('kind', kind, 'storagePath', storage_path, 'posterPath', poster_path)),
    '[]'::jsonb
  )
    into v_removed
    from removed;

  for v_entry, v_index in
    select value, ordinality - 1 from jsonb_array_elements(v_media) with ordinality
  loop
    if v_entry ->> 'source' = 'saved' then
      update public.menu_item_media set
        position = v_index,
        focal_x = (v_entry ->> 'focalX')::numeric,
        focal_y = (v_entry ->> 'focalY')::numeric
      where id = (v_entry ->> 'id')::uuid;
    else
      -- O caminho foi montado pelo servidor ao autorizar o envio; conferir o
      -- prefixo aqui fecha a porta para registrar arquivo de outro item.
      if left(v_entry ->> 'storagePath', length(v_prefix)) <> v_prefix
         or (v_entry ->> 'posterPath' is not null
             and left(v_entry ->> 'posterPath', length(v_prefix)) <> v_prefix) then
        raise exception 'Caminho de arquivo inválido.' using errcode = 'P0001';
      end if;

      insert into public.menu_item_media (
        restaurant_id, item_id, kind, position, storage_path, poster_path,
        width, height, duration_ms, focal_x, focal_y
      )
      values (
        v_restaurant,
        v_item,
        (v_entry ->> 'kind')::public.media_kind,
        v_index,
        v_entry ->> 'storagePath',
        v_entry ->> 'posterPath',
        (v_entry ->> 'width')::integer,
        (v_entry ->> 'height')::integer,
        (v_entry ->> 'durationMs')::integer,
        (v_entry ->> 'focalX')::numeric,
        (v_entry ->> 'focalY')::numeric
      );
    end if;
  end loop;

  return jsonb_build_object('itemId', v_item, 'removed', v_removed);
end;
$fn$;

revoke all on function public.save_menu_item(jsonb) from public, anon;
grant execute on function public.save_menu_item(jsonb) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- 0029 — Notificações genéricas, chave de servidor e push pelo disparador
--
-- Schema do produto web. Aplicada apenas em projetos vazios.
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
-- Substitui o push_events legado: o resgate de convite passa a chamar o
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
-- O mesmo sinal do convite resgatado: um convite resgatado NESTA transação pela pessoa
-- da membership (redeemed_at = now() é o instante da transação).

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

notify pgrst, 'reload schema';

-- =====================================================================
-- 0030 — Feedback anônimo do cardápio
--
-- Rode DEPOIS do 0029 (usa check_app_server_key e dispatch_notification).
-- Idempotente.
--
-- O cliente não tem conta. Por isso nada aqui é liberado ao anon por
-- política de tabela: o envio passa por begin_feedback e publish_feedback,
-- que exigem a chave do servidor (APP_SERVER_KEY). A escrita anônima no
-- bucket só vale para um caminho reservado por um rascunho de menos de 15
-- minutos. Só administradores do restaurante leem.
-- =====================================================================

create table if not exists public.restaurant_feedback (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  body text not null check (char_length(body) between 3 and 1000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  read_at timestamptz,
  unique (id, restaurant_id)
);

create table if not exists public.restaurant_feedback_photos (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null,
  restaurant_id uuid not null,
  storage_path text not null unique
    check (storage_path like restaurant_id::text || '/' || feedback_id::text || '/%'),
  width integer not null check (width between 1 and 1920),
  height integer not null check (height between 1 and 1920),
  position smallint not null check (position between 0 and 2),
  created_at timestamptz not null default now(),
  foreign key (feedback_id, restaurant_id)
    references public.restaurant_feedback (id, restaurant_id) on delete cascade,
  unique (feedback_id, position)
);

create index if not exists restaurant_feedback_published_idx
  on public.restaurant_feedback (restaurant_id, published_at desc, id desc)
  where status = 'published';
create index if not exists restaurant_feedback_unread_idx
  on public.restaurant_feedback (restaurant_id)
  where status = 'published' and read_at is null;
create index if not exists restaurant_feedback_draft_idx
  on public.restaurant_feedback (restaurant_id, created_at)
  where status = 'draft';

alter table public.restaurant_feedback enable row level security;
alter table public.restaurant_feedback_photos enable row level security;
revoke all on public.restaurant_feedback from public, anon, authenticated;
revoke all on public.restaurant_feedback_photos from public, anon, authenticated;
grant select, delete on public.restaurant_feedback to authenticated;
-- O admin só marca como lido/não lido. Texto e fotos do cliente não mudam.
grant update (read_at) on public.restaurant_feedback to authenticated;
grant select on public.restaurant_feedback_photos to authenticated;

drop policy if exists restaurant_feedback_select on public.restaurant_feedback;
create policy restaurant_feedback_select on public.restaurant_feedback
  for select to authenticated using (public.is_restaurant_admin(restaurant_id));
drop policy if exists restaurant_feedback_update on public.restaurant_feedback;
create policy restaurant_feedback_update on public.restaurant_feedback
  for update to authenticated
  using (public.is_restaurant_admin(restaurant_id))
  with check (public.is_restaurant_admin(restaurant_id));
drop policy if exists restaurant_feedback_delete on public.restaurant_feedback;
create policy restaurant_feedback_delete on public.restaurant_feedback
  for delete to authenticated using (public.is_restaurant_admin(restaurant_id));
drop policy if exists restaurant_feedback_photos_select on public.restaurant_feedback_photos;
create policy restaurant_feedback_photos_select on public.restaurant_feedback_photos
  for select to authenticated using (public.is_restaurant_admin(restaurant_id));

-- ---------- bucket privado ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-photos', 'feedback-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- A escrita anônima só alcança um caminho reservado por begin_feedback,
-- num rascunho de menos de 15 minutos. A assinatura do envio
-- (createSignedUploadUrl) passa por esta política.
create or replace function public.feedback_photo_upload_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
      from public.restaurant_feedback_photos ph
      join public.restaurant_feedback f on f.id = ph.feedback_id
     where ph.storage_path = p_name
       and f.status = 'draft'
       and f.created_at > now() - interval '15 minutes'
  );
$fn$;

revoke all on function public.feedback_photo_upload_allowed(text) from public;
grant execute on function public.feedback_photo_upload_allowed(text) to anon, authenticated;

drop policy if exists feedback_photos_insert on storage.objects;
create policy feedback_photos_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'feedback-photos' and public.feedback_photo_upload_allowed(name));

drop policy if exists feedback_photos_select on storage.objects;
create policy feedback_photos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'feedback-photos'
    and public.is_restaurant_admin(public.restaurant_id_from_storage_path(name))
  );

drop policy if exists feedback_photos_delete on storage.objects;
create policy feedback_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'feedback-photos'
    and public.is_restaurant_admin(public.restaurant_id_from_storage_path(name))
  );

-- ---------- começar ----------
-- Valida, aplica o teto do restaurante, cria o rascunho e reserva os
-- caminhos das fotos. Devolve uma linha por foto (ou uma, sem caminho,
-- quando não há fotos). Qualquer recusa desfaz tudo.
drop function if exists public.begin_feedback(text, text, text, jsonb);
create function public.begin_feedback(p_key text, p_slug text, p_body text, p_photos jsonb)
returns table (feedback_id uuid, storage_path text, photo_position smallint)
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
#variable_conflict use_column
declare
  v_restaurant_id uuid;
  v_feedback_id uuid;
  v_body text;
  v_count integer;
  v_photo jsonb;
  v_index integer := 0;
  v_ext text;
  v_width integer;
  v_height integer;
begin
  if not public.check_app_server_key(p_key) then
    raise exception 'server_key' using errcode = '42501';
  end if;

  select r.id into v_restaurant_id
    from public.restaurants r
   where r.slug = p_slug and r.status = 'active' and r.deleted_at is null;
  if v_restaurant_id is null then
    raise exception 'feedback_unavailable';
  end if;

  -- Tira caracteres de controle (menos a quebra de linha) e espaços nas pontas.
  v_body := btrim(regexp_replace(coalesce(p_body, ''), '[\x01-\x09\x0B-\x1F\x7F]', '', 'g'));
  if char_length(v_body) < 3 or char_length(v_body) > 1000 then
    raise exception 'feedback_invalid' using detail = 'texto';
  end if;

  if p_photos is null or jsonb_typeof(p_photos) <> 'array' or jsonb_array_length(p_photos) > 3 then
    raise exception 'feedback_invalid' using detail = 'fotos';
  end if;

  -- Teto do restaurante, rascunhos incluídos: é a barreira que não depende
  -- do IP, que pode ser falsificado.
  select count(*) into v_count from public.restaurant_feedback f
   where f.restaurant_id = v_restaurant_id and f.created_at > now() - interval '1 hour';
  if v_count >= 30 then
    raise exception 'feedback_capped';
  end if;
  select count(*) into v_count from public.restaurant_feedback f
   where f.restaurant_id = v_restaurant_id and f.created_at > now() - interval '24 hours';
  if v_count >= 200 then
    raise exception 'feedback_capped';
  end if;

  insert into public.restaurant_feedback (restaurant_id, body)
  values (v_restaurant_id, v_body)
  returning id into v_feedback_id;

  for v_photo in select value from jsonb_array_elements(p_photos) loop
    v_ext := case v_photo ->> 'mime'
      when 'image/jpeg' then 'jpg'
      when 'image/png' then 'png'
      when 'image/webp' then 'webp'
      when 'image/avif' then 'avif'
    end;
    begin
      v_width := (v_photo ->> 'width')::integer;
      v_height := (v_photo ->> 'height')::integer;
    exception when others then
      raise exception 'feedback_invalid' using detail = 'dimensões';
    end;
    if v_ext is null or v_width is null or v_height is null
       or v_width not between 1 and 1920 or v_height not between 1 and 1920 then
      raise exception 'feedback_invalid' using detail = 'foto';
    end if;

    insert into public.restaurant_feedback_photos
      (feedback_id, restaurant_id, storage_path, width, height, position)
    values (
      v_feedback_id,
      v_restaurant_id,
      v_restaurant_id::text || '/' || v_feedback_id::text || '/' || gen_random_uuid()::text || '.' || v_ext,
      v_width,
      v_height,
      v_index
    );
    v_index := v_index + 1;
  end loop;

  if v_index = 0 then
    return query select v_feedback_id, null::text, null::smallint;
  else
    return query
      select ph.feedback_id, ph.storage_path, ph.position
        from public.restaurant_feedback_photos ph
       where ph.feedback_id = v_feedback_id
       order by ph.position;
  end if;
end;
$fn$;

-- ---------- publicar ----------
-- Confere que cada foto chegou ao bucket, publica e avisa os
-- administradores do restaurante pelo disparador (0029).
drop function if exists public.publish_feedback(text, uuid);
create function public.publish_feedback(p_key text, p_feedback_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_feedback public.restaurant_feedback%rowtype;
  v_missing smallint;
  v_photos integer;
  v_restaurant_name text;
  v_excerpt text;
begin
  if not public.check_app_server_key(p_key) then
    raise exception 'server_key' using errcode = '42501';
  end if;

  select * into v_feedback from public.restaurant_feedback f
   where f.id = p_feedback_id
   for update;
  if not found or v_feedback.status <> 'draft' or v_feedback.created_at <= now() - interval '15 minutes' then
    raise exception 'feedback_expired';
  end if;

  select ph.position into v_missing
    from public.restaurant_feedback_photos ph
   where ph.feedback_id = p_feedback_id
     and not exists (
       select 1 from storage.objects o
        where o.bucket_id = 'feedback-photos' and o.name = ph.storage_path
     )
   order by ph.position
   limit 1;
  if v_missing is not null then
    raise exception 'feedback_photo_missing' using detail = (v_missing + 1)::text;
  end if;

  select count(*) into v_photos
    from public.restaurant_feedback_photos ph where ph.feedback_id = p_feedback_id;

  update public.restaurant_feedback f
     set status = 'published', published_at = now()
   where f.id = p_feedback_id;

  select r.name into v_restaurant_name
    from public.restaurants r where r.id = v_feedback.restaurant_id;

  -- Uma linha só no push e na central: quebras de linha viram espaço.
  v_excerpt := regexp_replace(v_feedback.body, '\s+', ' ', 'g');
  if char_length(v_excerpt) > 100 then
    v_excerpt := left(v_excerpt, 99) || '…';
  end if;
  if v_photos = 1 then
    v_excerpt := v_excerpt || ' · 1 foto';
  elsif v_photos > 1 then
    v_excerpt := v_excerpt || ' · ' || v_photos::text || ' fotos';
  end if;

  perform public.dispatch_notification(
    'feedback_received', 'painel', 'restaurant_roles',
    'Novo feedback em ' || coalesce(v_restaurant_name, 'seu restaurante'),
    v_excerpt,
    '/restaurantes/' || v_feedback.restaurant_id::text || '/feedbacks?f=' || p_feedback_id::text,
    p_restaurant_id => v_feedback.restaurant_id,
    p_roles => array['admin']::public.member_role[],
    p_data => jsonb_build_object('feedbackId', p_feedback_id, 'restaurantId', v_feedback.restaurant_id)
  );
end;
$fn$;

revoke all on function public.begin_feedback(text, text, text, jsonb) from public;
revoke all on function public.publish_feedback(text, uuid) from public;
grant execute on function public.begin_feedback(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.publish_feedback(text, uuid) to anon, authenticated;

-- ---------- excluir ----------
-- Pelo painel, com a sessão do admin. Apaga as notificações do feedback de
-- TODOS os admins (a política de notifications só deixa cada um mexer nas
-- suas), e depois o feedback; as fotos da tabela vão em cascata. Os
-- arquivos do bucket são removidos pela DAL antes desta chamada.
drop function if exists public.delete_feedback(uuid);
create function public.delete_feedback(p_feedback_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_restaurant_id uuid;
begin
  select f.restaurant_id into v_restaurant_id
    from public.restaurant_feedback f where f.id = p_feedback_id;
  if v_restaurant_id is null then
    raise exception 'feedback_not_found';
  end if;
  if not public.is_restaurant_admin(v_restaurant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.notifications n
   where n.kind = 'feedback_received'
     and n.data ->> 'feedbackId' = p_feedback_id::text;
  delete from public.restaurant_feedback f where f.id = p_feedback_id;
end;
$fn$;

revoke all on function public.delete_feedback(uuid) from public, anon;
grant execute on function public.delete_feedback(uuid) to authenticated;

notify pgrst, 'reload schema';

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

-- =====================================================================
-- 0032 — Notificação de teste
--
-- Rode DEPOIS do 0031. Idempotente.
--
-- "Enviar notificação de teste", na central: uma notificação de verdade,
-- pelo mesmo dispatch_notification, só para quem tocou no botão. Chega ao
-- vivo, aparece na central e vira push nos aparelhos ativos — e o que não
-- chegar mostra qual parte do caminho falhou.
-- =====================================================================

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('feedback_received', 'team_member_joined', 'restaurant_joined', 'test'));

drop function if exists public.send_test_notification(text, text);
create function public.send_test_notification(p_territory text, p_url text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_url text;
begin
  if v_uid is null then
    raise exception 'sessao ausente' using errcode = '42501';
  end if;
  if p_territory not in ('admin', 'painel') then
    raise exception 'territorio invalido';
  end if;

  -- Tocar no aviso volta para a tela de onde o teste saiu. A raiz `/` não
  -- cabe no check da coluna (mínimo de 2 caracteres); /restaurantes existe
  -- nos dois territórios.
  v_url := case
    when p_url ~ '^/[^/]' and char_length(p_url) <= 300 then p_url
    else '/restaurantes'
  end;

  perform public.dispatch_notification(
    'test', p_territory, 'users',
    'Notificação de teste',
    'Se você está vendo isto, as notificações estão funcionando.',
    v_url,
    p_user_ids => array[v_uid]
  );
end;
$fn$;

revoke all on function public.send_test_notification(text, text) from public, anon;
grant execute on function public.send_test_notification(text, text) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- 0034 — Chamados de atendimento associados a plaquinhas/mesas
-- =====================================================================

alter table public.menu_tags
  add column if not exists table_number integer;

alter table public.menu_tags
  drop constraint if exists menu_tags_table_number_positive;
alter table public.menu_tags
  add constraint menu_tags_table_number_positive
  check (table_number is null or table_number > 0);

alter table public.menu_tags
  drop constraint if exists menu_tags_id_restaurant_id_key;
alter table public.menu_tags
  add constraint menu_tags_id_restaurant_id_key unique (id, restaurant_id);

create unique index if not exists menu_tags_active_table_number_key
  on public.menu_tags (restaurant_id, table_number)
  where is_active and table_number is not null;

drop policy if exists menu_tags_insert_admin on public.menu_tags;
create policy menu_tags_insert_admin on public.menu_tags
  for insert to authenticated
  with check (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

drop policy if exists menu_tags_update_member on public.menu_tags;
drop policy if exists menu_tags_update_admin on public.menu_tags;
create policy menu_tags_update_admin on public.menu_tags
  for update to authenticated
  using (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin())
  with check (public.is_restaurant_admin(restaurant_id) or public.is_platform_admin());

create table if not exists public.service_calls (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  tag_id uuid not null,
  table_number integer not null check (table_number > 0),
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  foreign key (tag_id, restaurant_id)
    references public.menu_tags(id, restaurant_id) on delete restrict,
  check (
    (status = 'pending' and resolved_at is null and resolved_by is null)
    or (status = 'resolved' and resolved_at is not null)
  )
);

create unique index if not exists service_calls_one_pending_per_table
  on public.service_calls (restaurant_id, table_number)
  where status = 'pending';
create index if not exists service_calls_restaurant_status_created_idx
  on public.service_calls (restaurant_id, status, created_at desc);
create index if not exists service_calls_tag_created_idx
  on public.service_calls (tag_id, created_at desc);

alter table public.service_calls enable row level security;
revoke all on public.service_calls from public, anon, authenticated;
grant select on public.service_calls to authenticated;

drop policy if exists service_calls_select_member on public.service_calls;
create policy service_calls_select_member on public.service_calls
  for select to authenticated
  using (public.is_member(restaurant_id));

alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('feedback_received', 'team_member_joined', 'restaurant_joined', 'test', 'service_call_received'));

-- Include whether the plaque is mapped so the public menu can omit the
-- call action for legacy plaques while still opening the menu itself.
drop function if exists public.resolve_menu_tag(text);
create function public.resolve_menu_tag(p_token text)
returns table (restaurant_slug text, tag_label text, table_number integer)
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
begin
  return query
    update public.menu_tags t
       set last_seen_at = now()
      from public.restaurants r
     where r.id = t.restaurant_id
       and t.public_token = p_token
       and t.is_active
       and r.status = 'active'
       and r.deleted_at is null
    returning r.slug, t.label, t.table_number;
end;
$fn$;
revoke all on function public.resolve_menu_tag(text) from public;
grant execute on function public.resolve_menu_tag(text) to anon, authenticated;

create or replace function public.service_calls_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  begin
    perform realtime.broadcast_changes(
      'service_calls:' || coalesce(new.restaurant_id, old.restaurant_id)::text,
      tg_op,
      tg_op,
      tg_table_name,
      tg_table_schema,
      new,
      old
    );
  exception when others then
    raise warning 'service_calls broadcast failed: %', sqlerrm;
  end;
  return coalesce(new, old);
end;
$fn$;

drop trigger if exists service_calls_broadcast on public.service_calls;
create trigger service_calls_broadcast
  after insert or update on public.service_calls
  for each row execute function public.service_calls_broadcast();

drop policy if exists service_calls_receive_restaurant_topic on realtime.messages;
create policy service_calls_receive_restaurant_topic on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) ~ '^service_calls:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.is_member(substring((select realtime.topic()) from 15)::uuid)
  );

create or replace function public.request_service_call(p_key text, p_token text, p_allow_create boolean default true)
returns table (call_id uuid, table_number integer, status text, created boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
#variable_conflict use_column
declare
  v_tag_id uuid;
  v_restaurant_id uuid;
  v_table_number integer;
  v_call_id uuid;
  v_created boolean := false;
  v_restaurant_name text;
  v_recent_count integer;
begin
  if not public.check_app_server_key(p_key) then
    raise exception 'server_key' using errcode = '42501';
  end if;
  if p_token is null or char_length(p_token) <> 16 or p_token !~ '^[0-9A-HJKMNP-TV-Z]{16}$' then
    raise exception 'service_call_unavailable';
  end if;

  -- Locking the plaque serializes retries and cross-IP requests for the same table.
  select t.id, t.restaurant_id, t.table_number, r.name
    into v_tag_id, v_restaurant_id, v_table_number, v_restaurant_name
    from public.menu_tags t
    join public.restaurants r on r.id = t.restaurant_id
   where t.public_token = p_token
     and t.is_active
     and t.table_number > 0
     and public.is_restaurant_public(t.restaurant_id)
   for update of t;
  if not found then
    raise exception 'service_call_unavailable';
  end if;

  select c.id into v_call_id
    from public.service_calls c
   where c.restaurant_id = v_restaurant_id
     and c.table_number = v_table_number and c.status = 'pending';
  if found then
    return query select v_call_id, v_table_number, 'pending'::text, false;
    return;
  end if;

  if not p_allow_create then
    raise exception 'service_call_ip_limited';
  end if;

  -- A table may call repeatedly after service, but a lost/abused QR cannot
  -- generate an unbounded stream of historical calls and staff notifications.
  select count(*) into v_recent_count
    from public.service_calls c
   where c.tag_id = v_tag_id and c.created_at > now() - interval '1 hour';
  if v_recent_count >= 10 then
    raise exception 'service_call_limited';
  end if;

  insert into public.service_calls (restaurant_id, tag_id, table_number)
  values (v_restaurant_id, v_tag_id, v_table_number)
  on conflict do nothing
  returning id into v_call_id;
  v_created := found;

  if not v_created then
    select c.id into v_call_id
      from public.service_calls c
     where c.restaurant_id = v_restaurant_id
       and c.table_number = v_table_number and c.status = 'pending';
  else
    perform public.dispatch_notification(
      'service_call_received', 'painel', 'restaurant_roles',
      'Chamado da mesa ' || v_table_number::text,
      'Solicitação de atendimento em ' || coalesce(v_restaurant_name, 'seu restaurante') || '.',
      '/restaurantes/' || v_restaurant_id::text || '/chamados?c=' || v_call_id::text,
      p_restaurant_id => v_restaurant_id,
      p_roles => array['admin', 'cashier', 'attendant', 'waiter']::public.member_role[],
      p_data => jsonb_build_object('callId', v_call_id, 'tableNumber', v_table_number, 'restaurantId', v_restaurant_id)
    );
  end if;

  return query select v_call_id, v_table_number, 'pending'::text, v_created;
end;
$fn$;

create or replace function public.resolve_service_call(p_call_id uuid)
returns table (
  call_id uuid,
  restaurant_id uuid,
  tag_id uuid,
  table_number integer,
  status text,
  created_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
#variable_conflict use_column
declare
  v_call public.service_calls%rowtype;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_call from public.service_calls c where c.id = p_call_id for update;
  if not found then
    raise exception 'service_call_not_found';
  end if;
  if not public.is_member(v_call.restaurant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_call.status = 'pending' then
    update public.service_calls c
       set status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
     where c.id = p_call_id
     returning c.* into v_call;
  end if;
  return query select v_call.id, v_call.restaurant_id, v_call.tag_id, v_call.table_number,
                      v_call.status, v_call.created_at, v_call.resolved_at, v_call.resolved_by;
end;
$fn$;

revoke all on function public.service_calls_broadcast() from public, anon, authenticated;
revoke all on function public.request_service_call(text, text, boolean) from public;
revoke all on function public.resolve_service_call(uuid) from public, anon;
grant execute on function public.request_service_call(text, text, boolean) to anon, authenticated;
grant execute on function public.resolve_service_call(uuid) to authenticated;

notify pgrst, 'reload schema';

-- Web account cleanup: logout global keeps web subscriptions in sync.
create or replace function public.revoke_my_web_push_subscriptions()
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  delete from public.push_subscriptions s where s.user_id = auth.uid();
end;
$fn$;
revoke all on function public.revoke_my_web_push_subscriptions() from public, anon;
grant execute on function public.revoke_my_web_push_subscriptions() to authenticated;
notify pgrst, 'reload schema';

