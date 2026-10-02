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
