-- =====================================================================
-- Escala de Voluntários — esquema principal
-- Perfis: admin (dono), supervisor, responsavel (turno/dia), voluntario
-- Toda tabela tem RLS ligada; nada é visível sem um perfil ATIVO.
-- =====================================================================

create type public.app_role as enum ('admin', 'supervisor', 'responsavel', 'voluntario');
create type public.user_status as enum ('ativo', 'inativo');
create type public.period_status as enum ('rascunho', 'aberta', 'encerrada', 'sorteado', 'publicada', 'encerrado');
create type public.availability_value as enum ('disponivel', 'indisponivel');
create type public.draw_status as enum ('rascunho', 'publicado', 'substituido');
create type public.attendance_status as enum ('presente', 'faltou', 'substituido', 'cancelado');
create type public.opportunity_status as enum ('aberta', 'confirmada');
create type public.application_status as enum ('candidatado', 'cancelado', 'selecionado', 'nao_selecionado');
create type public.notif_type as enum (
  'nova_candidatura', 'candidatura_cancelada', 'minimo_atingido', 'escala_completa', 'abaixo_minimo_24h',
  'aniversario_7d', 'aniversario_dia', 'lembrete_24h', 'lembrete_12h', 'lembrete_6h', 'lembrete_3h', 'lembrete_1h'
);

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'voluntario',
  name text not null check (char_length(name) between 2 and 120),
  username text unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  status public.user_status not null default 'ativo',
  must_change_password boolean not null default true,
  photo_path text check (photo_path is null or char_length(photo_path) <= 200),
  created_at timestamptz not null default now()
);

-- Dados pessoais ficam separados: só o próprio, a equipe e o responsável do turno veem.
create table public.volunteer_details (
  id uuid primary key references public.profiles (id) on delete cascade,
  cpf text not null unique check (cpf ~ '^[0-9]{11}$'),
  phone text not null default '' check (char_length(phone) <= 30),
  email text not null default '' check (char_length(email) <= 200),
  birth_date date,
  joined_at date not null default current_date
);

create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  church_name text not null default 'Minha Igreja' check (char_length(church_name) <= 120),
  ministry_name text not null default 'Ministério de Voluntários' check (char_length(ministry_name) <= 120)
);
insert into public.app_settings (id) values (1);

create table public.periods (
  id uuid primary key default gen_random_uuid(),
  month smallint not null check (month between 1 and 12),
  year smallint not null check (year between 2020 and 2100),
  open_date date not null,
  deadline date not null,
  status public.period_status not null default 'rascunho',
  unique (month, year)
);

create table public.needs (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods (id) on delete cascade,
  date date not null,
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text not null check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  slots smallint not null check (slots between 1 and 200),
  responsavel_id uuid references public.profiles (id) on delete set null,
  check (end_time > start_time)
);
create index on public.needs (period_id);
create index on public.needs (responsavel_id);

create table public.availabilities (
  period_id uuid not null references public.periods (id) on delete cascade,
  volunteer_id uuid not null references public.profiles (id) on delete cascade,
  need_id uuid not null references public.needs (id) on delete cascade,
  value public.availability_value not null,
  updated_at timestamptz not null default now(),
  primary key (volunteer_id, need_id)
);
create index on public.availabilities (need_id);
create index on public.availabilities (period_id);

create table public.draws (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods (id) on delete cascade,
  number integer not null,
  created_at timestamptz not null default now(),
  created_by text not null default '',
  status public.draw_status not null default 'rascunho',
  unique (period_id, number)
);

create table public.draw_slots (
  draw_id uuid not null references public.draws (id) on delete cascade,
  need_id uuid not null references public.needs (id) on delete cascade,
  eligible integer not null default 0,
  primary key (draw_id, need_id)
);
create index on public.draw_slots (need_id);

create table public.draw_picks (
  draw_id uuid not null references public.draws (id) on delete cascade,
  need_id uuid not null references public.needs (id) on delete cascade,
  volunteer_id uuid not null references public.profiles (id) on delete cascade,
  priority integer not null,
  recent3m integer not null default 0,
  last12m integer not null default 0,
  tiebreak text not null default '',
  primary key (draw_id, need_id, volunteer_id)
);
create index on public.draw_picks (volunteer_id);
create index on public.draw_picks (need_id);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods (id) on delete cascade,
  need_id uuid not null references public.needs (id) on delete cascade,
  volunteer_id uuid not null references public.profiles (id) on delete cascade,
  status public.attendance_status not null,
  recorded_at timestamptz not null default now(),
  recorded_by text not null default '',
  unique (need_id, volunteer_id)
);
create index on public.attendance (volunteer_id);

