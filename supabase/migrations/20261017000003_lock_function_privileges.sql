-- Funções novas recebem EXECUTE para PUBLIC/anon por padrão. Fecha tudo e libera só o necessário.
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

-- Funções internas: ninguém de fora chama (só o próprio banco e o agendador).
revoke execute on function public._notify(uuid, public.notif_type, text, uuid, text) from authenticated;
revoke execute on function public._opp_recipients(uuid) from authenticated;
revoke execute on function public._threshold_notify(uuid, int, int, text, text) from authenticated;
revoke execute on function public._active_count(uuid) from authenticated;
revoke execute on function public.run_scheduled_notifications() from authenticated;
revoke execute on function public._fmt_br(date) from authenticated;
