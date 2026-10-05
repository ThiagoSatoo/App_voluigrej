import { getState, resetStore, setState } from "./store";
import type {
  AttendanceStatus,
  AvailabilityValue,
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
const supervisorName = () => getState().settings.supervisorName;

export const repo = {
  // ---------- Autenticação (simulada) ----------
  loginSupervisor(user: string, password: string): Result {
    const s = getState();
    if (user.trim().toLowerCase() !== "supervisor" || password !== s.settings.supervisorPassword)
      return { ok: false, error: "Usuário ou senha inválidos." };
    setState((st) => ({ ...st, session: { role: "supervisor", userId: "supervisor" } }));
    return { ok: true };
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

  saveVolunteer(data: Pick<Volunteer, "name" | "cpf" | "phone" | "email"> & { id?: string; photoUrl?: string }): Result {
    const cpf = data.cpf.replace(/\D/g, "");
    if (data.name.trim().length < 3) return { ok: false, error: "Informe o nome completo." };
    if (cpf.length !== 11) return { ok: false, error: "CPF deve ter 11 dígitos." };
    const dup = getState().volunteers.find((v) => v.cpf === cpf && v.id !== data.id);
    if (dup) return { ok: false, error: "Já existe um voluntário com este CPF." };
    if (data.id) {
      repo._updateVolunteer(data.id, { name: data.name.trim(), cpf, phone: data.phone, email: data.email, photoUrl: data.photoUrl });
    } else {
      const v: Volunteer = {
        id: uid("v"),
        name: data.name.trim(),
        cpf,
        phone: data.phone,
        email: data.email,
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

  addNeed(periodId: string, n: Omit<Need, "id">) {
    setState((st) => ({
      ...st,
      periods: st.periods.map((p) => (p.id === periodId ? { ...p, needs: [...p.needs, { ...n, id: uid("n") }] } : p)),
    }));
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

  // ---------- Configurações ----------
  updateSettings(patch: Partial<Settings>) {
    setState((st) => ({ ...st, settings: { ...st.settings, ...patch } }));
  },

  resetDemoData() {
    resetStore();
  },
};

export type DataRepository = typeof repo;
