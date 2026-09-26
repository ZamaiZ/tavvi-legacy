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
