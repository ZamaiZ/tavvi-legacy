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
