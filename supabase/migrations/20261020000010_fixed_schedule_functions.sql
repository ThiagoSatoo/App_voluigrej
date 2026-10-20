-- =====================================================================
-- Escalas fixas (parte 2): sorteio por escala fixa e publicação por escala fixa.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções internas
-- ---------------------------------------------------------------------
-- Dias servidos por voluntário (3 e 12 meses). p_exclude_draw: ignora os turnos futuros
-- do sorteio que está sendo refeito, para não "punir" quem estava nele.
create or replace function public._served_counts(p_exclude_draw uuid default null)
returns table (volunteer_id uuid, c3 integer, c12 integer)
language sql stable security definer set search_path = '' as $$
  with now_ as (select (now() at time zone 'America/Sao_Paulo') as t, (now() at time zone 'America/Sao_Paulo')::date as d),
  served as (
    select dp.volunteer_id, n.date
    from public.draw_picks dp
    join public.draws dr on dr.id = dp.draw_id and dr.status = 'publicado'
    join public.needs n on n.id = dp.need_id
    where not (dp.draw_id is not distinct from p_exclude_draw and (n.date + n.start_time::time) > (select t from now_))
      and not exists (
        select 1 from public.attendance a
        where a.need_id = dp.need_id and a.volunteer_id = dp.volunteer_id and a.status in ('cancelado', 'substituido')
      )
    union all
    select ap.volunteer_id, o.date
    from public.applications ap join public.opportunities o on o.id = ap.opportunity_id
    where ap.status = 'selecionado'
  )
  select s.volunteer_id,
    (count(*) filter (where s.date >= (select d from now_) - interval '3 months'))::int,
    (count(*) filter (where s.date >= (select d from now_) - interval '12 months'))::int
  from served s
  group by s.volunteer_id
$$;

-- Já tem outro compromisso nesta data? (escala publicada, rascunho de outra escala fixa ou vaga confirmada)
create or replace function public._busy_on(p_vol uuid, p_date date, p_need uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.draw_picks dp
    join public.draws d on d.id = dp.draw_id
    join public.needs n on n.id = dp.need_id
    where dp.volunteer_id = p_vol and n.date = p_date and n.id <> p_need
      and (d.status = 'publicado' or (d.status = 'rascunho' and d.fixed_id is not null))
      and not exists (
        select 1 from public.attendance a
        where a.need_id = n.id and a.volunteer_id = p_vol and a.status in ('cancelado', 'substituido')
      )
  ) or exists (
    select 1 from public.applications ap join public.opportunities o on o.id = ap.opportunity_id
    where ap.volunteer_id = p_vol and ap.status = 'selecionado' and o.date = p_date
  )
$$;

-- Quem recebe avisos de um turno: o responsável ativo; sem ele (ou se p_all), toda a coordenação.
create or replace function public._need_recipients(p_need uuid, p_all boolean default false)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select p.id from public.needs n
  join public.profiles p on p.id = n.responsavel_id and p.status = 'ativo'
  where n.id = p_need
  union
  select p.id from public.profiles p
  where p.role in ('admin', 'supervisor') and p.status = 'ativo'
    and (p_all or not exists (
      select 1 from public.needs n join public.profiles r on r.id = n.responsavel_id and r.status = 'ativo'
      where n.id = p_need
    ))
$$;

