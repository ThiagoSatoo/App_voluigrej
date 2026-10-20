-- =====================================================================
-- Escalas fixas (parte 7): "backup".
-- Quem estava escalado, saiu ("Indisponível") e depois tocou em "Disponível"
-- sem conseguir voltar (o lugar foi ocupado ou o turno seguiu completo) fica
-- de BACKUP daquele turno: a coordenação pode trocá-lo por alguém escalado
-- (Substituir) e, se outra pessoa ficar indisponível, o backup é chamado
-- antes dos demais. Quem marcou "Indisponível" sem estar escalado e depois
-- "Disponível" apenas volta a contar para o sorteio (sem aviso).
-- Devolve de mark_available: 'disponivel' | 'voltou' | 'backup'.
-- =====================================================================

-- É backup deste turno? (saiu do turno e desfez o "Indisponível" desta data)
create or replace function public._is_backup(p_need uuid, p_vol uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.needs n
    join public.attendance a on a.need_id = n.id and a.volunteer_id = p_vol and a.status in ('cancelado', 'substituido')
    where n.id = p_need and n.fixed_id is not null
      and exists (
        select 1 from public.fixed_exceptions e
        where e.fixed_id = n.fixed_id and e.volunteer_id = p_vol and e.date = n.date and e.cancelled_at is not null
      )
  )
$$;

create or replace function public.mark_available(p_fixed uuid, p_date date, p_vol uuid default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamp := now() at time zone 'America/Sao_Paulo';
  v_me uuid := (select auth.uid());
  v_vol uuid := coalesce(p_vol, (select auth.uid()));
  f public.fixed_schedules; n public.needs;
  v_by text; v_name text; v_when text; v_status public.attendance_status; v_in_pick boolean; v_left int; v_result text := 'disponivel'; r uuid;
begin
  if v_me is null or not public.is_active_user() then raise exception 'Acesso negado.'; end if;
  select * into f from public.fixed_schedules where id = p_fixed;
  if f.id is null then raise exception 'Escala fixa não encontrada.'; end if;
  if v_vol = v_me then
    if coalesce(public.my_role() in ('voluntario', 'responsavel'), false) is false then raise exception 'Acesso negado.'; end if;
  elsif not public.manages_fixed(p_fixed) then
    raise exception 'Acesso negado.';
  end if;
  if p_date is null or p_date < v_now::date then raise exception 'Esta data já passou.'; end if;

  select * into n from public.needs where fixed_id = p_fixed and date = p_date;
  if n.id is not null and (n.date + n.start_time::time) <= v_now then raise exception 'Este turno já começou.'; end if;

  update public.fixed_exceptions set cancelled_at = now()
  where fixed_id = p_fixed and volunteer_id = v_vol and date = p_date and cancelled_at is null;
  if not found then raise exception 'Não havia aviso de indisponível nesta data.'; end if;

  if n.id is not null then
    select a.status into v_status from public.attendance a where a.need_id = n.id and a.volunteer_id = v_vol;
    if v_status in ('cancelado', 'substituido') then
      select exists (
        select 1 from public.draw_picks dp join public.draws d on d.id = dp.draw_id and d.status = 'publicado'
        where dp.need_id = n.id and dp.volunteer_id = v_vol
      ) into v_in_pick;
      select count(*) into v_left
      from public.draw_picks dp join public.draws d on d.id = dp.draw_id and d.status = 'publicado'
      where dp.need_id = n.id and dp.volunteer_id <> v_vol
        and not exists (select 1 from public.attendance a where a.need_id = n.id and a.volunteer_id = dp.volunteer_id and a.status in ('cancelado', 'substituido'));
      select name into v_by from public.profiles where id = v_me;
      if v_status = 'cancelado' and v_in_pick and v_left < n.slots then
        update public.attendance set status = 'escalado', recorded_at = now(), recorded_by = coalesce(v_by, '')
        where need_id = n.id and volunteer_id = v_vol;
        v_result := 'voltou';
      else
        v_result := 'backup';
      end if;
    end if;
  end if;

  -- Sem estar escalado: só volta a contar para o sorteio, sem aviso.
  if v_result = 'disponivel' then return v_result; end if;

  select name into v_name from public.profiles where id = v_vol;
  v_when := public._fmt_br(p_date) || ' às ' || n.start_time;
  for r in select public._need_recipients(n.id) loop
    if r <> v_me then
      perform public._notify(r, 'indisponivel',
        case when v_result = 'voltou' then v_name || ' voltou para a escala de ' || v_when || '.'
             else v_name || ' está de backup em ' || v_when || '. Se quiser, troque na Agenda.' end, null);
    end if;
  end loop;
  return v_result;
end $$;

-- Substituição manual: o substituto pode ser alguém que tinha saído deste turno (um backup).
create or replace function public.substitute(p_need uuid, p_out uuid, p_in uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_draw uuid; v_period uuid; v_by text; c record; v_in_pick boolean;
begin
  if not public.manages_need(p_need) then raise exception 'Acesso negado.'; end if;
  select dp.draw_id, d.period_id into v_draw, v_period
  from public.draw_picks dp join public.draws d on d.id = dp.draw_id and d.status = 'publicado'
  where dp.need_id = p_need and dp.volunteer_id = p_out;
  if v_draw is null then raise exception 'Este voluntário não está escalado neste turno.'; end if;
  if not exists (select 1 from public.profiles where id = p_in and status = 'ativo' and role in ('voluntario', 'responsavel')) then
    raise exception 'Substituto inválido.';
  end if;
  select exists (select 1 from public.draw_picks where draw_id = v_draw and need_id = p_need and volunteer_id = p_in) into v_in_pick;
  if v_in_pick and not exists (
    select 1 from public.attendance where need_id = p_need and volunteer_id = p_in and status in ('cancelado', 'substituido')
  ) then
    raise exception 'O substituto já está neste turno.';
  end if;
  select name into v_by from public.profiles where id = (select auth.uid());
  if not v_in_pick then
    select sc.recent3m, sc.last12m into c from public.scale_counts() sc where sc.volunteer_id = p_in;
    update public.draw_picks set volunteer_id = p_in, recent3m = coalesce(c.recent3m, 0), last12m = coalesce(c.last12m, 0), tiebreak = 'Substituição'
    where draw_id = v_draw and need_id = p_need and volunteer_id = p_out;
  end if;
  -- Quem entra e já tinha saído deste turno volta como escalado.
  update public.attendance set status = 'escalado', recorded_at = now(), recorded_by = coalesce(v_by, '')
  where need_id = p_need and volunteer_id = p_in and status in ('cancelado', 'substituido');
  insert into public.substitutions (period_id, need_id, out_id, in_id, recorded_by, reason)
  values (v_period, p_need, p_out, p_in, coalesce(v_by, ''), left(coalesce(p_reason, ''), 500));
  insert into public.attendance (period_id, need_id, volunteer_id, status, recorded_by)
  values (v_period, p_need, p_out, 'substituido', coalesce(v_by, ''))
  on conflict (need_id, volunteer_id) do update set status = 'substituido', recorded_at = now(), recorded_by = excluded.recorded_by;
end $$;

revoke execute on all functions in schema public from public, anon;
revoke execute on function public._is_backup(uuid, uuid) from authenticated;
grant execute on function public.mark_available(uuid, date, uuid), public.substitute(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.public_app_name() to anon, authenticated;
