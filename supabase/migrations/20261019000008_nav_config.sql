-- =====================================================================
-- Abas do menu por perfil (tela Admin). Só o administrador altera.
-- Formato: {"supervisor": {"equipe": true, ...}, "voluntario": {"vagas": false, ...}}
-- Aba ausente = ligada. Esconder uma aba é uma regra de tela; o que cada
-- perfil pode ler e gravar continua sendo decidido pelas regras do banco.
-- =====================================================================

create table public.nav_config (
  id smallint primary key default 1 check (id = 1),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object' and pg_column_size(config) < 8192),
  updated_at timestamptz not null default now()
);
insert into public.nav_config (id) values (1);

alter table public.nav_config enable row level security;
revoke all on public.nav_config from anon, authenticated;
grant select on public.nav_config to authenticated;
grant update (config, updated_at) on public.nav_config to authenticated;

create policy nav_select on public.nav_config for select to authenticated using (public.is_active_user());
create policy nav_update on public.nav_config for update to authenticated using (public.is_admin()) with check (public.is_admin());