-- ---------------------------------------------------------------------
-- Sorteio de uma escala fixa para um mês (fica em rascunho)
-- Prioridade: menos dias servidos em 3 meses, depois em 12 meses (contando o que
-- já foi sorteado neste mês), e desempate aleatório. Assim todos se igualam.
-- ---------------------------------------------------------------------
create or replace function public.draw_fixed(p_fixed uuid, p_year integer, p_month integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamp := now() at time zone 'America/Sao_Paulo';
  v_today date := v_now::date;
  f public.fixed_schedules;
  v_first date; v_last date; v_period uuid; v_pub uuid; v_draw uuid; v_num int; v_by text;
  v_run jsonb := '{}'::jsonb; v_rank int; v_elig int; d date; n record; c record;
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

  -- Cria (ou atualiza) os turnos futuros do mês a partir da escala fixa.
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

  -- Turnos futuros: sorteio pela prioridade.
  for n in
    select * from public.needs where fixed_id = p_fixed and period_id = v_period and (date + start_time::time) > v_now
    order by date
  loop
    select count(*) into v_elig
    from public.fixed_members m join public.profiles p on p.id = m.volunteer_id and p.status = 'ativo' and p.role in ('voluntario', 'responsavel')
    where m.fixed_id = p_fixed
      and not exists (select 1 from public.fixed_exceptions e where e.fixed_id = p_fixed and e.volunteer_id = m.volunteer_id and e.date = n.date)
      and not public._busy_on(m.volunteer_id, n.date, n.id);
    insert into public.draw_slots (draw_id, need_id, eligible) values (v_draw, n.id, v_elig);
    v_rank := 0;
    for c in
      select m.volunteer_id as vid,
        coalesce(sc.c3, 0) + coalesce((v_run ->> m.volunteer_id::text)::int, 0) as r3,
        coalesce(sc.c12, 0) + coalesce((v_run ->> m.volunteer_id::text)::int, 0) as r12
      from public.fixed_members m
      join public.profiles p on p.id = m.volunteer_id and p.status = 'ativo' and p.role in ('voluntario', 'responsavel')
      left join public._served_counts(v_pub) sc on sc.volunteer_id = m.volunteer_id
      where m.fixed_id = p_fixed
        and not exists (select 1 from public.fixed_exceptions e where e.fixed_id = p_fixed and e.volunteer_id = m.volunteer_id and e.date = n.date)
        and not public._busy_on(m.volunteer_id, n.date, n.id)
      order by 2, 3, random()
      limit n.slots
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

-- Publicar troca só o sorteio publicado da MESMA escala fixa (ou o mensal antigo, sem escala fixa).
create or replace function public.publish_draw(p_draw uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_period uuid; v_fixed uuid; v_status public.draw_status;
begin
  if not public.is_staff() then raise exception 'Acesso negado.'; end if;
  select period_id, fixed_id, status into v_period, v_fixed, v_status from public.draws where id = p_draw;
  if v_period is null then raise exception 'Sorteio não encontrado.'; end if;
  if v_status = 'substituido' then raise exception 'Este sorteio foi substituído por um mais novo.'; end if;
  update public.draws set status = 'substituido'
    where period_id = v_period and status = 'publicado' and id <> p_draw and fixed_id is not distinct from v_fixed;
  update public.draws set status = 'publicado' where id = p_draw;
  update public.periods set status = 'publicada' where id = v_period and status <> 'encerrado';
end $$;

-- O sorteio mensal antigo só substitui rascunhos antigos (sem escala fixa).
create or replace function public.save_draw(p_period uuid, p_slots jsonb, p_created_by text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_draw uuid; v_num int; s jsonb; pk jsonb;
begin
  if not public.is_staff() then raise exception 'Acesso negado.'; end if;
  perform 1 from public.periods where id = p_period for update;
  if not found then raise exception 'Período não encontrado.'; end if;
  update public.draws set status = 'substituido' where period_id = p_period and status = 'rascunho' and fixed_id is null;
  select coalesce(max(number), 0) + 1 into v_num from public.draws where period_id = p_period;
  insert into public.draws (period_id, number, created_by, status)
  values (p_period, v_num, left(coalesce(p_created_by, ''), 120), 'rascunho') returning id into v_draw;
  for s in select * from jsonb_array_elements(p_slots) loop
    if not exists (select 1 from public.needs where id = (s ->> 'needId')::uuid and period_id = p_period and fixed_id is null) then
      raise exception 'Turno inválido no sorteio.';
    end if;
    insert into public.draw_slots (draw_id, need_id, eligible) values (v_draw, (s ->> 'needId')::uuid, coalesce((s ->> 'eligible')::int, 0));
    for pk in select * from jsonb_array_elements(coalesce(s -> 'picks', '[]'::jsonb)) loop
      if not exists (
        select 1 from public.availabilities a
        where a.need_id = (s ->> 'needId')::uuid and a.volunteer_id = (pk ->> 'volunteerId')::uuid and a.value = 'disponivel'
      ) then raise exception 'Voluntário sem disponibilidade não pode ser sorteado.'; end if;
      insert into public.draw_picks (draw_id, need_id, volunteer_id, priority, recent3m, last12m, tiebreak)
      values (v_draw, (s ->> 'needId')::uuid, (pk ->> 'volunteerId')::uuid, (pk ->> 'priority')::int,
              coalesce((pk ->> 'recent3m')::int, 0), coalesce((pk ->> 'last12m')::int, 0), left(coalesce(pk ->> 'tiebreak', ''), 60));
    end loop;
  end loop;
  update public.periods set status = 'sorteado' where id = p_period and status <> 'publicada';
  return v_draw;
end $$;

revoke execute on all functions in schema public from public, anon;
revoke execute on function public._served_counts(uuid), public._busy_on(uuid, date, uuid), public._need_recipients(uuid, boolean) from authenticated;
grant execute on function public.draw_fixed(uuid, integer, integer), public.publish_draw(uuid), public.save_draw(uuid, jsonb, text) to authenticated;
grant execute on function public.public_app_name() to anon, authenticated;
