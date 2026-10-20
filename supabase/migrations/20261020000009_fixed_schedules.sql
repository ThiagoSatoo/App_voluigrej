-- =====================================================================
-- Escalas fixas: horários que se repetem toda semana.
--   fixed_schedules  : dia da semana, início, fim, vagas, responsável, ativa.
--   fixed_members    : quem participa sempre de cada escala fixa (candidatura).
--   fixed_exceptions : "nesse dia não posso" (indisponível numa data).
-- O sorteio é por escala fixa e por mês: gera os turnos (needs) do mês com
-- needs.fixed_id e um sorteio (draws.fixed_id) em rascunho, que a coordenação
-- publica. Presença, substituição, lembretes, Agenda e Histórico continuam
-- usando as mesmas tabelas. Os períodos e sorteios antigos ficam como estão.
-- =====================================================================

alter type public.notif_type add value if not exists 'indisponivel';
alter type public.notif_type add value if not exists 'substituto_escalado';

create table public.fixed_schedules (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text not null check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  slots smallint not null check (slots between 1 and 200),
  responsavel_id uuid references public.profiles (id) on delete set null,
  note text check (note is null or char_length(note) <= 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index on public.fixed_schedules (responsavel_id);

create table public.fixed_members (
  fixed_id uuid not null references public.fixed_schedules (id) on delete cascade,
  volunteer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (fixed_id, volunteer_id)
);
create index on public.fixed_members (volunteer_id);

create table public.fixed_exceptions (
  fixed_id uuid not null references public.fixed_schedules (id) on delete cascade,
  volunteer_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  created_by text not null default '',
  primary key (fixed_id, volunteer_id, date)
);
create index on public.fixed_exceptions (volunteer_id);

-- Turnos e sorteios gerados por uma escala fixa. "restrict": escala já usada não é apagada (só desativada).
alter table public.needs add column fixed_id uuid references public.fixed_schedules (id) on delete restrict;
create unique index needs_fixed_date_key on public.needs (fixed_id, date) where fixed_id is not null;
alter table public.draws add column fixed_id uuid references public.fixed_schedules (id) on delete restrict;
create index on public.draws (fixed_id);

-- ---------------------------------------------------------------------
-- Funções de permissão
-- ---------------------------------------------------------------------
create or replace function public.manages_fixed(p_fixed uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_staff() or (
    public.is_active_user()
    and exists (select 1 from public.fixed_schedules f where f.id = p_fixed and f.responsavel_id = (select auth.uid()))
  )
$$;

-- Responsável também vê (e contata) quem participa das escalas fixas que ele cuida.
create or replace function public.manages_volunteer(p_vol uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_staff() or (
    public.is_active_user() and (
      exists (
        select 1 from public.needs n
        join public.draw_picks dp on dp.need_id = n.id
        join public.draws d on d.id = dp.draw_id and d.status = 'publicado'
        where n.responsavel_id = (select auth.uid()) and dp.volunteer_id = p_vol
      )
      or exists (
        select 1 from public.needs n
        join public.availabilities a on a.need_id = n.id and a.value = 'disponivel'
        where n.responsavel_id = (select auth.uid()) and a.volunteer_id = p_vol
      )
      or exists (
        select 1 from public.opportunities o
        join public.applications ap on ap.opportunity_id = o.id
        where o.responsavel_id = (select auth.uid()) and ap.volunteer_id = p_vol
      )
      or exists (
        select 1 from public.opportunities o
        join public.day_availability da on da.date = o.date
        where o.responsavel_id = (select auth.uid()) and o.status = 'aberta' and da.volunteer_id = p_vol
      )
      or exists (
        select 1 from public.fixed_schedules f
        join public.fixed_members m on m.fixed_id = f.id
        where f.responsavel_id = (select auth.uid()) and m.volunteer_id = p_vol
      )
    )
  )
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.fixed_schedules enable row level security;
alter table public.fixed_members enable row level security;
alter table public.fixed_exceptions enable row level security;
revoke all on public.fixed_schedules, public.fixed_members, public.fixed_exceptions from anon;
revoke truncate, trigger, references on public.fixed_schedules, public.fixed_members, public.fixed_exceptions from authenticated;

-- Escalas fixas: todos os ativos leem (como os turnos); só a coordenação cria e altera.
create policy fixed_select on public.fixed_schedules for select to authenticated using (public.is_active_user());
create policy fixed_insert on public.fixed_schedules for insert to authenticated with check (public.is_staff());
create policy fixed_update on public.fixed_schedules for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy fixed_delete on public.fixed_schedules for delete to authenticated using (public.is_staff());

-- Participantes: o voluntário entra/sai sozinho; a coordenação inscreve ou remove qualquer voluntário.
revoke update on public.fixed_members from authenticated;
create policy fm_select on public.fixed_members for select to authenticated
  using (public.is_active_user() and (volunteer_id = (select auth.uid()) or public.manages_fixed(fixed_id)));
create policy fm_insert on public.fixed_members for insert to authenticated
  with check (
    (
      volunteer_id = (select auth.uid()) and public.my_role() in ('voluntario', 'responsavel')
      and exists (select 1 from public.fixed_schedules f where f.id = fixed_id and f.active)
    ) or (
      public.is_staff()
      and exists (select 1 from public.profiles p where p.id = volunteer_id and p.status = 'ativo' and p.role in ('voluntario', 'responsavel'))
    )
  );
create policy fm_delete on public.fixed_members for delete to authenticated
  using ((volunteer_id = (select auth.uid()) and public.is_active_user()) or public.is_staff());

-- Indisponibilidades: leitura pelo próprio, coordenação e responsável; escrita só pelas funções abaixo.
revoke insert, update, delete on public.fixed_exceptions from authenticated;
create policy fe_select on public.fixed_exceptions for select to authenticated
  using (public.is_active_user() and (volunteer_id = (select auth.uid()) or public.manages_fixed(fixed_id)));

revoke execute on all functions in schema public from public, anon;
grant execute on function public.manages_fixed(uuid), public.manages_volunteer(uuid) to authenticated;
grant execute on function public.public_app_name() to anon, authenticated;
