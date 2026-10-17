revoke truncate, trigger, references on all tables in schema public from authenticated, anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated, anon;
revoke insert, delete on public.app_settings from authenticated;
