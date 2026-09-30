-- =====================================================================
-- SCHEMA COMPLETO — cole este arquivo inteiro no SQL Editor do Supabase.
--
-- GERADO AUTOMATICAMENTE por supabase/build-schema.sh a partir das
-- migrations numeradas. Nao edite este arquivo: edite a migration
-- correspondente em supabase/migrations/ e rode o script de novo.
--
-- Pode rodar quantas vezes quiser. Tudo aqui e idempotente, entao
-- executar de novo nao quebra nada e nao duplica nada: o banco
-- converge para este estado, venha de onde vier.
-- =====================================================================


-- #####################################################################
-- ### 0001_base.sql
-- #####################################################################

-- =====================================================================
-- 0001 — Base: enums do dominio e gatilho de updated_at
--
-- COMO RODAR: cole este arquivo inteiro no SQL Editor do Supabase e
-- execute. Os arquivos sao numerados e devem rodar EM ORDEM (0001, 0002,
-- ...). Rodar o mesmo arquivo duas vezes e inofensivo: tudo aqui e
-- idempotente, porque o SQL Editor nao guarda estado de migracao e nao
-- sabe o que ja foi aplicado.
--
-- Nenhuma extensao e instalada. sha256(bytea) e convert_to(text, name)
-- sao nativas do pg_catalog desde o Postgres 11 e substituem digest() do
-- pgcrypto; slug e forcado a minusculas por CHECK, o que dispensa citext.
-- Alem de uma dependencia a menos, pg_catalog e mais previsivel do que o
-- schema extensions quando toda funcao roda com search_path travado.
-- =====================================================================

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


-- #####################################################################
-- ### 0002_identity.sql
-- #####################################################################

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


-- #####################################################################
-- ### 0003_tenancy.sql
-- #####################################################################

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


-- #####################################################################
-- ### 0004_menu.sql
-- #####################################################################

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


-- #####################################################################
-- ### 0005_infra.sql
-- #####################################################################

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


-- #####################################################################
-- ### 0006_rls.sql
-- #####################################################################

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


-- #####################################################################
-- ### 0007_privileged.sql
-- #####################################################################

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


-- #####################################################################
-- ### 0008_storage.sql
-- #####################################################################

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


-- #####################################################################
-- ### 0009_members.sql
-- #####################################################################

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


-- #####################################################################
-- ### 0010_media_poster.sql
-- #####################################################################

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


-- #####################################################################
-- ### 0011_roles.sql
-- #####################################################################

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


-- #####################################################################
-- ### 0012_invites.sql
-- #####################################################################

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


-- #####################################################################
-- ### 0013_identity.sql
-- #####################################################################

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


-- #####################################################################
-- ### 0014_storage_roles.sql
-- #####################################################################

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
    -- O prefixo do caminho É a fronteira do inquilino, verificada pelo
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


-- #####################################################################
-- ### 0015_media_focal.sql
-- #####################################################################

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
