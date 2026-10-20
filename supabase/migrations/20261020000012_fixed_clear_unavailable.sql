-- =====================================================================
-- Escalas fixas (parte 4): desfazer o aviso "Indisponível".
-- =====================================================================

-- Desfaz o aviso (só para datas futuras). Se a pessoa já foi substituída, ela continua fora do turno.
create or replace function public.clear_unavailable(p_fixed uuid, p_date date, p_vol uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := (select auth.uid()); v_vol uuid := coalesce(p_vol, (select auth.uid()));
begin
  if v_me is null or not public.is_active_user() then raise exception 'Acesso negado.'; end if;
  if v_vol <> v_me and not public.manages_fixed(p_fixed) then raise exception 'Acesso negado.'; end if;
  if p_date < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Esta data já passou.'; end if;
  delete from public.fixed_exceptions where fixed_id = p_fixed and volunteer_id = v_vol and date = p_date;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.clear_unavailable(uuid, date, uuid) to authenticated;
grant execute on function public.public_app_name() to anon, authenticated;
