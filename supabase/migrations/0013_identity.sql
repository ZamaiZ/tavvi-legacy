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
