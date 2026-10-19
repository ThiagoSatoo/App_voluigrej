-- =====================================================================
-- Política de visibilidade da escala (escolhida pela coordenação)
--   privado      : o voluntário vê só a própria escala.
--   mesmo_turno  : vê também quem está no mesmo turno/vaga que ele.
--   escala_geral : vê a escala de todos os turnos, mas o app nunca mostra
--                  a agenda individual de outra pessoa.
-- Admin, supervisor e o responsável do turno sempre veem o que gerenciam.
-- =====================================================================

alter table public.app_settings
  add column visibility_policy text not null default 'mesmo_turno'
  check (visibility_policy in ('privado', 'mesmo_turno', 'escala_geral'));

create or replace function public.visibility_policy()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select s.visibility_policy from public.app_settings s where s.id = 1), 'privado')
$$;

-- Está em alguma escala publicada (sorteio publicado, não substituído/cancelado) ou vaga confirmada?
create or replace function public.in_any_published_scale(p_vol uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.draw_picks dp join public.draws d on d.id = dp.draw_id and d.status = 'publicado'
    where dp.volunteer_id = p_vol
  ) or exists (
    select 1 from public.applications ap join public.opportunities o on o.id = ap.opportunity_id and o.status = 'confirmada'
    where ap.volunteer_id = p_vol and ap.status = 'selecionado'
  )
$$;

-- "Colega" agora depende da política escolhida.
create or replace function public.is_colleague(p_vol uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_user() and case public.visibility_policy()
    when 'escala_geral' then public.in_any_published_scale(p_vol)
    when 'mesmo_turno' then (
      exists (
        select 1 from public.draw_picks a
        join public.draw_picks b on b.draw_id = a.draw_id and b.need_id = a.need_id
        join public.draws d on d.id = a.draw_id and d.status = 'publicado'
        where a.volunteer_id = (select auth.uid()) and b.volunteer_id = p_vol
      )
      or exists (
        select 1 from public.applications a
        join public.applications b on b.opportunity_id = a.opportunity_id and b.status = 'selecionado'
        join public.opportunities o on o.id = a.opportunity_id and o.status = 'confirmada'
        where a.volunteer_id = (select auth.uid()) and a.status = 'selecionado' and b.volunteer_id = p_vol
      )
    )
    else false
  end
$$;

-- Quem pode ver uma linha da escala publicada.
create or replace function public.can_see_pick(p_draw uuid, p_need uuid, p_vol uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_staff() or (
    public.is_active_user()
    and exists (select 1 from public.draws d where d.id = p_draw and d.status = 'publicado')
    and (
      p_vol = (select auth.uid())
      or public.manages_need(p_need)
      or (public.visibility_policy() = 'mesmo_turno' and public.in_published_slot(p_draw, p_need))
      or public.visibility_policy() = 'escala_geral'
    )
  )
$$;

-- Quem pode ver os selecionados de uma vaga confirmada (além do próprio e do responsável).
create or replace function public.can_see_selected(p_opp uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_user()
    and exists (select 1 from public.opportunities o where o.id = p_opp and o.status = 'confirmada')
    and case public.visibility_policy()
      when 'escala_geral' then true
      when 'mesmo_turno' then exists (
        select 1 from public.applications a
        where a.opportunity_id = p_opp and a.volunteer_id = (select auth.uid()) and a.status = 'selecionado'
      )
      else false
    end
$$;

alter policy draw_picks_select on public.draw_picks
  using (public.can_see_pick(draw_id, need_id, volunteer_id));

alter policy apps_select on public.applications
  using (
    public.is_active_user() and (
      volunteer_id = (select auth.uid())
      or public.manages_opportunity(opportunity_id)
      or (status = 'selecionado' and public.can_see_selected(opportunity_id))
    )
  );

-- Somente a coordenação muda a política (a regra de update de app_settings já exige is_staff()).
revoke execute on all functions in schema public from public, anon;
grant execute on function public.visibility_policy(), public.in_any_published_scale(uuid),
  public.can_see_pick(uuid, uuid, uuid), public.can_see_selected(uuid) to authenticated;
