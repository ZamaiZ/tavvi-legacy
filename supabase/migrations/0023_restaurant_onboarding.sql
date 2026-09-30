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
