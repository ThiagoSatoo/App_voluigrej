import { validTimeRange } from "@/lib/time";
import { getState, resetStore, setState } from "./store";
import { REMINDERS, demoNow, prefEnabled, startOf } from "./notifications";
import type {
  AttendanceStatus,
  AppState,
  AvailabilityValue,
  NotifType,
  Draw,
  DrawPick,
  Need,
  PeriodStatus,
  Settings,
  Volunteer,
} from "./types";

/**
 * Data access layer (mock implementation).
 * Every screen mutates data ONLY through `repo`. To plug in a real database,
 * re-implement these methods (keeping the same signatures) against the API.
 */
type Result = { ok: true } | { ok: false; error: string };

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();
const supervisorName = () => {
  const s = getState();
  return s.supervisors.find((x) => x.id === s.session?.userId)?.name ?? s.settings.supervisorName;
};

type NotifDraft = { recipientId: string; type: NotifType; message: string; opportunityId?: string; key?: string };

/** Adds notifications respecting each recipient's preferences and skipping duplicates (same key). */
function withNotifications(st: AppState, drafts: NotifDraft[]): AppState {
  const keys = new Set(st.notifications.map((n) => n.key).filter(Boolean));
  const add = drafts.filter((d) => {
    if (!prefEnabled(st, d.recipientId, d.type)) return false;
    if (d.key && keys.has(d.key)) return false;
    if (d.key) keys.add(d.key);
    return true;
  });
  if (add.length === 0) return st;
  const at = demoNow().toISOString();
  return { ...st, notifications: [...add.map((d) => ({ id: uid("nt"), ...d, createdAt: at, read: false })), ...st.notifications] };
}

const responsibleOf = (o: { supervisorId?: string }) => o.supervisorId ?? "s1";
const countActive = (st: AppState, oid: string) =>
  st.applications.filter((a) => a.opportunityId === oid && (a.status === "candidatado" || a.status === "selecionado")).length;

/** Threshold notifications when the count crosses min / max (each crossing notifies once). */
function thresholdDrafts(o: { id: string; date: string; start: string; min: number; max: number; supervisorId?: string }, before: number, after: number): NotifDraft[] {
  const out: NotifDraft[] = [];
  const when = `${o.date.split("-").reverse().join("/")} às ${o.start}`;
  if (before < o.max && after >= o.max)
    out.push({ recipientId: responsibleOf(o), type: "escala_completa", opportunityId: o.id, message: `Escala completa em ${when}: ${after}/${o.max} voluntários (máximo atingido).` });
  else if (before < o.min && after >= o.min)
    out.push({ recipientId: responsibleOf(o), type: "minimo_atingido", opportunityId: o.id, message: `Mínimo atingido em ${when}: ${after} de ${o.min} necessários (máximo ${o.max}).` });
  return out;
}

