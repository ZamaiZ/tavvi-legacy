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
