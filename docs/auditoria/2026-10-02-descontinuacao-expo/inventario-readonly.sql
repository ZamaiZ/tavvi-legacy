-- Proposta de inventário; NÃO executada nesta auditoria.
-- Executar no projeto identificado, com acesso SQL de leitura autorizado.
-- Apenas SELECT: não altera esquema, dados, sessão Auth ou configurações.
-- Não extrair tokens, hashes de contratos, segredos ou payloads de webhook.

select nspname
from pg_namespace
where nspname in ('supabase_migrations', 'cron', 'vault', 'net', 'auth', 'realtime');

select extname, extversion from pg_extension order by extname;

-- Assinaturas, configurações e permissões efetivas.
select p.oid::regprocedure::text as signature,
       p.prosecdef as security_definer,
       p.proconfig,
       has_function_privilege('anon', p.oid, 'execute') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'execute') as service_execute,
       md5(p.prosrc) as definition_digest
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by signature;

-- Localiza referências nos corpos sem imprimir o corpo completo.
select p.oid::regprocedure::text as signature,
       p.prosrc ~* 'platform_admin_device_contracts' as references_contracts,
       p.prosrc ~* 'mobile_push_tokens' as references_expo_push,
       p.prosrc ~* 'mobile_device|revoke_all_my_devices' as references_device_functions
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'auth', 'storage', 'realtime')
  and p.prosrc ~* 'platform_admin_device_contracts|mobile_push_tokens|mobile_device|revoke_all_my_devices'
order by signature;

select ns.nspname as schema_name, c.relname as table_name,
       t.tgname, t.tgenabled, p.oid::regprocedure::text as function_signature
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace ns on ns.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and ns.nspname in ('public', 'auth', 'storage', 'realtime')
order by 1, 2, 3;

select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage', 'realtime')
  and c.relkind in ('r', 'p')
order by 1, 2;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage', 'realtime')
order by 1, 2, 3;

select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema in ('public', 'storage', 'realtime')
order by 1, 2, 3, 4;

-- Executar enquanto a tabela de contratos ainda existir.
select count(*) as total,
       count(*) filter (where revoked_at is null) as active,
       count(*) filter (where revoked_at is not null) as revoked
from public.platform_admin_device_contracts;

select count(*) as expo_push_tokens from public.mobile_push_tokens;
select count(*) as web_push_subscriptions from public.push_subscriptions;

-- Conhecer o esquema Auth sem assumir colunas internas opcionais.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'auth'
  and table_name in ('sessions', 'refresh_tokens', 'identities')
order by table_name, ordinal_position;

-- Contagens não identificam quais sessões pertencem ao Expo.
select count(*) as sessions,
       count(distinct user_id) as accounts,
       min(created_at) as oldest_created,
       max(created_at) as newest_created
from auth.sessions;

-- Complementar após confirmar os schemas/extensões:
-- * versões/names de schema_migrations, sem statements;
-- * dependências pg_depend e referências em corpos PL/pgSQL;
-- * cron: agendamento, ativo, nomes e flags de referência, sem command cru;
-- * Vault: inventário de nomes/metadados sem secret/decrypted_secret;
-- * webhooks/pg_net: indicadores e contagens, sem headers/body/URLs com secrets;
-- * funções remotas/Edge Functions e consumidores de endpoints;
-- * Management API/dashboard: Auth, redirects, hooks, JWT/session policies,
--   SMTP, Realtime private-only e configuração efetiva por ambiente.