export const repo = {
  // ---------- Autenticação (simulada) ----------
  loginSupervisor(user: string, password: string): Result {
    const s = getState();
    const staff = s.supervisors.find((x) => x.username === user.trim().toLowerCase());
    if (!staff || password !== staff.password) return { ok: false, error: "Usuário ou senha inválidos." };
    if (staff.status === "inativo") return { ok: false, error: "Seu acesso de supervisor foi desativado pelo administrador." };
    setState((st) => ({ ...st, session: { role: staff.role, userId: staff.id } }));
    return { ok: true };
  },

  /** Somente o admin pode ativar/desativar supervisores. */
  toggleSupervisor(id: string): Result {
    const s = getState();
    if (s.session?.role !== "admin") return { ok: false, error: "Somente o administrador pode alterar supervisores." };
    const t = s.supervisors.find((x) => x.id === id);
    if (!t || t.role === "admin") return { ok: false, error: "Não é possível alterar este acesso." };
    setState((st) => ({ ...st, supervisors: st.supervisors.map((x) => (x.id === id ? { ...x, status: x.status === "ativo" ? "inativo" : "ativo" } : x)) }));
    return { ok: true };
  },

  setNotifPref(userId: string, type: NotifType, enabled: boolean) {
    setState((st) => ({ ...st, notifPrefs: { ...st.notifPrefs, [userId]: { ...st.notifPrefs[userId], [type]: enabled } } }));
  },

  markAllNotificationsRead(userId: string) {
    setState((st) => ({ ...st, notifications: st.notifications.map((n) => (n.recipientId === userId ? { ...n, read: true } : n)) }));
  },

  /** Time-based alerts (24h below minimum, birthdays, reminders). Safe to call repeatedly — duplicates are skipped. */
  runScheduledChecks(real = new Date()) {
    const s = getState();
    const now = demoNow(real);
    const nowMs = now.getTime();
    const H = 3600_000;
    const drafts: NotifDraft[] = [];
    const activeStaff = s.supervisors.filter((x) => x.status === "ativo");
    const fmt = (d: string) => d.split("-").reverse().join("/");

    // Necessidade abaixo do mínimo 24h antes
    s.opportunities.forEach((o) => {
      const t = startOf(o.date, o.start).getTime();
      const c = countActive(s, o.id);
      if (c < o.min && nowMs >= t - 24 * H && nowMs < t)
        drafts.push({ recipientId: responsibleOf(o), type: "abaixo_minimo_24h", opportunityId: o.id, key: `24h:${o.id}`, message: `Faltam menos de 24h para ${fmt(o.date)} às ${o.start} e a necessidade está abaixo do mínimo (${c}/${o.min}).` });
    });

    // Aniversários (data de nascimento cadastrada)
    const md = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const today = md(now);
    const in7 = md(new Date(nowMs + 7 * 24 * H));
    s.volunteers.filter((v) => v.status === "ativo" && v.birthDate).forEach((v) => {
      const b = v.birthDate.slice(5);
      activeStaff.forEach((st) => {
        if (b === today) drafts.push({ recipientId: st.id, type: "aniversario_dia", key: `bday:${v.id}:${now.getFullYear()}:${st.id}`, message: `Hoje é aniversário de ${v.name}! 🎉` });
        if (b === in7) drafts.push({ recipientId: st.id, type: "aniversario_7d", key: `bday7:${v.id}:${now.getFullYear()}:${st.id}`, message: `Daqui a 7 dias (${fmt(`${now.getFullYear()}-${b}`).slice(0, 5)}) é aniversário de ${v.name}.` });
      });
    });

    // Lembretes de escalas confirmadas (somente a janela mais próxima que já começou)
    const remind = (recipientId: string, id: string, date: string, start: string, label: string) => {
      const t = startOf(date, start).getTime();
      if (nowMs >= t) return;
      const enabled = REMINDERS.filter((r) => prefEnabled(s, recipientId, r.type));
      const hit = enabled.filter((r) => nowMs >= t - r.hours * H).sort((a, b) => a.hours - b.hours)[0];
      if (hit) drafts.push({ recipientId, type: hit.type, key: `rem:${id}:${recipientId}:${hit.hours}`, message: `Lembrete: ${label} em ${fmt(date)} às ${start} (faltam menos de ${hit.hours}h).` });
    };
    s.opportunities.filter((o) => o.status === "confirmada").forEach((o) => {
      const sel = s.applications.filter((a) => a.opportunityId === o.id && a.status === "selecionado");
      sel.forEach((a) => remind(a.volunteerId, o.id, o.date, o.start, "você está escalado(a)"));
      if (sel.length) remind(responsibleOf(o), o.id, o.date, o.start, `escala confirmada com ${sel.length} voluntário(s)`);
    });
    s.draws.filter((d) => d.status === "publicado").forEach((d) => {
      const period = s.periods.find((p) => p.id === d.periodId);
      d.slots.forEach((sl) => {
        const n = period?.needs.find((x) => x.id === sl.needId);
        if (!n) return;
        sl.picks.forEach((p) => {
          const att = s.attendance.find((a) => a.needId === n.id && a.volunteerId === p.volunteerId);
          if (att && (att.status === "cancelado" || att.status === "substituido")) return;
          remind(p.volunteerId, n.id, n.date, n.start, "você está escalado(a)");
        });
      });
    });

    if (drafts.length === 0) return;
    const next = withNotifications(s, drafts);
    if (next !== s) setState(() => next);
  },

  loginVolunteer(cpf: string, password: string): Result & { mustChange?: boolean } {
    const digits = cpf.replace(/\D/g, "");
    const v = getState().volunteers.find((x) => x.cpf === digits);
    if (!v || v.password !== password) return { ok: false, error: "CPF ou senha inválidos." };
    if (v.status === "inativo") return { ok: false, error: "Seu acesso está desativado. Fale com o supervisor." };
    setState((st) => ({ ...st, session: { role: "voluntario", userId: v.id } }));
    return { ok: true, mustChange: v.mustChangePassword };
  },

  logout() {
    setState((st) => ({ ...st, session: null }));
  },

  changePassword(volunteerId: string, current: string, next: string): Result {
    const v = getState().volunteers.find((x) => x.id === volunteerId);
    if (!v) return { ok: false, error: "Usuário não encontrado." };
    if (v.password !== current) return { ok: false, error: "Senha atual incorreta." };
    if (next.length < 6) return { ok: false, error: "A nova senha deve ter pelo menos 6 caracteres." };
    if (next === current) return { ok: false, error: "A nova senha deve ser diferente da atual." };
    repo._updateVolunteer(volunteerId, { password: next, mustChangePassword: false });
    return { ok: true };
  },

  resetPassword(volunteerId: string) {
    repo._updateVolunteer(volunteerId, { password: "123456", mustChangePassword: true });
  },

  // ---------- Voluntários ----------
  _updateVolunteer(id: string, patch: Partial<Volunteer>) {
    setState((st) => ({ ...st, volunteers: st.volunteers.map((v) => (v.id === id ? { ...v, ...patch } : v)) }));
  },

  saveVolunteer(data: Pick<Volunteer, "name" | "cpf" | "phone" | "email" | "birthDate"> & { id?: string; photoUrl?: string }): Result {
    const cpf = data.cpf.replace(/\D/g, "");
    if (data.name.trim().length < 3) return { ok: false, error: "Informe o nome completo." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.birthDate ?? "")) return { ok: false, error: "Informe a data de nascimento." };
    if (data.birthDate > now().slice(0, 10)) return { ok: false, error: "A data de nascimento não pode ser futura." };
    if (cpf.length !== 11) return { ok: false, error: "CPF deve ter 11 dígitos." };
    const dup = getState().volunteers.find((v) => v.cpf === cpf && v.id !== data.id);
    if (dup) return { ok: false, error: "Já existe um voluntário com este CPF." };
    if (data.id) {
      repo._updateVolunteer(data.id, { name: data.name.trim(), cpf, phone: data.phone, email: data.email, birthDate: data.birthDate, photoUrl: data.photoUrl });
    } else {
      const v: Volunteer = {
        id: uid("v"),
        name: data.name.trim(),
        cpf,
        phone: data.phone,
        email: data.email,
        birthDate: data.birthDate,
        photoUrl: data.photoUrl,
        status: "ativo",
        recent3m: 0,
        last12m: 0,
        password: "123456",
        mustChangePassword: true,
        joinedAt: now().slice(0, 10),
      };
      setState((st) => ({ ...st, volunteers: [...st.volunteers, v] }));
    }
    return { ok: true };
  },

  toggleVolunteer(id: string) {
    const v = getState().volunteers.find((x) => x.id === id);
    if (v) repo._updateVolunteer(id, { status: v.status === "ativo" ? "inativo" : "ativo" });
  },

  setPhoto(id: string, photoUrl: string | undefined) {
    repo._updateVolunteer(id, { photoUrl });
  },

  // ---------- Períodos e necessidades ----------
  createPeriod(data: { month: number; year: number; openDate: string; deadline: string }): Result {
    if (getState().periods.some((p) => p.month === data.month && p.year === data.year))
      return { ok: false, error: "Já existe um período para este mês." };
    setState((st) => ({ ...st, periods: [...st.periods, { id: uid("p"), ...data, status: "rascunho", needs: [] }] }));
    return { ok: true };
  },

  updatePeriod(id: string, patch: { openDate?: string; deadline?: string }) {
    setState((st) => ({ ...st, periods: st.periods.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  },

  setPeriodStatus(id: string, status: PeriodStatus) {
    setState((st) => ({ ...st, periods: st.periods.map((p) => (p.id === id ? { ...p, status } : p)) }));
  },

  addNeed(periodId: string, n: Omit<Need, "id">): Result {
    if (!validTimeRange(n.start, n.end)) return { ok: false, error: "Informe um horário final posterior ao início, no mesmo dia." };
    setState((st) => ({
      ...st,
      periods: st.periods.map((p) => (p.id === periodId ? { ...p, needs: [...p.needs, { ...n, id: uid("n") }] } : p)),
    }));
    return { ok: true };
  },

  updateNeedSlots(periodId: string, needId: string, slots: number) {
    setState((st) => ({
      ...st,
      periods: st.periods.map((p) =>
        p.id === periodId ? { ...p, needs: p.needs.map((n) => (n.id === needId ? { ...n, slots: Math.max(1, slots) } : n)) } : p,
      ),
    }));
  },

  removeNeed(periodId: string, needId: string) {
    setState((st) => ({
      ...st,
      periods: st.periods.map((p) => (p.id === periodId ? { ...p, needs: p.needs.filter((n) => n.id !== needId) } : p)),
      availabilities: st.availabilities.filter((a) => a.needId !== needId),
    }));
  },

  // ---------- Disponibilidade ----------
  setAvailability(periodId: string, volunteerId: string, needId: string, value: AvailabilityValue): Result {
    const p = getState().periods.find((x) => x.id === periodId);
    if (p?.status !== "aberta") return { ok: false, error: "Período encerrado." };
    setState((st) => {
      const rest = st.availabilities.filter((a) => !(a.periodId === periodId && a.volunteerId === volunteerId && a.needId === needId));
      return { ...st, availabilities: [...rest, { periodId, volunteerId, needId, value, updatedAt: now() }] };
    });
    return { ok: true };
  },

  // ---------- Sorteio ----------
  /**
   * Regra: menor nº de escalas nos últimos 3 meses; empate → últimos 12 meses; persistindo → aleatório.
   * Nunca seleciona voluntários indisponíveis ou sem resposta.
   */
  runDraw(periodId: string): Draw {
    const s = getState();
    const period = s.periods.find((p) => p.id === periodId)!;
    const active = s.volunteers.filter((v) => v.status === "ativo");
    const counts = new Map(active.map((v) => [v.id, { r: v.recent3m, y: v.last12m }]));
    const busyByDate = new Map<string, Set<string>>();
    const needs = [...period.needs].sort((a, b) => a.date.localeCompare(b.date));

    const slots = needs.map((n) => {
      const busy = busyByDate.get(n.date) ?? new Set<string>();
      const eligible = active
        .filter((v) => s.availabilities.some((a) => a.periodId === periodId && a.volunteerId === v.id && a.needId === n.id && a.value === "disponivel"))
        .filter((v) => !busy.has(v.id))
        .map((v) => ({ id: v.id, ...counts.get(v.id)!, rand: Math.random() }))
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

    const existing = s.draws.filter((d) => d.periodId === periodId);
    const draw: Draw = {
      id: uid("d"),
      periodId,
      number: existing.reduce((m, d) => Math.max(m, d.number), 0) + 1,
      createdAt: now(),
      createdBy: supervisorName(),
      status: "rascunho",
      slots,
    };
    setState((st) => ({
      ...st,
      draws: [...st.draws.map((d) => (d.periodId === periodId && d.status === "rascunho" ? { ...d, status: "substituido" as const } : d)), draw],
      periods: st.periods.map((p) => (p.id === periodId && p.status !== "publicada" ? { ...p, status: "sorteado" } : p)),
    }));
    return draw;
  },

  publishDraw(drawId: string) {
    const d = getState().draws.find((x) => x.id === drawId);
    if (!d) return;
    setState((st) => ({
      ...st,
      draws: st.draws.map((x) =>
        x.id === drawId ? { ...x, status: "publicado" } : x.periodId === d.periodId && x.status === "publicado" ? { ...x, status: "substituido" } : x,
      ),
      periods: st.periods.map((p) => (p.id === d.periodId ? { ...p, status: "publicada" } : p)),
    }));
  },

  // ---------- Presença e substituição ----------
  setAttendance(periodId: string, needId: string, volunteerId: string, status: AttendanceStatus) {
    setState((st) => ({
      ...st,
      attendance: [
        ...st.attendance.filter((a) => !(a.needId === needId && a.volunteerId === volunteerId)),
        { id: uid("a"), periodId, needId, volunteerId, status, recordedAt: now(), supervisor: supervisorName() },
      ],
    }));
  },

  substitute(periodId: string, needId: string, outId: string, inId: string, reason: string) {
    const v = getState().volunteers.find((x) => x.id === inId)!;
    setState((st) => ({
      ...st,
      draws: st.draws.map((d) =>
        d.periodId === periodId && d.status === "publicado"
          ? {
              ...d,
              slots: d.slots.map((sl) =>
                sl.needId === needId
                  ? { ...sl, picks: sl.picks.map((p) => (p.volunteerId === outId ? { ...p, volunteerId: inId, recent3m: v.recent3m, last12m: v.last12m, tiebreak: "Substituição" } : p)) }
                  : sl,
              ),
            }
          : d,
      ),
      substitutions: [...st.substitutions, { id: uid("s"), periodId, needId, outId, inId, at: now(), supervisor: supervisorName(), reason }],
      attendance: [
        ...st.attendance.filter((a) => !(a.needId === needId && a.volunteerId === outId)),
        { id: uid("a"), periodId, needId, volunteerId: outId, status: "substituido", recordedAt: now(), supervisor: supervisorName() },
      ],
    }));
  },

  // ---------- Necessidades avulsas e candidaturas ----------
  createOpportunity(d: { date: string; start: string; end: string; min: number; max: number; note?: string }): Result {
    if (!d.date) return { ok: false, error: "Informe a data." };
    if (!d.start || !d.end) return { ok: false, error: "Informe o horário inicial e final." };
    if (d.end <= d.start) return { ok: false, error: "O horário final deve ser depois do inicial." };
    if (d.min < 1) return { ok: false, error: "A quantidade mínima deve ser pelo menos 1." };
    if (d.max < d.min) return { ok: false, error: "A quantidade máxima não pode ser menor que a mínima." };
    setState((st) => ({
      ...st,
      opportunities: [...st.opportunities, { id: uid("o"), ...d, note: d.note?.trim() || undefined, status: "aberta", createdAt: now(), supervisorId: st.session?.role !== "voluntario" ? st.session?.userId : undefined }],
    }));
    return { ok: true };
  },

  removeOpportunity(id: string) {
    setState((st) => ({
      ...st,
      opportunities: st.opportunities.filter((o) => o.id !== id),
      applications: st.applications.filter((a) => a.opportunityId !== id),
      notifications: st.notifications.filter((n) => n.opportunityId !== id),
    }));
  },

  /** Replaces the volunteer's available days inside `weekDates` with `selected`. */
  setWeekAvailability(volunteerId: string, weekDates: string[], selected: string[]) {
    setState((st) => ({
      ...st,
      dayAvailability: [
        ...st.dayAvailability.filter((d) => !(d.volunteerId === volunteerId && weekDates.includes(d.date))),
        ...selected.map((date) => ({ volunteerId, date })),
      ],
    }));
  },

  applyTo(opportunityId: string, volunteerId: string): Result {
    const s = getState();
    const o = s.opportunities.find((x) => x.id === opportunityId);
    if (!o || o.status !== "aberta") return { ok: false, error: "Esta escala não está mais aberta." };
    const v = s.volunteers.find((x) => x.id === volunteerId);
    if (!v || v.status !== "ativo") return { ok: false, error: "Voluntários inativos não podem se candidatar." };
    const before = countActive(s, opportunityId);
    setState((st) => {
      const next: AppState = {
        ...st,
        applications: [
          ...st.applications.filter((a) => !(a.opportunityId === opportunityId && a.volunteerId === volunteerId)),
          { id: uid("ap"), opportunityId, volunteerId, status: "candidatado", updatedAt: now() },
        ],
      };
      const after = countActive(next, opportunityId);
      return withNotifications(next, [
        { recipientId: responsibleOf(o), type: "nova_candidatura", opportunityId, message: `${v.name} se candidatou para ${o.date.split("-").reverse().join("/")} às ${o.start} (${after}/${o.max}).` },
        ...thresholdDrafts(o, before, after),
      ]);
    });
    return { ok: true };
  },

  cancelApplication(opportunityId: string, volunteerId: string): Result {
    const s = getState();
    const o = s.opportunities.find((x) => x.id === opportunityId);
    if (!o || o.status !== "aberta") return { ok: false, error: "A seleção já foi confirmada." };
    const remaining = s.applications.filter((a) => a.opportunityId === opportunityId && a.status === "candidatado" && a.volunteerId !== volunteerId).length;
    const v = s.volunteers.find((x) => x.id === volunteerId);
    setState((st) =>
      withNotifications(
        {
          ...st,
          applications: st.applications.map((a) =>
            a.opportunityId === opportunityId && a.volunteerId === volunteerId ? { ...a, status: "cancelado", updatedAt: now() } : a,
          ),
        },
        [
          {
            recipientId: responsibleOf(o),
            type: "candidatura_cancelada",
            opportunityId,
            message:
              remaining < o.min
                ? `${v?.name ?? "Um voluntário"} cancelou a candidatura. A escala está abaixo do mínimo (${remaining}/${o.min}).`
                : `${v?.name ?? "Um voluntário"} cancelou a candidatura (${remaining}/${o.max}).`,
          },
        ],
      ),
    );
    return { ok: true };
  },

  confirmSelection(opportunityId: string, selectedIds: string[]) {
    const o = getState().opportunities.find((x) => x.id === opportunityId);
    if (!o) return;
    setState((st) => withNotifications({
      ...st,
      opportunities: st.opportunities.map((o) => (o.id === opportunityId ? { ...o, status: "confirmada" } : o)),
      applications: st.applications.map((a) =>
        a.opportunityId === opportunityId && a.status === "candidatado"
          ? { ...a, status: selectedIds.includes(a.volunteerId) ? "selecionado" : "nao_selecionado", updatedAt: now() }
          : a,
      ),
    }, thresholdDrafts(o, 0, selectedIds.length).map((d) => ({ ...d, key: `sel:${d.type}:${opportunityId}`, message: `Seleção confirmada — ${d.message}` }))));
  },

  markNotificationRead(id: string) {
    setState((st) => ({ ...st, notifications: st.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
  },

  // ---------- Configurações ----------
  updateSettings(patch: Partial<Settings>) {
    setState((st) => ({ ...st, settings: { ...st.settings, ...patch } }));
  },

  resetDemoData() {
    resetStore();
  },
};

export type DataRepository = typeof repo;
