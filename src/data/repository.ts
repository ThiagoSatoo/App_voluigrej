import { validTimeRange } from "@/lib/time";
import { AVATAR_BUCKET, cpfLogin, friendlyError, staffLogin, supabase } from "@/lib/supabase";
import { today, validCpf } from "@/lib/format";
import { getState, refresh } from "./store";
import type { TeamRole } from "./selectors";
import type { AppState, AttendanceStatus, NotifType, Settings, Volunteer } from "./types";

/**
 * Camada de acesso a dados. As telas só alteram dados por aqui.
 * Toda regra de permissão é garantida no banco (RLS e funções seguras);
 * as validações daqui servem apenas para dar respostas rápidas ao usuário.
 */
export type Result = { ok: true } | { ok: false; error: string };
const ok = { ok: true } as const;
const fail = (error: string) => ({ ok: false, error }) as const;

/** Executa a operação, trata o erro e recarrega os dados. */
async function run(op: () => PromiseLike<{ error: unknown }>): Promise<Result> {
  try {
    const { error } = await op();
    if (error) return fail(friendlyError(error));
    await refresh();
    return ok;
  } catch (e) {
    return fail(friendlyError(e));
  }
}

/** Chama a função de servidor que gerencia contas (precisa da chave secreta, que nunca vai ao navegador). */
async function manageUsers<T = Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<({ ok: true } & T) | { ok: false; error: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("manage-users", { body });
    if (error) {
      let msg = error.message;
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        try {
          msg = (await ctx.json()).error ?? msg;
        } catch {
          /* corpo vazio */
        }
      }
      return fail(friendlyError({ message: msg }));
    }
    await refresh();
    return { ok: true, ...(data as T) };
  } catch (e) {
    return fail(friendlyError(e));
  }
}

const myName = () => getState().session?.name ?? "";