create table public.substitutions (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods (id) on delete cascade,
  need_id uuid not null references public.needs (id) on delete cascade,
  out_id uuid not null references public.profiles (id) on delete cascade,
  in_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now(),
  recorded_by text not null default '',
  reason text not null default '' check (char_length(reason) <= 500)
);
create index on public.substitutions (need_id);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text not null check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  min smallint not null check (min >= 1),
  max smallint not null,
  note text check (note is null or char_length(note) <= 500),
  status public.opportunity_status not null default 'aberta',
  created_at timestamptz not null default now(),
  responsavel_id uuid references public.profiles (id) on delete set null,
  check (max >= min),
  check (end_time > start_time)
);
create index on public.opportunities (responsavel_id);
create index on public.opportunities (date);

create table public.day_availability (
  volunteer_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  primary key (volunteer_id, date)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  volunteer_id uuid not null references public.profiles (id) on delete cascade,
  status public.application_status not null default 'candidatado',
  updated_at timestamptz not null default now(),
  unique (opportunity_id, volunteer_id)
);
create index on public.applications (volunteer_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  type public.notif_type not null,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  key text unique,
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  read boolean not null default false
);
create index on public.notifications (recipient_id, created_at desc);
create index on public.notifications (opportunity_id);

create table public.notif_prefs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notif_type not null,
  enabled boolean not null,
  primary key (user_id, type)
);

-- ---------------------------------------------------------------------
-- Funções auxiliares de permissão (SECURITY DEFINER: evitam recursão de RLS)
-- ---------------------------------------------------------------------
create or replace function public.my_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.status = 'ativo'
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'ativo')
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role() in ('admin', 'supervisor'), false)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create or replace function public.manages_need(p_need uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_staff() or (
    public.is_active_user()
    and exists (select 1 from public.needs n where n.id = p_need and n.responsavel_id = (select auth.uid()))
  )
$$;

create or replace function public.manages_opportunity(p_opp uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_staff() or (
    public.is_active_user()
    and exists (select 1 from public.opportunities o where o.id = p_opp and o.responsavel_id = (select auth.uid()))
  )
$$;

-- Responsável vê quem está (ou pode entrar) nos turnos/vagas que ele cuida.
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
    )
  )
$$;

