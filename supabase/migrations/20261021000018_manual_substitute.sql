-- =====================================================================
-- Indisponível com troca MANUAL (pedido do dono, 21/10).
-- Quem estava escalado e marca "Indisponível" sai do turno. Se o turno fica
-- incompleto, a coordenação (e o responsável) recebe um alerta com a sugestão
-- do próximo (backup primeiro, depois a prioridade do sorteio), mas ninguém é
-- colocado sozinho: a coordenação escolhe em Agenda → Substituir.
-- A substituição manual passa a avisar quem entrou.
-- Devolve de mark_unavailable: 'registrado' | 'removido' | 'aguardando'.
-- =====================================================================
create or replace function public.mark_unavailable(p_fixed uuid, p_date date, p_vol uuid default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamp := now() at time zone 'America/Sao_Paulo';
  v_me uuid := (select auth.uid());
  v_vol uuid := coalesce(p_vol, (select auth.uid()));
  f public.fixed_schedules; n public.needs;
  v_by text; v_name text; v_sug uuid; v_draw uuid; v_period uuid; v_left int; v_when text; r uuid; v_picked boolean := false;
begin
  if v_me is null or not public.is_active_user() then raise exception 'Acesso negado.'; end if;
  select * into f from public.fixed_schedules where id = p_fixed;
  if f.id is null then raise exception 'Escala fixa não encontrada.'; end if;
  if v_vol = v_me then
    if coalesce(public.my_role() in ('voluntario', 'responsavel'), false) is false then raise exception 'Acesso negado.'; end if;
  elsif not public.manages_fixed(p_fixed) then
    raise exception 'Acesso negado.';
  end if;
  if p_date is null or extract(dow from p_date) <> f.weekday then raise exception 'Esta data não é um dia desta escala fixa.'; end if;
  if p_date < v_now::date then raise exception 'Esta data já passou.'; end if;

  select * into n from public.needs where fixed_id = p_fixed and date = p_date;
  if n.id is not null then
    if (n.date + n.start_time::time) <= v_now then raise exception 'Este turno já começou.'; end if;
    select dp.draw_id, d.period_id into v_draw, v_period
    from public.draw_picks dp join public.draws d on d.id = dp.draw_id and d.status = 'publicado'
    where dp.need_id = n.id and dp.volunteer_id = v_vol
      and not exists (select 1 from public.attendance a where a.need_id = n.id and a.volunteer_id = v_vol and a.status in ('cancelado', 'substituido'));
    v_picked := v_draw is not null;
  end if;
  if not v_picked and not exists (select 1 from public.fixed_members m where m.fixed_id = p_fixed and m.volunteer_id = v_vol) then
    raise exception 'Esta pessoa não participa desta escala fixa.';
  end if;

  select name into v_by from public.profiles where id = v_me;
  select name into v_name from public.profiles where id = v_vol;
  insert into public.fixed_exceptions (fixed_id, volunteer_id, date, created_by)
  values (p_fixed, v_vol, p_date, left(coalesce(v_by, ''), 120))
  on conflict (fixed_id, volunteer_id, date) do update
    set cancelled_at = null, created_at = now(), created_by = excluded.created_by;
  v_when := public._fmt_br(p_date) || ' às ' || coalesce(n.start_time, f.start_time);

  if not v_picked then
    for r in
      select p.id from public.profiles p where p.id = f.responsavel_id and p.status = 'ativo'
      union
      select p.id from public.profiles p where p.role in ('admin', 'supervisor') and p.status = 'ativo'
        and not exists (select 1 from public.profiles x where x.id = f.responsavel_id and x.status = 'ativo')
    loop
      if r <> v_me then
        perform public._notify(r, 'indisponivel', v_name || ' avisou que não pode em ' || v_when || '.', null);
      end if;
    end loop;
    return 'registrado';
  end if;

  select count(*) into v_left from public.draw_picks dp
  where dp.draw_id = v_draw and dp.need_id = n.id and dp.volunteer_id <> v_vol
    and not exists (select 1 from public.attendance a where a.need_id = n.id and a.volunteer_id = dp.volunteer_id and a.status in ('cancelado', 'substituido'));

  -- Sai do turno. A troca é sempre manual: a coordenação recebe o aviso com uma sugestão.
  insert into public.attendance (period_id, need_id, volunteer_id, status, recorded_by)
  values (v_period, n.id, v_vol, 'cancelado', coalesce(v_by, ''))
  on conflict (need_id, volunteer_id) do update set status = 'cancelado', recorded_at = now(), recorded_by = excluded.recorded_by;

  if v_left >= n.slots then
    for r in select public._need_recipients(n.id) loop
      if r <> v_me then
        perform public._notify(r, 'indisponivel', v_name || ' ficou indisponível em ' || v_when || '. O turno continua completo.', null);
      end if;
    end loop;
    return 'removido';
  end if;

  -- Sugestão (não aplicada): primeiro quem está de backup; depois os participantes, pela prioridade do sorteio.
  select x.vid into v_sug
  from (
    select m.volunteer_id as vid, 1 as tier
    from public.fixed_members m
    join public.profiles p on p.id = m.volunteer_id and p.status = 'ativo' and p.role in ('voluntario', 'responsavel')
    where m.fixed_id = p_fixed and m.volunteer_id <> v_vol
      and not exists (
        select 1 from public.fixed_exceptions e
        where e.fixed_id = p_fixed and e.volunteer_id = m.volunteer_id and e.date = p_date and e.cancelled_at is null
      )
      and not exists (select 1 from public.draw_picks dp where dp.draw_id = v_draw and dp.need_id = n.id and dp.volunteer_id = m.volunteer_id)
      and not exists (select 1 from public.attendance a where a.need_id = n.id and a.volunteer_id = m.volunteer_id)
      and not public._busy_on(m.volunteer_id, p_date, n.id)
    union all
    select a.volunteer_id, 0
    from public.attendance a
    join public.profiles p on p.id = a.volunteer_id and p.status = 'ativo' and p.role in ('voluntario', 'responsavel')
    where a.need_id = n.id and a.volunteer_id <> v_vol
      and public._is_backup(n.id, a.volunteer_id)
      and not public._busy_on(a.volunteer_id, p_date, n.id)
  ) x
  left join public._served_counts() sc on sc.volunteer_id = x.vid
  order by x.tier, coalesce(sc.c3, 0), coalesce(sc.c12, 0), random()
  limit 1;

  for r in select public._need_recipients(n.id, true) loop
    perform public._notify(r, 'indisponivel',
      'Atenção: ' || v_name || ' ficou indisponível em ' || v_when || ' (' || v_left || ' de ' || n.slots || ' pessoas). '
      || case when v_sug is null then 'Não há ninguém livre para sugerir.'
              else 'Sugestão de substituto: ' || (select p.name from public.profiles p where p.id = v_sug) || '.' end
      || ' Escolha em Agenda → Substituir.', null);
  end loop;
  return 'aguardando';
end $$;

-- Substituição manual: o substituto pode ser alguém que tinha saído deste turno (um backup)
-- e recebe um aviso de que foi escalado.
create or replace function public.substitute(p_need uuid, p_out uuid, p_in uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_draw uuid; v_period uuid; v_by text; c record; v_in_pick boolean; n public.needs; v_out_name text;
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
  update public.attendance set status = 'escalado', recorded_at = now(), recorded_by = coalesce(v_by, '')
  where need_id = p_need and volunteer_id = p_in and status in ('cancelado', 'substituido');
  insert into public.substitutions (period_id, need_id, out_id, in_id, recorded_by, reason)
  values (v_period, p_need, p_out, p_in, coalesce(v_by, ''), left(coalesce(p_reason, ''), 500));
  insert into public.attendance (period_id, need_id, volunteer_id, status, recorded_by)
  values (v_period, p_need, p_out, 'substituido', coalesce(v_by, ''))
  on conflict (need_id, volunteer_id) do update set status = 'substituido', recorded_at = now(), recorded_by = excluded.recorded_by;
  select * into n from public.needs where id = p_need;
  select name into v_out_name from public.profiles where id = p_out;
  if n.date >= (now() at time zone 'America/Sao_Paulo')::date then
    perform public._notify(p_in, 'substituto_escalado',
      'Você foi escalado(a) em ' || public._fmt_br(n.date) || ' às ' || n.start_time || ' no lugar de ' || coalesce(v_out_name, 'outra pessoa') || '.', null);
  end if;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.mark_unavailable(uuid, date, uuid), public.substitute(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.public_app_name() to anon, authenticated;
