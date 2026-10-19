-- =====================================================================
-- Equipe unificada: supervisores na mesma lista dos voluntários.
-- Regras: supervisor gerencia voluntários e responsáveis; só o admin
-- gerencia supervisores; o admin só edita os próprios dados.
-- Também expõe publicamente apenas o NOME da instituição (tela de login).
-- =====================================================================

-- Editar dados de qualquer pessoa da equipe, respeitando quem pode gerenciar quem.
create or replace function public.staff_update_volunteer(p_id uuid, p_name text, p_phone text, p_email text, p_birth date)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.app_role;
begin
  select role into t from public.profiles where id = p_id;
  if t is null then raise exception 'Pessoa não encontrada.'; end if;
  if t in ('voluntario', 'responsavel') and not public.is_staff() then raise exception 'Acesso negado.'; end if;
  if t = 'supervisor' and not public.is_admin() then raise exception 'Somente o administrador edita supervisores.'; end if;
  if t = 'admin' and not (public.is_admin() and p_id = (select auth.uid())) then raise exception 'Acesso negado.'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 3 then raise exception 'Informe o nome completo.'; end if;
  if p_birth is not null and p_birth > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'A data de nascimento não pode ser futura.'; end if;
  update public.profiles set name = trim(p_name) where id = p_id;
  update public.volunteer_details
    set phone = left(coalesce(p_phone, ''), 30), email = left(coalesce(p_email, ''), 200), birth_date = p_birth
    where id = p_id;
end $$;

-- Mudar o perfil de alguém: voluntário <-> responsável (coordenação) e <-> supervisor (só admin).
create or replace function public.set_user_role(p_id uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.app_role;
begin
  select role into t from public.profiles where id = p_id;
  if t is null then raise exception 'Pessoa não encontrada.'; end if;
  if t = 'admin' or p_role = 'admin' then raise exception 'O perfil de administrador não pode ser alterado.'; end if;
  if (t = 'supervisor' or p_role = 'supervisor') and not public.is_admin() then
    raise exception 'Somente o administrador define supervisores.';
  end if;
  if not public.is_staff() then raise exception 'Acesso negado.'; end if;
  if p_id = (select auth.uid()) then raise exception 'Você não pode alterar o seu próprio perfil.'; end if;
  update public.profiles set role = p_role where id = p_id;
  -- Quem vira voluntário comum deixa de ser responsável por turnos e vagas.
  if p_role = 'voluntario' then
    update public.needs set responsavel_id = null where responsavel_id = p_id;
    update public.opportunities set responsavel_id = null where responsavel_id = p_id;
  end if;
end $$;

-- Mantém o nome antigo funcionando.
create or replace function public.set_volunteer_role(p_id uuid, p_role public.app_role)
returns void language sql security definer set search_path = '' as $$
  select public.set_user_role(p_id, p_role)
$$;

-- Nome da instituição para a tela de login (antes de entrar). Só o nome, nada mais.
create or replace function public.public_app_name()
returns text language sql stable security definer set search_path = '' as $$
  select s.church_name from public.app_settings s where s.id = 1
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.staff_update_volunteer(uuid, text, text, text, date), public.set_user_role(uuid, public.app_role),
  public.set_volunteer_role(uuid, public.app_role) to authenticated;
grant execute on function public.public_app_name() to anon, authenticated;

-- Valor padrão mais neutro para instalações novas.
alter table public.app_settings alter column church_name set default 'Minha instituição';