-- Colegas: dividem um turno publicado ou uma vaga confirmada.
create or replace function public.is_colleague(p_vol uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_user() and (
    exists (
      select 1 from public.draw_picks a
      join public.draw_picks b on b.draw_id = a.draw_id and b.need_id = a.need_id
      join public.draws d on d.id = a.draw_id and d.status = 'publicado'
      where a.volunteer_id = (select auth.uid()) and b.volunteer_id = p_vol
    )
    or exists (
      select 1 from public.applications a
      join public.applications b on b.opportunity_id = a.opportunity_id and b.status = 'selecionado'
      where a.volunteer_id = (select auth.uid()) and a.status = 'selecionado' and b.volunteer_id = p_vol
    )
  )
$$;

create or replace function public.can_view_profile(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_user() and (
    p_id = (select auth.uid())
    or public.manages_volunteer(p_id)
    or public.is_colleague(p_id)
    or exists (select 1 from public.profiles p where p.id = p_id and p.role in ('admin', 'supervisor', 'responsavel'))
  )
$$;

create or replace function public.in_published_slot(p_draw uuid, p_need uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.draw_picks dp join public.draws d on d.id = dp.draw_id
    where dp.draw_id = p_draw and dp.need_id = p_need and d.status = 'publicado'
      and dp.volunteer_id = (select auth.uid())
  )
$$;

create or replace function public.period_is_open(p_period uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.periods p where p.id = p_period and p.status = 'aberta')
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.volunteer_details enable row level security;
alter table public.app_settings enable row level security;
alter table public.periods enable row level security;
alter table public.needs enable row level security;
alter table public.availabilities enable row level security;
alter table public.draws enable row level security;
alter table public.draw_slots enable row level security;
alter table public.draw_picks enable row level security;
alter table public.attendance enable row level security;
alter table public.substitutions enable row level security;
alter table public.opportunities enable row level security;
alter table public.day_availability enable row level security;
alter table public.applications enable row level security;
alter table public.notifications enable row level security;
alter table public.notif_prefs enable row level security;

-- Ninguém anônimo acessa nada.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- Perfis: leitura conforme vínculo; escrita só da foto (o resto vai por funções seguras).
revoke insert, update, delete on public.profiles from authenticated;
grant update (photo_path) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated using (public.can_view_profile(id));
create policy profiles_photo on public.profiles for update to authenticated
  using (public.is_active_user() and (id = (select auth.uid()) or public.is_staff()))
  with check (public.is_active_user() and (id = (select auth.uid()) or public.is_staff()));

revoke insert, update, delete on public.volunteer_details from authenticated;
create policy details_select on public.volunteer_details for select to authenticated
  using (public.is_active_user() and (id = (select auth.uid()) or public.manages_volunteer(id)));

create policy settings_select on public.app_settings for select to authenticated using (public.is_active_user());
create policy settings_update on public.app_settings for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy periods_select on public.periods for select to authenticated using (public.is_active_user());
create policy periods_write on public.periods for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy needs_select on public.needs for select to authenticated using (public.is_active_user());
create policy needs_write on public.needs for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy avail_select on public.availabilities for select to authenticated
  using (public.is_active_user() and (volunteer_id = (select auth.uid()) or public.manages_need(need_id)));
create policy avail_insert on public.availabilities for insert to authenticated
  with check (
    volunteer_id = (select auth.uid()) and public.my_role() in ('voluntario', 'responsavel')
    and public.period_is_open(period_id)
    and exists (select 1 from public.needs n where n.id = need_id and n.period_id = availabilities.period_id)
  );
create policy avail_update on public.availabilities for update to authenticated
  using (volunteer_id = (select auth.uid()) and public.period_is_open(period_id))
  with check (
    volunteer_id = (select auth.uid()) and public.my_role() in ('voluntario', 'responsavel')
    and public.period_is_open(period_id)
    and exists (select 1 from public.needs n where n.id = need_id and n.period_id = availabilities.period_id)
  );

-- Sorteios: escrita apenas por funções seguras.
revoke insert, update, delete on public.draws, public.draw_slots, public.draw_picks from authenticated;
create policy draws_select on public.draws for select to authenticated
  using (public.is_active_user() and (status = 'publicado' or public.is_staff()));
create policy draw_slots_select on public.draw_slots for select to authenticated
  using (public.is_active_user() and (public.is_staff() or exists (select 1 from public.draws d where d.id = draw_id and d.status = 'publicado')));
create policy draw_picks_select on public.draw_picks for select to authenticated
  using (
    public.is_staff()
    or (public.is_active_user() and exists (select 1 from public.draws d where d.id = draw_id and d.status = 'publicado')
        and (volunteer_id = (select auth.uid()) or public.in_published_slot(draw_id, need_id) or public.manages_need(need_id)))
  );

create policy attendance_select on public.attendance for select to authenticated
  using (public.is_active_user() and (volunteer_id = (select auth.uid()) or public.manages_need(need_id)));
create policy attendance_write on public.attendance for insert to authenticated with check (public.manages_need(need_id));
create policy attendance_update on public.attendance for update to authenticated using (public.manages_need(need_id)) with check (public.manages_need(need_id));

revoke insert, update, delete on public.substitutions from authenticated;
create policy subs_select on public.substitutions for select to authenticated
  using (public.is_active_user() and (out_id = (select auth.uid()) or in_id = (select auth.uid()) or public.manages_need(need_id)));

create policy opp_select on public.opportunities for select to authenticated using (public.is_active_user());
create policy opp_insert on public.opportunities for insert to authenticated
  with check (public.is_staff() or (public.my_role() = 'responsavel' and responsavel_id = (select auth.uid())));
create policy opp_update on public.opportunities for update to authenticated
  using (public.manages_opportunity(id))
  with check (public.is_staff() or responsavel_id = (select auth.uid()));
create policy opp_delete on public.opportunities for delete to authenticated using (public.manages_opportunity(id));

create policy dayav_select on public.day_availability for select to authenticated
  using (public.is_active_user() and (volunteer_id = (select auth.uid()) or public.manages_volunteer(volunteer_id)));
create policy dayav_insert on public.day_availability for insert to authenticated
  with check (volunteer_id = (select auth.uid()) and public.my_role() in ('voluntario', 'responsavel'));
create policy dayav_delete on public.day_availability for delete to authenticated
  using (volunteer_id = (select auth.uid()) and public.is_active_user());

-- Candidaturas: só por funções seguras (validam regras e geram avisos).
revoke insert, update, delete on public.applications from authenticated;
create policy apps_select on public.applications for select to authenticated
  using (public.is_active_user() and (volunteer_id = (select auth.uid()) or public.manages_opportunity(opportunity_id)));

revoke insert, delete on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;
create policy notif_select on public.notifications for select to authenticated using (recipient_id = (select auth.uid()) and public.is_active_user());
create policy notif_update on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

create policy prefs_all on public.notif_prefs for all to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user())
  with check (user_id = (select auth.uid()) and public.is_active_user());
