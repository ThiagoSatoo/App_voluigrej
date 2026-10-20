-- =====================================================================
-- Escalas fixas (parte 4): botão "Disponível" e "Fixar" pessoas.
--   - "Disponível" desfaz o "Indisponível" sem apagar nada: a linha da
--     exceção ganha cancelled_at e fica como histórico.
--   - attendance 'escalado': quem tinha saído e voltou para o turno.
--   - fixed_pins: pessoas que a coordenação fixou numa data de uma escala
--     fixa. Valem só para aquela data; para o mês inteiro, uma linha por data.
--     Todo mês a coordenação fixa de novo.
-- =====================================================================

alter type public.attendance_status add value if not exists 'escalado';

alter table public.fixed_exceptions add column cancelled_at timestamptz;

create table public.fixed_pins (
  fixed_id uuid not null references public.fixed_schedules (id) on delete cascade,
  date date not null,
  volunteer_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text not null default '',
  primary key (fixed_id, date),
  check (cardinality(volunteer_ids) <= 200)
);

alter table public.fixed_pins enable row level security;
revoke all on public.fixed_pins from anon;
revoke insert, update, delete, truncate, trigger, references on public.fixed_pins from authenticated;
-- Só a coordenação e o responsável da escala fixa veem quem foi fixado; gravação só pela função abaixo.
create policy fp_select on public.fixed_pins for select to authenticated using (public.manages_fixed(fixed_id));

-- Fixa as pessoas escolhidas nas datas informadas (substitui o que havia nessas datas; lista vazia = desafixar).
create or replace function public.set_fixed_pins(p_fixed uuid, p_dates date[], p_vols uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  f public.fixed_schedules; d date; v_by text;
  v_vols uuid[] := array(select distinct u from unnest(coalesce(p_vols, '{}'::uuid[])) u);
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.is_staff() then raise exception 'Acesso negado.'; end if;
  select * into f from public.fixed_schedules where id = p_fixed;
  if f.id is null then raise exception 'Escala fixa não encontrada.'; end if;
  if coalesce(array_length(p_dates, 1), 0) = 0 then raise exception 'Escolha a data.'; end if;
  if cardinality(v_vols) > f.slots then raise exception 'Fixe no máximo % pessoas (as vagas desta escala).', f.slots; end if;
  if exists (
    select 1 from unnest(v_vols) u
    where not exists (select 1 from public.profiles p where p.id = u and p.status = 'ativo' and p.role in ('voluntario', 'responsavel'))
  ) then raise exception 'Escolha apenas voluntários ativos.'; end if;
  select name into v_by from public.profiles where id = (select auth.uid());
  foreach d in array p_dates loop
    if extract(dow from d) <> f.weekday then raise exception 'Esta data não é um dia desta escala fixa.'; end if;
    if d < v_today then raise exception 'Esta data já passou.'; end if;
    insert into public.fixed_pins (fixed_id, date, volunteer_ids, updated_by)
    values (p_fixed, d, v_vols, left(coalesce(v_by, ''), 120))
    on conflict (fixed_id, date) do update
      set volunteer_ids = excluded.volunteer_ids, updated_at = now(), updated_by = excluded.updated_by;
  end loop;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.set_fixed_pins(uuid, date[], uuid[]) to authenticated;
grant execute on function public.public_app_name() to anon, authenticated;
