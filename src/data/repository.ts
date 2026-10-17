import { validTimeRange } from "@/lib/time";
import { AVATAR_BUCKET, cpfLogin, friendlyError, staffLogin, supabase } from "@/lib/supabase";
import { today } from "@/lib/format";
import { getState, refresh } from "./store";
import type { AttendanceStatus, AvailabilityValue, Draw, DrawPick, Need, NotifType, PeriodStatus, Settings, Volunteer } from "./types";

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
async function manageUsers<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<({ ok: true } & T) | { ok: false; error: string }> {
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
  async loginVolunteer(cpf: string, password: string): Promise<Result & { mustChange?: boolean }> {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) return fail("Informe um CPF com 11 dígitos.");
    return repo._login(cpfLogin(digits), password);
  },

  async loginStaff(username: string, password: string): Promise<Result & { mustChange?: boolean }> {
    if (!/^[a-z0-9._-]{3,32}$/i.test(username.trim())) return fail("Usuário ou senha inválidos.");
    return repo._login(staffLogin(username), password);
  },

  async _login(email: string, password: string): Promise<Result & { mustChange?: boolean }> {
    if (!password) return fail("Informe a senha.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return fail(friendlyError(error));
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
    if (!/[a-zA-Z]/.test(next) || !/\d/.test(next)) return fail("Use letras e números na nova senha.");
    if (next === current) return fail("A nova senha deve ser diferente da atual.");
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) return fail("Sessão expirada. Entre novamente.");
    // Confirma a senha atual antes de trocar.
    const check = await supabase.auth.signInWithPassword({ email, password: current });
    if (check.error) return fail("Senha atual incorreta.");
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) return fail(friendlyError(error));
    return run(() => supabase.rpc("password_changed"));
  },

  // ---------- Pessoas (contas criadas no servidor) ----------
  async saveVolunteer(
    data: Pick<Volunteer, "name" | "cpf" | "phone" | "email" | "birthDate"> & { id?: string; photo?: Blob | null },
  ): Promise<Result & { tempPassword?: string }> {
    const cpf = data.cpf.replace(/\D/g, "");
    if (data.name.trim().length < 3) return fail("Informe o nome completo.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.birthDate ?? "")) return fail("Informe a data de nascimento.");
    if (data.birthDate > today()) return fail("A data de nascimento não pode ser futura.");
    if (cpf.length !== 11) return fail("CPF deve ter 11 dígitos.");
    const dup = getState().volunteers.find((v) => v.cpf === cpf && v.id !== data.id);
    if (dup) return fail("Já existe um voluntário com este CPF.");
    const payload = { name: data.name.trim(), cpf, phone: data.phone.trim(), email: data.email.trim(), birthDate: data.birthDate };

    if (data.id) {
      const current = getState().volunteers.find((v) => v.id === data.id);
      if (current && current.cpf !== cpf) {
        const r = await manageUsers({ action: "change_cpf", userId: data.id, cpf });
        if (!r.ok) return r;
      }
      const r = await run(() =>
        supabase.rpc("staff_update_volunteer", { p_id: data.id, p_name: payload.name, p_phone: payload.phone, p_email: payload.email, p_birth: payload.birthDate }),
      );
      if (!r.ok) return r;
      if (data.photo !== undefined) return repo.setPhoto(data.id, data.photo);
      return ok;
    }

    const r = await manageUsers<{ id: string; tempPassword: string }>({ action: "create_volunteer", ...payload });
    if (!r.ok) return r;
    if (data.photo) await repo.setPhoto(r.id, data.photo);
    return { ok: true, tempPassword: r.tempPassword };
  },

  async createStaff(name: string, username: string): Promise<Result & { tempPassword?: string }> {
    if (name.trim().length < 3) return fail("Informe o nome completo.");
    if (!/^[a-z0-9._-]{3,32}$/.test(username.trim().toLowerCase())) return fail("Usuário: 3 a 32 letras minúsculas, números, ponto, hífen ou _.");
    const r = await manageUsers<{ tempPassword: string }>({ action: "create_staff", name: name.trim(), username: username.trim().toLowerCase() });
    if (!r.ok) return r;
    return { ok: true, tempPassword: r.tempPassword };
  },

  async resetPassword(userId: string): Promise<Result & { tempPassword?: string }> {
    const r = await manageUsers<{ tempPassword: string }>({ action: "reset_password", userId });
    if (!r.ok) return r;
    return { ok: true, tempPassword: r.tempPassword };
  },

  /** Ativa/desativa (bloqueia o login, preserva o histórico). */
  async setUserStatus(userId: string, status: "ativo" | "inativo"): Promise<Result> {
    return manageUsers({ action: "set_status", userId, status });
  },

  async toggleVolunteer(id: string): Promise<Result> {
    const v = getState().volunteers.find((x) => x.id === id);
    if (!v) return fail("Voluntário não encontrado.");
    return repo.setUserStatus(id, v.status === "ativo" ? "inativo" : "ativo");
  },

  async toggleSupervisor(id: string): Promise<Result> {
    const s = getState();
    if (s.session?.role !== "admin") return fail("Somente o administrador pode alterar supervisores.");
    const t = s.supervisors.find((x) => x.id === id);
    if (!t || t.role === "admin") return fail("Não é possível alterar este acesso.");
    return repo.setUserStatus(id, t.status === "ativo" ? "inativo" : "ativo");
  },

  async setVolunteerRole(id: string, role: "voluntario" | "responsavel"): Promise<Result> {
    return run(() => supabase.rpc("set_volunteer_role", { p_id: id, p_role: role }));
  },

  /** Envia a foto (já reduzida no aparelho) para o armazenamento privado. `null` remove. */
  async setPhoto(userId: string, photo: Blob | null): Promise<Result> {
    try {
      const old = [...getState().volunteers, ...getState().supervisors].find((x) => x.id === userId)?.photoPath;
      let path: string | null = null;
      if (photo) {
        if (photo.size > 2 * 1024 * 1024) return fail("A foto deve ter no máximo 2 MB.");
        if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) return fail("Formato de imagem não suportado.");
        path = `${userId}/avatar-${Date.now()}.jpg`;
        const up = await supabase.storage.from(AVATAR_BUCKET).upload(path, photo, { contentType: photo.type, upsert: false });
        if (up.error) return fail(friendlyError(up.error));
      }
      const { error } = await supabase.from("profiles").update({ photo_path: path }).eq("id", userId);
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
    return run(() => supabase.from("notifications").update({ read: true }).eq("recipient_id", userId).eq("read", false));
  },

  async markNotificationRead(id: string): Promise<Result> {
    return run(() => supabase.from("notifications").update({ read: true }).eq("id", id));
  },

  // ---------- Períodos e turnos ----------
  async createPeriod(data: { month: number; year: number; openDate: string; deadline: string }): Promise<Result> {
    if (getState().periods.some((p) => p.month === data.month && p.year === data.year)) return fail("Já existe um período para este mês.");
    return run(() =>
      supabase.from("periods").insert({ month: data.month, year: data.year, open_date: data.openDate, deadline: data.deadline, status: "rascunho" }),
    );
  },

  async updatePeriod(id: string, patch: { openDate?: string; deadline?: string }): Promise<Result> {
    const row: Record<string, string> = {};
    if (patch.openDate) row["open_date"] = patch.openDate;
    if (patch.deadline) row["deadline"] = patch.deadline;
    return run(() => supabase.from("periods").update(row).eq("id", id));
  },

  async setPeriodStatus(id: string, status: PeriodStatus): Promise<Result> {
    return run(() => supabase.from("periods").update({ status }).eq("id", id));
  },

  async addNeed(periodId: string, n: Omit<Need, "id">): Promise<Result> {
    if (!validTimeRange(n.start, n.end)) return fail("Informe um horário final posterior ao início, no mesmo dia.");
    return run(() =>
      supabase.from("needs").insert({
        period_id: periodId,
        date: n.date,
        start_time: n.start,
        end_time: n.end,
        slots: Math.max(1, n.slots),
        responsavel_id: n.responsavelId ?? null,
      }),
    );
  },

  async updateNeedSlots(_periodId: string, needId: string, slots: number): Promise<Result> {
    return run(() => supabase.from("needs").update({ slots: Math.max(1, slots) }).eq("id", needId));
  },

  async setNeedResponsavel(needId: string, responsavelId: string | null): Promise<Result> {
    return run(() => supabase.from("needs").update({ responsavel_id: responsavelId }).eq("id", needId));
  },

  /** Define o mesmo responsável para todos os turnos de um dia. */
  async setDayResponsavel(periodId: string, date: string, responsavelId: string | null): Promise<Result> {
    return run(() => supabase.from("needs").update({ responsavel_id: responsavelId }).eq("period_id", periodId).eq("date", date));
  },

  async removeNeed(_periodId: string, needId: string): Promise<Result> {
    return run(() => supabase.from("needs").delete().eq("id", needId));
  },

  // ---------- Disponibilidade ----------
  async setAvailability(periodId: string, volunteerId: string, needId: string, value: AvailabilityValue): Promise<Result> {
    const p = getState().periods.find((x) => x.id === periodId);
    if (p?.status !== "aberta") return fail("Período encerrado.");
    return run(() =>
      supabase
        .from("availabilities")
        .upsert({ period_id: periodId, volunteer_id: volunteerId, need_id: needId, value, updated_at: new Date().toISOString() }),
    );
  },

  // ---------- Sorteio ----------
  /**
   * Regra: menor nº de escalas nos últimos 3 meses; empate → últimos 12 meses; persistindo → aleatório.
   * Nunca seleciona voluntários indisponíveis ou sem resposta (o servidor confere de novo).
   */
  async runDraw(periodId: string): Promise<(Result & { draw?: Draw })> {
    const s = getState();
    const period = s.periods.find((p) => p.id === periodId);
    if (!period) return fail("Período não encontrado.");
    const active = s.volunteers.filter((v) => v.status === "ativo");
    const counts = new Map(active.map((v) => [v.id, { r: v.recent3m, y: v.last12m }]));
    const busyByDate = new Map<string, Set<string>>();
    const needs = [...period.needs].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
    const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

    const slots = needs.map((n) => {
      const busy = busyByDate.get(n.date) ?? new Set<string>();
      const eligible = active
        .filter((v) => s.availabilities.some((a) => a.periodId === periodId && a.volunteerId === v.id && a.needId === n.id && a.value === "disponivel"))
        .filter((v) => !busy.has(v.id))
        .map((v) => ({ id: v.id, ...counts.get(v.id)!, rand: rand() }))
        .sort((a, b) => a.r - b.r || a.y - b.y || a.rand - b.rand);

      const chosen = eligible.slice(0, n.slots);
      const picks: DrawPick[] = chosen.map((c, i) => {
        const neighbors = eligible.filter((e) => e.id !== c.id && e.r === c.r);
        const tiebreak = neighbors.length === 0 ? "Escalas recentes" : neighbors.some((e) => e.y === c.y) ? "Aleatório" : "Últimos 12 meses";
        return { volunteerId: c.id, recent3m: c.r, last12m: c.y, priority: i + 1, tiebreak };
      });
      chosen.forEach((c) => {
        const cnt = counts.get(c.id)!;
        counts.set(c.id, { r: cnt.r + 1, y: cnt.y + 1 });
        busy.add(c.id);
      });
      busyByDate.set(n.date, busy);
      return { needId: n.id, eligible: eligible.length, picks };
    });

    try {
      const { data, error } = await supabase.rpc("save_draw", { p_period: periodId, p_slots: slots, p_created_by: myName() });
      if (error) return fail(friendlyError(error));
      await refresh();
      return { ok: true, draw: getState().draws.find((d) => d.id === data) };
    } catch (e) {
      return fail(friendlyError(e));
    }
  },

  async publishDraw(drawId: string): Promise<Result> {
    return run(() => supabase.rpc("publish_draw", { p_draw: drawId }));
  },

  // ---------- Presença e substituição ----------
  async setAttendance(periodId: string, needId: string, volunteerId: string, status: AttendanceStatus): Promise<Result> {
    return run(() =>
      supabase.from("attendance").upsert(
        { period_id: periodId, need_id: needId, volunteer_id: volunteerId, status, recorded_at: new Date().toISOString(), recorded_by: myName() },
        { onConflict: "need_id,volunteer_id" },
      ),
    );
  },

  async substitute(_periodId: string, needId: string, outId: string, inId: string, reason: string): Promise<Result> {
    return run(() => supabase.rpc("substitute", { p_need: needId, p_out: outId, p_in: inId, p_reason: reason }));
  },

  // ---------- Vagas avulsas e candidaturas ----------
  async createOpportunity(d: { date: string; start: string; end: string; min: number; max: number; note?: string; responsavelId?: string }): Promise<Result> {
    if (!d.date) return fail("Informe a data.");
    if (d.date < today()) return fail("A data não pode estar no passado.");
    if (!d.start || !d.end) return fail("Informe o horário inicial e final.");
    if (d.end <= d.start) return fail("O horário final deve ser depois do inicial.");
    if (d.min < 1) return fail("A quantidade mínima deve ser pelo menos 1.");
    if (d.max < d.min) return fail("A quantidade máxima não pode ser menor que a mínima.");
    const s = getState().session;
    const responsavel = s?.role === "responsavel" ? s.userId : (d.responsavelId ?? s?.userId ?? null);
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
    return run(() => supabase.from("opportunities").update({ responsavel_id: responsavelId }).eq("id", id));
  },

  async removeOpportunity(id: string): Promise<Result> {
    return run(() => supabase.from("opportunities").delete().eq("id", id));
  },

  /** Substitui os dias disponíveis do voluntário dentro de `weekDates` por `selected`. */
  async setWeekAvailability(volunteerId: string, weekDates: string[], selected: string[]): Promise<Result> {
    try {
      const del = await supabase.from("day_availability").delete().eq("volunteer_id", volunteerId).in("date", weekDates);
      if (del.error) return fail(friendlyError(del.error));
      if (selected.length) {
        const ins = await supabase.from("day_availability").insert(selected.map((date) => ({ volunteer_id: volunteerId, date })));
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
    return run(() => supabase.rpc("confirm_selection", { p_opp: opportunityId, p_selected: selectedIds }));
  },

  // ---------- Configurações ----------
  async updateSettings(patch: Partial<Settings>): Promise<Result> {
    const row: Record<string, string> = {};
    if (patch.churchName !== undefined) row["church_name"] = patch.churchName.trim().slice(0, 120);
    if (patch.ministryName !== undefined) row["ministry_name"] = patch.ministryName.trim().slice(0, 120);
    return run(() => supabase.from("app_settings").update(row).eq("id", 1));
  },
};

export type DataRepository = typeof repo;
