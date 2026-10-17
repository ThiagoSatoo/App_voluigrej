create or replace function public.run_scheduled_notifications()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamp := now() at time zone 'America/Sao_Paulo';
  v_today date := v_now::date;
  opp record; vol record; st record; x record; r uuid; c int; t timestamp; h int; ty public.notif_type;
begin
  -- Vaga abaixo do mínimo faltando menos de 24h
  for opp in select * from public.opportunities where date between v_today and v_today + 1 loop
    t := opp.date + opp.start_time::time;
    c := public._active_count(opp.id);
    if c < opp.min and v_now >= t - interval '24 hours' and v_now < t then
      for r in select public._opp_recipients(opp.id) loop
        perform public._notify(r, 'abaixo_minimo_24h',
          'Faltam menos de 24h para ' || public._fmt_br(opp.date) || ' às ' || opp.start_time || ' e a necessidade está abaixo do mínimo (' || c || '/' || opp.min || ').',
          opp.id, '24h:' || opp.id || ':' || r);
      end loop;
    end if;
  end loop;

  -- Aniversários (avisa a equipe)
  for vol in
    select p.id, p.name, d.birth_date from public.profiles p join public.volunteer_details d on d.id = p.id
    where p.status = 'ativo' and d.birth_date is not null
  loop
    for st in select id from public.profiles where role in ('admin', 'supervisor') and status = 'ativo' loop
      if to_char(vol.birth_date, 'MM-DD') = to_char(v_today, 'MM-DD') then
        perform public._notify(st.id, 'aniversario_dia', 'Hoje é aniversário de ' || vol.name || '! 🎉', null,
          'bday:' || vol.id || ':' || extract(year from v_today) || ':' || st.id);
      end if;
      if to_char(vol.birth_date, 'MM-DD') = to_char(v_today + 7, 'MM-DD') then
        perform public._notify(st.id, 'aniversario_7d', 'Daqui a 7 dias (' || to_char(v_today + 7, 'DD/MM') || ') é aniversário de ' || vol.name || '.', null,
          'bday7:' || vol.id || ':' || extract(year from v_today) || ':' || st.id);
      end if;
    end loop;
  end loop;

  -- Lembretes: só a janela mais próxima que já começou (24h, 12h, 6h, 3h, 1h)
  for x in
    select ap.volunteer_id as rid, o.id::text as ref, o.date, o.start_time, 'você está escalado(a)' as label
    from public.applications ap join public.opportunities o on o.id = ap.opportunity_id
    where o.status = 'confirmada' and ap.status = 'selecionado' and o.date between v_today and v_today + 1
    union all
    select rr, o.id::text, o.date, o.start_time, 'escala confirmada com ' || public._active_count(o.id) || ' voluntário(s)'
    from public.opportunities o cross join lateral public._opp_recipients(o.id) rr
    where o.status = 'confirmada' and o.date between v_today and v_today + 1
    union all
    select dp.volunteer_id, n.id::text, n.date, n.start_time, 'você está escalado(a)'
    from public.draw_picks dp join public.draws d on d.id = dp.draw_id and d.status = 'publicado'
    join public.needs n on n.id = dp.need_id
    where n.date between v_today and v_today + 1
      and not exists (select 1 from public.attendance a where a.need_id = n.id and a.volunteer_id = dp.volunteer_id and a.status in ('cancelado', 'substituido'))
  loop
    t := x.date + x.start_time::time;
    if v_now >= t then continue; end if;
    foreach h in array array[1, 3, 6, 12, 24] loop
      ty := ('lembrete_' || h || 'h')::public.notif_type;
      if v_now >= t - make_interval(hours => h)
         and not exists (select 1 from public.notif_prefs np where np.user_id = x.rid and np.type = ty and np.enabled = false) then
        perform public._notify(x.rid, ty,
          'Lembrete: ' || x.label || ' em ' || public._fmt_br(x.date) || ' às ' || x.start_time || ' (faltam menos de ' || h || 'h).',
          null, 'rem:' || x.ref || ':' || x.rid || ':' || h);
        exit;
      end if;
    end loop;
  end loop;
end $$;

revoke execute on function public.run_scheduled_notifications() from public, anon, authenticated;
