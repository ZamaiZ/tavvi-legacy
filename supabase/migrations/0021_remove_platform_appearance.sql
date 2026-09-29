drop function if exists public.update_platform_appearance(text, text, inet);
drop table if exists public.platform_appearance;
drop function if exists public.touch_platform_appearance();

notify pgrst, 'reload schema';
