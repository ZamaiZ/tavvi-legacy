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
