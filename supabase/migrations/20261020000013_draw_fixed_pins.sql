-- =====================================================================
-- Escalas fixas (parte 5): o sorteio respeita quem a coordenação fixou e
-- ignora avisos de "Indisponível" que foram desfeitos (cancelled_at).
-- Em cada data: primeiro os fixados (se não avisaram que não podem e não
-- têm outro compromisso no dia), depois o restante pela prioridade.
-- =====================================================================
create or replace function public.draw_fixed(p_fixed uuid, p_year integer, p_month integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamp := now() at time zone 'America/Sao_Paulo';
  v_today date := v_now::date;
  f public.fixed_schedules;
  v_first date; v_last date; v_period uuid; v_pub uuid; v_draw uuid; v_num int; v_by text;
  v_run jsonb := '{}'::jsonb; v_rank int; v_elig int; v_pins uuid[]; d date; n record; c record;
begin
  if not public.is_staff() then raise exception 'Acesso negado.'; end if;
  select * into f from public.fixed_schedules where id = p_fixed for update;
  if f.id is null then raise exception 'Escala fixa não encontrada.'; end if;
  if not f.active then raise exception 'Ative a escala fixa antes de sortear.'; end if;
  if p_month is null or p_month not between 1 and 12 or p_year is null or p_year not between 2020 and 2100 then
    raise exception 'Mês inválido.';
  end if;
  v_first := make_date(p_year, p_month, 1);
  v_last := (v_first + interval '1 month' - interval '1 day')::date;
  if v_last < v_today then raise exception 'Esse mês já passou.'; end if;

  insert into public.periods (month, year, open_date, deadline, status)
  values (p_month, p_year, v_first, v_first, 'rascunho')
  on conflict (month, year) do nothing;
  select id into v_period from public.periods where month = p_month and year = p_year for update;

  for d in
    select g::date from generate_series(greatest(v_first, v_today)::timestamp, v_last::timestamp, interval '1 day') g
    where extract(dow from g) = f.weekday
  loop
    insert into public.needs as nd (period_id, date, start_time, end_time, slots, responsavel_id, fixed_id)
    values (v_period, d, f.start_time, f.end_time, f.slots, f.responsavel_id, f.id)
    on conflict (fixed_id, date) where fixed_id is not null do update
      set start_time = excluded.start_time, end_time = excluded.end_time, slots = excluded.slots, responsavel_id = excluded.responsavel_id
      where (nd.date + nd.start_time::time) > v_now;
  end loop;

  select id into v_pub from public.draws where period_id = v_period and fixed_id = p_fixed and status = 'publicado';
  update public.draws set status = 'substituido' where period_id = v_period and fixed_id = p_fixed and status = 'rascunho';
  select coalesce(max(number), 0) + 1 into v_num from public.draws where period_id = v_period;
  select name into v_by from public.profiles where id = (select auth.uid());
  insert into public.draws (period_id, number, created_by, status, fixed_id)
  values (v_period, v_num, left(coalesce(v_by, ''), 120), 'rascunho', p_fixed) returning id into v_draw;

  -- Turnos que já começaram: mantém quem estava publicado (histórico não muda).
  for n in
    select * from public.needs where fixed_id = p_fixed and period_id = v_period and (date + start_time::time) <= v_now
  loop
    insert into public.draw_slots (draw_id, need_id, eligible)
    values (v_draw, n.id, coalesce((select s.eligible from public.draw_slots s where s.draw_id = v_pub and s.need_id = n.id), 0));
    insert into public.draw_picks (draw_id, need_id, volunteer_id, priority, recent3m, last12m, tiebreak)
    select v_draw, dp.need_id, dp.volunteer_id, dp.priority, dp.recent3m, dp.last12m, dp.tiebreak
    from public.draw_picks dp where dp.draw_id = v_pub and dp.need_id = n.id;
  end loop;

  for n in
    select * from public.needs where fixed_id = p_fixed and period_id = v_period and (date + start_time::time) > v_now
    order by date
  loop
    v_pins := coalesce((select fp.volunteer_ids from public.fixed_pins fp where fp.fixed_id = p_fixed and fp.date = n.date), '{}'::uuid[]);
    select count(*) into v_elig
    from (select m.volunteer_id as vid from public.fixed_members m where m.fixed_id = p_fixed union select unnest(v_pins)) x
    join public.profiles p on p.id = x.vid and p.status = 'ativo' and p.role in ('voluntario', 'responsavel')
    where not exists (
        select 1 from public.fixed_exceptions e
        where e.fixed_id = p_fixed and e.volunteer_id = x.vid and e.date = n.date and e.cancelled_at is null
      )
      and not public._busy_on(x.vid, n.date, n.id);
    insert into public.draw_slots (draw_id, need_id, eligible) values (v_draw, n.id, v_elig);
    v_rank := 0;

    -- 1) Fixados pela coordenação, na ordem escolhida.
    for c in
      select u.vid,
        coalesce(sc.c3, 0) + coalesce((v_run ->> u.vid::text)::int, 0) as r3,
        coalesce(sc.c12, 0) + coalesce((v_run ->> u.vid::text)::int, 0) as r12
      from unnest(v_pins) with ordinality as u (vid, ord)
      join public.profiles p on p.id = u.vid and p.status = 'ativo' and p.role in ('voluntario', 'responsavel')
      left join public._served_counts(v_pub) sc on sc.volunteer_id = u.vid
      where not exists (
          select 1 from public.fixed_exceptions e
          where e.fixed_id = p_fixed and e.volunteer_id = u.vid and e.date = n.date and e.cancelled_at is null
        )
        and not public._busy_on(u.vid, n.date, n.id)
      order by u.ord
      limit n.slots
    loop
      v_rank := v_rank + 1;
      insert into public.draw_picks (draw_id, need_id, volunteer_id, priority, recent3m, last12m, tiebreak)
      values (v_draw, n.id, c.vid, v_rank, c.r3, c.r12, 'Fixado pela coordenação');
      v_run := jsonb_set(v_run, array[c.vid::text], to_jsonb(coalesce((v_run ->> c.vid::text)::int, 0) + 1));
    end loop;

    -- 2) Restante das vagas: participantes pela prioridade.
    for c in
      select m.volunteer_id as vid,
        coalesce(sc.c3, 0) + coalesce((v_run ->> m.volunteer_id::text)::int, 0) as r3,
        coalesce(sc.c12, 0) + coalesce((v_run ->> m.volunteer_id::text)::int, 0) as r12
      from public.fixed_members m
      join public.profiles p on p.id = m.volunteer_id and p.status = 'ativo' and p.role in ('voluntario', 'responsavel')
      left join public._served_counts(v_pub) sc on sc.volunteer_id = m.volunteer_id
      where m.fixed_id = p_fixed
        and not (m.volunteer_id = any (v_pins))
        and not exists (
          select 1 from public.fixed_exceptions e
          where e.fixed_id = p_fixed and e.volunteer_id = m.volunteer_id and e.date = n.date and e.cancelled_at is null
        )
        and not public._busy_on(m.volunteer_id, n.date, n.id)
      order by 2, 3, random()
      limit greatest(n.slots - v_rank, 0)
    loop
      v_rank := v_rank + 1;
      insert into public.draw_picks (draw_id, need_id, volunteer_id, priority, recent3m, last12m, tiebreak)
      values (v_draw, n.id, c.vid, v_rank, c.r3, c.r12, 'Escala fixa');
      v_run := jsonb_set(v_run, array[c.vid::text], to_jsonb(coalesce((v_run ->> c.vid::text)::int, 0) + 1));
    end loop;
  end loop;

  update public.periods set status = 'sorteado' where id = v_period and status in ('rascunho', 'aberta', 'encerrada');
  return v_draw;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.draw_fixed(uuid, integer, integer) to authenticated;
grant execute on function public.public_app_name() to anon, authenticated;
