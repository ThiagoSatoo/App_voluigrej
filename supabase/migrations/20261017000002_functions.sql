-- =====================================================================
-- Funções seguras (RPC), notificações automáticas e armazenamento de fotos
-- =====================================================================

-- Permissões de execução das funções usadas nas regras de acesso.
grant execute on function
  public.my_role(), public.is_active_user(), public.is_staff(), public.is_admin(),
  public.manages_need(uuid), public.manages_opportunity(uuid), public.manages_volunteer(uuid),
  public.is_colleague(uuid), public.can_view_profile(uuid), public.in_published_slot(uuid, uuid),
  public.period_is_open(uuid)
to authenticated;

-- ---------------------------------------------------------------------
-- Notificações (uso interno — não expostas aos clientes)
-- ---------------------------------------------------------------------
create or replace function public._notify(p_recipient uuid, p_type public.notif_type, p_message text, p_opp uuid default null, p_key text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_recipient is null then return; end if;
  if exists (select 1 from public.notif_prefs np where np.user_id = p_recipient and np.type = p_type and np.enabled = false) then
    return;
  end if;
  insert into public.notifications (type, recipient_id, message, opportunity_id, key)
  values (p_type, p_recipient, p_message, p_opp, p_key)
  on conflict (key) do nothing;
end $$;

-- Quem recebe avisos de uma vaga: o responsável ativo; sem ele, toda a equipe (admin + supervisores).
create or replace function public._opp_recipients(p_opp uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select p.id from public.opportunities o
  join public.profiles p on p.id = o.responsavel_id and p.status = 'ativo'
  where o.id = p_opp
  union all
  select p.id from public.profiles p
  where p.role in ('admin', 'supervisor') and p.status = 'ativo'
    and not exists (
      select 1 from public.opportunities o join public.profiles r on r.id = o.responsavel_id and r.status = 'ativo'
      where o.id = p_opp
    )
$$;

create or replace function public._fmt_br(d date) returns text language sql immutable set search_path = '' as $$
  select to_char(d, 'DD/MM/YYYY')
$$;

create or replace function public._active_count(p_opp uuid) returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.applications a where a.opportunity_id = p_opp and a.status in ('candidatado', 'selecionado')
$$;

create or replace function public._threshold_notify(p_opp uuid, p_before int, p_after int, p_prefix text default '', p_key_prefix text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.opportunities; r uuid; w text;
begin
  select * into o from public.opportunities where id = p_opp;
  w := public._fmt_br(o.date) || ' às ' || o.start_time;
  for r in select public._opp_recipients(p_opp) loop
    if p_before < o.max and p_after >= o.max then
      perform public._notify(r, 'escala_completa', p_prefix || 'Escala completa em ' || w || ': ' || p_after || '/' || o.max || ' voluntários (máximo atingido).', p_opp,
        case when p_key_prefix is null then null else p_key_prefix || ':escala_completa:' || p_opp || ':' || r end);
    elsif p_before < o.min and p_after >= o.min then
      perform public._notify(r, 'minimo_atingido', p_prefix || 'Mínimo atingido em ' || w || ': ' || p_after || ' de ' || o.min || ' necessários (máximo ' || o.max || ').', p_opp,
        case when p_key_prefix is null then null else p_key_prefix || ':minimo_atingido:' || p_opp || ':' || r end);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Contagens (prioridade do sorteio e lotação das vagas)
-- ---------------------------------------------------------------------
create or replace function public.scale_counts()
returns table (volunteer_id uuid, recent3m integer, last12m integer, last_date date)
language sql stable security definer set search_path = '' as $$
  with today as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  scales as (
    select dp.volunteer_id, n.date
    from public.draw_picks dp
    join public.draws dr on dr.id = dp.draw_id and dr.status = 'publicado'
    join public.needs n on n.id = dp.need_id
    where not exists (
      select 1 from public.attendance a where a.need_id = dp.need_id and a.volunteer_id = dp.volunteer_id and a.status in ('cancelado', 'substituido')
    )
    union all
    select ap.volunteer_id, o.date
    from public.applications ap join public.opportunities o on o.id = ap.opportunity_id
    where ap.status = 'selecionado'
  )
  select p.id,
    count(s.date) filter (where s.date >= (select d from today) - interval '3 months')::int,
    count(s.date) filter (where s.date >= (select d from today) - interval '12 months')::int,
    max(s.date) filter (where s.date <= (select d from today))
  from public.profiles p
  left join scales s on s.volunteer_id = p.id
  where p.role in ('voluntario', 'responsavel')
    and public.is_active_user()
    and (p.id = (select auth.uid()) or public.manages_volunteer(p.id))
  group by p.id
$$;

create or replace function public.opportunity_counts()
returns table (opportunity_id uuid, active integer)
language sql stable security definer set search_path = '' as $$
  select o.id, public._active_count(o.id) from public.opportunities o where public.is_active_user()
$$;

-- ---------------------------------------------------------------------
-- Candidaturas
-- ---------------------------------------------------------------------
create or replace function public.apply_to_opportunity(p_opp uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.opportunities; me public.profiles; v_before int; v_after int; r uuid;
begin
  select * into me from public.profiles where id = (select auth.uid()) and status = 'ativo' and role in ('voluntario', 'responsavel');
  if me.id is null then raise exception 'Somente voluntários ativos podem se candidatar.'; end if;
  select * into o from public.opportunities where id = p_opp for update;
  if o.id is null or o.status <> 'aberta' then raise exception 'Esta escala não está mais aberta.'; end if;
  if o.date < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Esta escala já passou.'; end if;
  v_before := public._active_count(p_opp);
  insert into public.applications (opportunity_id, volunteer_id, status, updated_at)
  values (p_opp, me.id, 'candidatado', now())
  on conflict (opportunity_id, volunteer_id) do update set status = 'candidatado', updated_at = now();
  v_after := public._active_count(p_opp);
  for r in select public._opp_recipients(p_opp) loop
    perform public._notify(r, 'nova_candidatura',
      me.name || ' se candidatou para ' || public._fmt_br(o.date) || ' às ' || o.start_time || ' (' || v_after || '/' || o.max || ').', p_opp);
  end loop;
  perform public._threshold_notify(p_opp, v_before, v_after);
end $$;

create or replace function public.cancel_application(p_opp uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.opportunities; me public.profiles; v_left int; r uuid; msg text;
begin
  select * into me from public.profiles where id = (select auth.uid()) and status = 'ativo';
  if me.id is null then raise exception 'Acesso negado.'; end if;
  select * into o from public.opportunities where id = p_opp for update;
  if o.id is null or o.status <> 'aberta' then raise exception 'A seleção já foi confirmada.'; end if;
  update public.applications set status = 'cancelado', updated_at = now()
  where opportunity_id = p_opp and volunteer_id = me.id and status = 'candidatado';
  if not found then raise exception 'Você não tem candidatura ativa nesta escala.'; end if;
  v_left := (select count(*) from public.applications where opportunity_id = p_opp and status = 'candidatado');
  msg := case when v_left < o.min
    then me.name || ' cancelou a candidatura. A escala está abaixo do mínimo (' || v_left || '/' || o.min || ').'
    else me.name || ' cancelou a candidatura (' || v_left || '/' || o.max || ').' end;
  for r in select public._opp_recipients(p_opp) loop
    perform public._notify(r, 'candidatura_cancelada', msg, p_opp);
  end loop;
end $$;

create or replace function public.confirm_selection(p_opp uuid, p_selected uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare o public.opportunities; n int;
begin
  if not public.manages_opportunity(p_opp) then raise exception 'Acesso negado.'; end if;
  select * into o from public.opportunities where id = p_opp for update;
  if o.status <> 'aberta' then raise exception 'Esta seleção já foi confirmada.'; end if;
  n := coalesce(array_length(p_selected, 1), 0);
  if n > o.max then raise exception 'Selecione no máximo % voluntários.', o.max; end if;
  update public.applications set
    status = case when volunteer_id = any (coalesce(p_selected, '{}')) then 'selecionado'::public.application_status else 'nao_selecionado'::public.application_status end,
    updated_at = now()
  where opportunity_id = p_opp and status = 'candidatado';
  update public.opportunities set status = 'confirmada' where id = p_opp;
  perform public._threshold_notify(p_opp, 0, n, 'Seleção confirmada — ', 'sel');
end $$;

-- ---------------------------------------------------------------------
-- Sorteio
-- ---------------------------------------------------------------------
create or replace function public.save_draw(p_period uuid, p_slots jsonb, p_created_by text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_draw uuid; v_num int; s jsonb; pk jsonb;
begin
  if not public.is_staff() then raise exception 'Acesso negado.'; end if;
  perform 1 from public.periods where id = p_period for update;
  if not found then raise exception 'Período não encontrado.'; end if;
  update public.draws set status = 'substituido' where period_id = p_period and status = 'rascunho';
  select coalesce(max(number), 0) + 1 into v_num from public.draws where period_id = p_period;
  insert into public.draws (period_id, number, created_by, status)
  values (p_period, v_num, left(coalesce(p_created_by, ''), 120), 'rascunho') returning id into v_draw;
  for s in select * from jsonb_array_elements(p_slots) loop
    if not exists (select 1 from public.needs where id = (s ->> 'needId')::uuid and period_id = p_period) then
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

create or replace function public.publish_draw(p_draw uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_period uuid;
begin
  if not public.is_staff() then raise exception 'Acesso negado.'; end if;
  select period_id into v_period from public.draws where id = p_draw;
  if v_period is null then raise exception 'Sorteio não encontrado.'; end if;
  update public.draws set status = 'substituido' where period_id = v_period and status = 'publicado' and id <> p_draw;
  update public.draws set status = 'publicado' where id = p_draw;
  update public.periods set status = 'publicada' where id = v_period;
end $$;

-- ---------------------------------------------------------------------
-- Substituição (supervisor ou responsável do turno)
-- ---------------------------------------------------------------------
create or replace function public.substitute(p_need uuid, p_out uuid, p_in uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_draw uuid; v_period uuid; v_by text; c record;
begin
  if not public.manages_need(p_need) then raise exception 'Acesso negado.'; end if;
  select dp.draw_id, d.period_id into v_draw, v_period
  from public.draw_picks dp join public.draws d on d.id = dp.draw_id and d.status = 'publicado'
  where dp.need_id = p_need and dp.volunteer_id = p_out;
  if v_draw is null then raise exception 'Este voluntário não está escalado neste turno.'; end if;
  if not exists (select 1 from public.profiles where id = p_in and status = 'ativo' and role in ('voluntario', 'responsavel')) then
    raise exception 'Substituto inválido.';
  end if;
  if exists (select 1 from public.draw_picks where draw_id = v_draw and need_id = p_need and volunteer_id = p_in) then
    raise exception 'O substituto já está neste turno.';
  end if;
  select name into v_by from public.profiles where id = (select auth.uid());
  select sc.recent3m, sc.last12m into c from public.scale_counts() sc where sc.volunteer_id = p_in;
  update public.draw_picks set volunteer_id = p_in, recent3m = coalesce(c.recent3m, 0), last12m = coalesce(c.last12m, 0), tiebreak = 'Substituição'
  where draw_id = v_draw and need_id = p_need and volunteer_id = p_out;
  insert into public.substitutions (period_id, need_id, out_id, in_id, recorded_by, reason)
  values (v_period, p_need, p_out, p_in, coalesce(v_by, ''), left(coalesce(p_reason, ''), 500));
  insert into public.attendance (period_id, need_id, volunteer_id, status, recorded_by)
  values (v_period, p_need, p_out, 'substituido', coalesce(v_by, ''))
  on conflict (need_id, volunteer_id) do update set status = 'substituido', recorded_at = now(), recorded_by = excluded.recorded_by;
end $$;

-- ---------------------------------------------------------------------
-- Gestão de pessoas (sem acesso ao login; criação de contas fica na Edge Function)
-- ---------------------------------------------------------------------
create or replace function public.password_changed()
returns void language sql security definer set search_path = '' as $$
  update public.profiles set must_change_password = false where id = (select auth.uid())
$$;

create or replace function public.staff_update_volunteer(p_id uuid, p_name text, p_phone text, p_email text, p_birth date)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'Acesso negado.'; end if;
  if not exists (select 1 from public.profiles where id = p_id and role in ('voluntario', 'responsavel')) then raise exception 'Voluntário não encontrado.'; end if;
  if p_birth is not null and p_birth > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'A data de nascimento não pode ser futura.'; end if;
  update public.profiles set name = trim(p_name) where id = p_id;
  update public.volunteer_details set phone = coalesce(p_phone, ''), email = coalesce(p_email, ''), birth_date = p_birth where id = p_id;
end $$;

-- Supervisor ativa/desativa voluntários e responsáveis; só o admin mexe em supervisores. Ninguém desativa o admin.
create or replace function public.set_user_status(p_id uuid, p_status public.user_status)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.app_role;
begin
  select role into t from public.profiles where id = p_id;
  if t is null then raise exception 'Usuário não encontrado.'; end if;
  if t = 'admin' then raise exception 'Não é possível alterar o administrador.'; end if;
  if t = 'supervisor' and not public.is_admin() then raise exception 'Somente o administrador pode alterar supervisores.'; end if;
  if t in ('voluntario', 'responsavel') and not public.is_staff() then raise exception 'Acesso negado.'; end if;
  update public.profiles set status = p_status where id = p_id;
end $$;

-- Promove/rebaixa entre voluntário e responsável.
create or replace function public.set_volunteer_role(p_id uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'Acesso negado.'; end if;
  if p_role not in ('voluntario', 'responsavel') then raise exception 'Perfil inválido.'; end if;
  if not exists (select 1 from public.profiles where id = p_id and role in ('voluntario', 'responsavel')) then raise exception 'Voluntário não encontrado.'; end if;
  update public.profiles set role = p_role where id = p_id;
  if p_role = 'voluntario' then
    update public.needs set responsavel_id = null where responsavel_id = p_id;
    update public.opportunities set responsavel_id = null where responsavel_id = p_id;
  end if;
end $$;

grant execute on function
  public.scale_counts(), public.opportunity_counts(),
  public.apply_to_opportunity(uuid), public.cancel_application(uuid), public.confirm_selection(uuid, uuid[]),
  public.save_draw(uuid, jsonb, text), public.publish_draw(uuid), public.substitute(uuid, uuid, uuid, text),
  public.password_changed(), public.staff_update_volunteer(uuid, text, text, text, date),
  public.set_user_status(uuid, public.user_status), public.set_volunteer_role(uuid, public.app_role)
to authenticated;

-- ---------------------------------------------------------------------
-- Avisos agendados: abaixo do mínimo em 24h, aniversários e lembretes
-- ---------------------------------------------------------------------
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

revoke execute on function public.run_scheduled_notifications() from authenticated;
revoke execute on function public._notify(uuid, public.notif_type, text, uuid, text) from authenticated;
revoke execute on function public._opp_recipients(uuid) from authenticated;
revoke execute on function public._threshold_notify(uuid, int, int, text, text) from authenticated;
revoke execute on function public._active_count(uuid) from authenticated;

create extension if not exists pg_cron;
select cron.schedule('avisos-agendados', '*/10 * * * *', $cron$select public.run_scheduled_notifications()$cron$);

-- ---------------------------------------------------------------------
-- Fotos de perfil (bucket privado, 2 MB, só imagens)
-- Caminho: <id do usuário>/avatar-<timestamp>.<ext>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public._safe_uuid(t text) returns uuid language plpgsql immutable set search_path = '' as $$
begin return t::uuid; exception when others then return null; end $$;
grant execute on function public._safe_uuid(text) to authenticated;

create policy avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.can_view_profile(public._safe_uuid((storage.foldername(name))[1])));
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.is_active_user()
    and ((storage.foldername(name))[1] = (select auth.uid())::text
      or (public.is_staff() and exists (select 1 from public.profiles p where p.id = public._safe_uuid((storage.foldername(name))[1])))));
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.is_active_user() and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_staff()));
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.is_active_user() and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_staff()));
