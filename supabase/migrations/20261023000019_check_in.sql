-- =====================================================================
-- "Estou presente": o próprio voluntário (ou responsável) confirma a presença
-- no turno em que está escalado, de 1 hora antes do início até o fim (horário de
-- São Paulo). Fora dessa janela, só a coordenação/responsável marca (Agenda/Turnos).
-- Devolve: 'presente' (marcou agora) | 'ja_presente' (já estava marcado).
-- =====================================================================
create or replace function public.check_in(p_need uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamp := now() at time zone 'America/Sao_Paulo';
  v_me uuid := (select auth.uid());
  n public.needs; v_period uuid; v_status public.attendance_status; v_name text;
begin
  if v_me is null or not public.is_active_user()
     or coalesce(public.my_role() in ('voluntario', 'responsavel'), false) is false then
    raise exception 'Acesso negado.';
  end if;
  select * into n from public.needs where id = p_need;
  if n.id is null then raise exception 'Turno não encontrado.'; end if;

  select d.period_id into v_period
  from public.draw_picks dp join public.draws d on d.id = dp.draw_id and d.status = 'publicado'
  where dp.need_id = n.id and dp.volunteer_id = v_me
  limit 1;
  select a.status into v_status from public.attendance a where a.need_id = n.id and a.volunteer_id = v_me;
  if v_period is null or v_status in ('cancelado', 'substituido') then
    raise exception 'Você não está escalado neste turno.';
  end if;

  if v_now < (n.date + n.start_time::time) - interval '1 hour' then
    raise exception 'A presença só pode ser marcada a partir de 1 hora antes do início.';
  end if;
  if v_now > (n.date + n.end_time::time) then
    raise exception 'O horário deste turno já terminou. Peça à coordenação para marcar sua presença.';
  end if;
  if v_status = 'presente' then return 'ja_presente'; end if;

  select name into v_name from public.profiles where id = v_me;
  insert into public.attendance (period_id, need_id, volunteer_id, status, recorded_by)
  values (v_period, n.id, v_me, 'presente', left(coalesce(v_name, ''), 120))
  on conflict (need_id, volunteer_id) do update
    set status = 'presente', recorded_at = now(), recorded_by = excluded.recorded_by;
  return 'presente';
end $$;

revoke execute on function public.check_in(uuid) from public, anon;
grant execute on function public.check_in(uuid) to authenticated;
