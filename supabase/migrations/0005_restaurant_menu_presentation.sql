-- Add the restaurant-level public menu presentation without changing existing
-- menu data or applying the clean-install baseline to an existing database.
alter table public.restaurants
  add column if not exists menu_presentation text not null default 'immersive';

update public.restaurants
   set menu_presentation = 'immersive'
 where menu_presentation is null
    or menu_presentation not in ('immersive', 'catalog-list', 'catalog-grid');

alter table public.restaurants
  alter column menu_presentation set default 'immersive',
  alter column menu_presentation set not null;

alter table public.restaurants
  drop constraint if exists restaurants_menu_presentation_supported;
alter table public.restaurants
  add constraint restaurants_menu_presentation_supported
  check (menu_presentation in ('immersive', 'catalog-list', 'catalog-grid'));