export const repo = {
  // ---------- Autenticação ----------
  /** Login de todos é o CPF (só números). Usuários antigos da coordenação ainda entram pelo nome de usuário. */
  async login(identifier: string, password: string): Promise<Result & { mustChange?: boolean }> {
    const id = identifier.trim();
    const cpf = id.replace(/\D/g, "");
    if (/[a-z]/i.test(id)) {
      if (!/^[a-z0-9._-]{3,32}$/i.test(id)) return fail("CPF ou senha inválidos.");
      return repo._login(staffLogin(id), password);
    }
    if (cpf.length !== 11) return fail("Informe o CPF com 11 dígitos.");
    return repo._login(cpfLogin(cpf), password);
  },

  async _login(email: string, password: string): Promise<Result & { mustChange?: boolean }> {
    if (!password) return fail("Informe a senha.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return fail(friendlyError(error).replace("Login ou senha", "CPF ou senha"));
    await refresh();
    const s = getState().session;
    if (!s) return fail("Seu acesso está desativado. Fale com a coordenação.");
    return { ok: true, mustChange: s.mustChangePassword };
  },

  async logout() {
    await supabase.auth.signOut();
  },

  async changePassword(current: string, next: string): Promise<Result> {
    if (next.length < 8) return fail("A nova senha deve ter pelo menos 8 caracteres.");
    if (!/[a-zA-Z]/.test(next) || !/\d/.test(next))
      return fail("Use letras e números na nova senha.");
    if (next === current) return fail("A nova senha deve ser diferente da atual.");
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) return fail("Sessão expirada. Entre novamente.");
    if (next.replace(/\D/g, "") === email.split("@")[0])
      return fail("A nova senha não pode ser o seu CPF.");
    // Confirma a senha atual antes de trocar.
    const check = await supabase.auth.signInWithPassword({ email, password: current });
    if (check.error) return fail("Senha atual incorreta.");
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) return fail(friendlyError(error));
    return run(() => supabase.rpc("password_changed"));
  },

  // ---------- Pessoas (contas criadas no servidor; login e senha inicial = CPF) ----------
  /** Cria ou edita qualquer pessoa da equipe. Supervisor só pode ser criado/definido pelo admin (o servidor confere). */
  async saveVolunteer(
    data: Pick<Volunteer, "name" | "cpf" | "phone" | "email" | "birthDate"> & {
      id?: string;
      photo?: Blob | null;
      role?: TeamRole;
    },
  ): Promise<Result> {
    const cpf = data.cpf.replace(/\D/g, "");
    if (data.name.trim().length < 3) return fail("Informe o nome completo.");
    if (!validCpf(cpf)) return fail("CPF inválido. Confira os números.");
    if (data.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.birthDate))
      return fail("Data de nascimento inválida.");
    if (data.birthDate && data.birthDate > today())
      return fail("A data de nascimento não pode ser futura.");
    const s = getState();
    const everyone = [...s.volunteers, ...s.supervisors];
    const dup = everyone.find((v) => v.cpf === cpf && v.id !== data.id);
    if (dup) return fail("Já existe uma pessoa com este CPF.");
    const payload = {
      name: data.name.trim(),
      cpf,
      phone: data.phone.trim(),
      email: data.email.trim(),
      birthDate: data.birthDate || null,
    };

    if (data.id) {
      const current = everyone.find((v) => v.id === data.id);
      if (current && current.cpf && current.cpf !== cpf) {
        const r = await manageUsers({ action: "change_cpf", userId: data.id, cpf });
        if (!r.ok) return r;
      }
      const r = await run(() =>
        supabase.rpc("staff_update_volunteer", {
          p_id: data.id,
          p_name: payload.name,
          p_phone: payload.phone,
          p_email: payload.email,
          p_birth: payload.birthDate,
        }),
      );
      if (!r.ok) return r;
      if (data.role && current && current.role !== data.role && current.role !== "admin") {
        const rr = await repo.setUserRole(data.id, data.role);
        if (!rr.ok) return rr;
      }
      if (data.photo !== undefined) return repo.setPhoto(data.id, data.photo);
      return ok;
    }

    const r = await manageUsers<{ id: string }>({
      action: "create_volunteer",
      ...payload,
      role: data.role ?? "voluntario",
    });
    if (!r.ok) return r;
    if (data.photo) await repo.setPhoto(r.id, data.photo);
    return ok;
  },

  async setUserRole(id: string, role: TeamRole): Promise<Result> {
    return run(() => supabase.rpc("set_user_role", { p_id: id, p_role: role }));
  },

  /** Volta a senha para o CPF; a pessoa troca no próximo acesso. */
  async resetPassword(userId: string): Promise<Result> {
    return manageUsers({ action: "reset_password", userId });
  },

  /** A coordenação define uma senha nova para a pessoa. */
  async setPassword(userId: string, password: string, mustChange: boolean): Promise<Result> {
    if (password.length < 8) return fail("A senha deve ter pelo menos 8 caracteres.");
    if (password.length > 72) return fail("A senha deve ter no máximo 72 caracteres.");
    return manageUsers({ action: "set_password", userId, password, mustChange });
  },

  /** Contas antigas da coordenação (criadas com usuário) passam a entrar pelo CPF. */
  async setMyCpf(cpfInput: string): Promise<Result> {
    const cpf = cpfInput.replace(/\D/g, "");
    if (!validCpf(cpf)) return fail("CPF inválido. Confira os números.");
    return manageUsers({ action: "set_my_cpf", cpf });
  },

  /** Ativa/desativa (bloqueia o login, preserva o histórico). */
  async setUserStatus(userId: string, status: "ativo" | "inativo"): Promise<Result> {
    return manageUsers({ action: "set_status", userId, status });
  },

  async toggleVolunteer(id: string): Promise<Result> {
    const s = getState();
    const v = [...s.volunteers, ...s.supervisors].find((x) => x.id === id);
    if (!v) return fail("Pessoa não encontrada.");
    return repo.setUserStatus(id, v.status === "ativo" ? "inativo" : "ativo");
  },

  /** Envia a foto (já reduzida no aparelho) para o armazenamento privado. `null` remove. */
  async setPhoto(userId: string, photo: Blob | null): Promise<Result> {
    try {
      const old = [...getState().volunteers, ...getState().supervisors].find(
        (x) => x.id === userId,
      )?.photoPath;
      let path: string | null = null;
      if (photo) {
        if (photo.size > 2 * 1024 * 1024) return fail("A foto deve ter no máximo 2 MB.");
        if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type))
          return fail("Formato de imagem não suportado.");
        path = `${userId}/avatar-${Date.now()}.jpg`;
        const up = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(path, photo, { contentType: photo.type, upsert: false });
        if (up.error) return fail(friendlyError(up.error));
      }
      const { error } = await supabase
        .from("profiles")
        .update({ photo_path: path })
        .eq("id", userId);
      if (error) return fail(friendlyError(error));
      if (old) await supabase.storage.from(AVATAR_BUCKET).remove([old]);
      await refresh();
      return ok;
    } catch (e) {
      return fail(friendlyError(e));
    }
  },

  // ---------- Notificações ----------
  async setNotifPref(userId: string, type: NotifType, enabled: boolean): Promise<Result> {
    return run(() => supabase.from("notif_prefs").upsert({ user_id: userId, type, enabled }));
  },

  async markAllNotificationsRead(userId: string): Promise<Result> {
    return run(() =>
      supabase
        .from("notifications")
        .update({ read: true })
        .eq("recipient_id", userId)
        .eq("read", false),
    );
  },

  async markNotificationRead(id: string): Promise<Result> {
    return run(() => supabase.from("notifications").update({ read: true }).eq("id", id));
  },

  async publishDraw(drawId: string): Promise<Result> {
    return run(() => supabase.rpc("publish_draw", { p_draw: drawId }));
  },

  // ---------- Escalas fixas ----------
  async saveFixed(
    id: string | null,
    d: {
      weekday: number;
      start: string;
      end: string;
      slots: number;
      responsavelId?: string | null;
      note?: string;
      active?: boolean;
    },
  ): Promise<Result> {
    if (d.weekday < 0 || d.weekday > 6) return fail("Escolha o dia da semana.");
    if (!validTimeRange(d.start, d.end)) return fail("O horário final deve ser depois do inicial.");
    if (!Number.isInteger(d.slots) || d.slots < 1)
      return fail("Informe quantas pessoas são necessárias.");
    const row = {
      weekday: d.weekday,
      start_time: d.start,
      end_time: d.end,
      slots: d.slots,
      responsavel_id: d.responsavelId ?? null,
      note: d.note?.trim() || null,
      ...(d.active === undefined ? {} : { active: d.active }),
    };
    return run(() =>
      id
        ? supabase.from("fixed_schedules").update(row).eq("id", id)
        : supabase.from("fixed_schedules").insert(row),
    );
  },

  async removeFixed(id: string): Promise<Result> {
    return run(() => supabase.from("fixed_schedules").delete().eq("id", id));
  },

  /** Entrar numa escala fixa (o próprio voluntário, ou a coordenação por ele). */
  async joinFixed(fixedId: string, volunteerId: string): Promise<Result> {
    return run(() =>
      supabase.from("fixed_members").insert({ fixed_id: fixedId, volunteer_id: volunteerId }),
    );
  },

  async leaveFixed(fixedId: string, volunteerId: string): Promise<Result> {
    return run(() =>
      supabase
        .from("fixed_members")
        .delete()
        .eq("fixed_id", fixedId)
        .eq("volunteer_id", volunteerId),
    );
  },

  /** Sorteio de uma escala fixa para um mês. Fica em rascunho até publicar. */
  async drawFixed(fixedId: string, year: number, month: number): Promise<Result> {
    return run(() =>
      supabase.rpc("draw_fixed", { p_fixed: fixedId, p_year: year, p_month: month }),
    );
  },

  /** "Indisponível" numa data. O servidor avisa e, se faltar gente, escolhe o substituto. */
  async markUnavailable(
    fixedId: string,
    date: string,
    volunteerId?: string,
  ): Promise<Result & { outcome?: string }> {
    try {
      const { data, error } = await supabase.rpc("mark_unavailable", {
        p_fixed: fixedId,
        p_date: date,
        p_vol: volunteerId ?? null,
      });
      if (error) return fail(friendlyError(error));
      await refresh();
      return { ok: true, outcome: String(data ?? "") };
    } catch (e) {
      return fail(friendlyError(e));
    }
  },

  /** "Disponível": desfaz o "Indisponível". Se o lugar ainda estiver vago, a pessoa volta para a escala. */
  async markAvailable(
    fixedId: string,
    date: string,
    volunteerId?: string,
  ): Promise<Result & { outcome?: string }> {
    try {
      const { data, error } = await supabase.rpc("mark_available", {
        p_fixed: fixedId,
        p_date: date,
        p_vol: volunteerId ?? null,
      });
      if (error) return fail(friendlyError(error));
      await refresh();
      return { ok: true, outcome: String(data ?? "") };
    } catch (e) {
      return fail(friendlyError(e));
    }
  },

  /** Fixa pessoas nas datas informadas (lista vazia = desafixar) e refaz o sorteio do mês em rascunho. */
  async setFixedPins(
    fixedId: string,
    dates: string[],
    volunteerIds: string[],
    year: number,
    month: number,
  ): Promise<Result> {
    if (dates.length === 0) return fail("Escolha a data.");
    try {
      const { error } = await supabase.rpc("set_fixed_pins", {
        p_fixed: fixedId,
        p_dates: dates,
        p_vols: volunteerIds,
      });
      if (error) return fail(friendlyError(error));
    } catch (e) {
      return fail(friendlyError(e));
    }
    return run(() =>
      supabase.rpc("draw_fixed", { p_fixed: fixedId, p_year: year, p_month: month }),
    );
  },

  // ---------- Presença e substituição ----------
  async setAttendance(
    periodId: string,
    needId: string,
    volunteerId: string,
    status: AttendanceStatus,
  ): Promise<Result> {
    return run(() =>
      supabase.from("attendance").upsert(
        {
          period_id: periodId,
          need_id: needId,
          volunteer_id: volunteerId,
          status,
          recorded_at: new Date().toISOString(),
          recorded_by: myName(),
        },
        { onConflict: "need_id,volunteer_id" },
      ),
    );
  },

  async substitute(
    _periodId: string,
    needId: string,
    outId: string,
    inId: string,
    reason: string,
  ): Promise<Result> {
    return run(() =>
      supabase.rpc("substitute", { p_need: needId, p_out: outId, p_in: inId, p_reason: reason }),
    );
  },

  // ---------- Vagas avulsas e candidaturas ----------
  async createOpportunity(d: {
    date: string;
    start: string;
    end: string;
    min: number;
    max: number;
    note?: string;
    responsavelId?: string;
  }): Promise<Result> {
    if (!d.date) return fail("Informe a data.");
    if (d.date < today()) return fail("A data não pode estar no passado.");
    if (!d.start || !d.end) return fail("Informe o horário inicial e final.");
    if (d.end <= d.start) return fail("O horário final deve ser depois do inicial.");
    if (d.min < 1) return fail("A quantidade mínima deve ser pelo menos 1.");
    if (d.max < d.min) return fail("A quantidade máxima não pode ser menor que a mínima.");
    const s = getState().session;
    const responsavel =
      s?.role === "responsavel" ? s.userId : (d.responsavelId ?? s?.userId ?? null);
    return run(() =>
      supabase.from("opportunities").insert({
        date: d.date,
        start_time: d.start,
        end_time: d.end,
        min: d.min,
        max: d.max,
        note: d.note?.trim() || null,
        status: "aberta",
        responsavel_id: responsavel,
      }),
    );
  },

  async setOpportunityResponsavel(id: string, responsavelId: string | null): Promise<Result> {
    return run(() =>
      supabase.from("opportunities").update({ responsavel_id: responsavelId }).eq("id", id),
    );
  },

  async removeOpportunity(id: string): Promise<Result> {
    return run(() => supabase.from("opportunities").delete().eq("id", id));
  },

  /** Substitui os dias disponíveis do voluntário dentro de `weekDates` por `selected`. */
  async setWeekAvailability(
    volunteerId: string,
    weekDates: string[],
    selected: string[],
  ): Promise<Result> {
    try {
      const del = await supabase
        .from("day_availability")
        .delete()
        .eq("volunteer_id", volunteerId)
        .in("date", weekDates);
      if (del.error) return fail(friendlyError(del.error));
      if (selected.length) {
        const ins = await supabase
          .from("day_availability")
          .insert(selected.map((date) => ({ volunteer_id: volunteerId, date })));
        if (ins.error) return fail(friendlyError(ins.error));
      }
      await refresh();
      return ok;
    } catch (e) {
      return fail(friendlyError(e));
    }
  },

  async applyTo(opportunityId: string, _volunteerId?: string): Promise<Result> {
    return run(() => supabase.rpc("apply_to_opportunity", { p_opp: opportunityId }));
  },

  async cancelApplication(opportunityId: string, _volunteerId?: string): Promise<Result> {
    return run(() => supabase.rpc("cancel_application", { p_opp: opportunityId }));
  },

  async confirmSelection(opportunityId: string, selectedIds: string[]): Promise<Result> {
    return run(() =>
      supabase.rpc("confirm_selection", { p_opp: opportunityId, p_selected: selectedIds }),
    );
  },

  // ---------- Abas do menu (só admin; o banco confere) ----------
  async setNavConfig(config: AppState["navConfig"]): Promise<Result> {
    return run(() =>
      supabase
        .from("nav_config")
        .update({ config, updated_at: new Date().toISOString() })
        .eq("id", 1),
    );
  },

  /** Nome da instituição para a tela de login (antes de entrar). */
  async publicAppName(): Promise<string> {
    try {
      const { data } = await supabase.rpc("public_app_name");
      return typeof data === "string" ? data : "";
    } catch {
      return "";
    }
  },

  // ---------- Configurações ----------
  async updateSettings(patch: Partial<Settings>): Promise<Result> {
    const row: Record<string, string> = {};
    if (patch.churchName !== undefined) row["church_name"] = patch.churchName.trim().slice(0, 120);
    if (patch.visibilityPolicy !== undefined) row["visibility_policy"] = patch.visibilityPolicy;
    return run(() => supabase.from("app_settings").update(row).eq("id", 1));
  },
};

export type DataRepository = typeof repo;
