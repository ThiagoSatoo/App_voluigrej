import { today } from "@/lib/format";
import type { AppState, Need, Period, Volunteer } from "./types";

export const sortNeeds = (needs: Need[]) =>
  [...needs].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));

export const sortPeriods = (ps: Period[]) => [...ps].sort((a, b) => b.year - a.year || b.month - a.month);

export const findVolunteer = (s: AppState, id: string) => s.volunteers.find((v) => v.id === id);

export const activeVolunteers = (s: AppState) => s.volunteers.filter((v) => v.status === "ativo");

/** The period volunteers currently answer availability for. */
export function availabilityPeriod(s: AppState): Period | undefined {
  const open = s.periods.find((p) => p.status === "aberta");
  if (open) return open;
  return sortPeriods(s.periods).find((p) => ["encerrada", "sorteado", "publicada"].includes(p.status) && !publishedDraw(s, p.id));
}

export const drawsOf = (s: AppState, periodId: string) =>
  s.draws.filter((d) => d.periodId === periodId).sort((a, b) => b.number - a.number);

export const publishedDraw = (s: AppState, periodId: string) =>
  s.draws.find((d) => d.periodId === periodId && d.status === "publicado");

export const latestDraw = (s: AppState, periodId: string) => drawsOf(s, periodId)[0];

export const availabilityOf = (s: AppState, periodId: string, volunteerId: string, needId: string) =>
  s.availabilities.find((a) => a.periodId === periodId && a.volunteerId === volunteerId && a.needId === needId)?.value;

export const hasResponded = (s: AppState, periodId: string, volunteerId: string) =>
  s.availabilities.some((a) => a.periodId === periodId && a.volunteerId === volunteerId);

export interface Assignment {
  period: Period;
  need: Need;
  colleagues: string[];
}

/** Published assignments for a given volunteer, sorted by date. */
export function assignmentsOf(s: AppState, volunteerId: string): Assignment[] {
  const out: Assignment[] = [];
  s.draws
    .filter((d) => d.status === "publicado")
    .forEach((d) => {
      const period = s.periods.find((p) => p.id === d.periodId);
      if (!period) return;
      d.slots.forEach((slot) => {
        if (!slot.picks.some((p) => p.volunteerId === volunteerId)) return;
        const n = period.needs.find((x) => x.id === slot.needId);
        if (n) out.push({ period, need: n, colleagues: slot.picks.map((p) => p.volunteerId) });
      });
    });
  return out.sort((a, b) => a.need.date.localeCompare(b.need.date));
}

export const nextAssignment = (s: AppState, volunteerId: string) =>
  assignmentsOf(s, volunteerId).find((a) => a.need.date >= today());

/** Next scheduled need across all published scales. */
export function nextScheduledNeed(s: AppState) {
  const all = s.draws
    .filter((d) => d.status === "publicado")
    .flatMap((d) => {
      const period = s.periods.find((p) => p.id === d.periodId)!;
      return d.slots.map((slot) => ({ period, slot, need: period.needs.find((n) => n.id === slot.needId)! }));
    })
    .filter((x) => x.need && x.need.date >= today())
    .sort((a, b) => a.need.date.localeCompare(b.need.date));
  return all[0];
}

export const attendanceFor = (s: AppState, needId: string, volunteerId: string) =>
  s.attendance.filter((a) => a.needId === needId && a.volunteerId === volunteerId).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];

/** Priority rule: fewer recent (3m), then fewer in 12m. */
export const byPriority = (a: Volunteer, b: Volunteer) => a.recent3m - b.recent3m || a.last12m - b.last12m;

// ---------- Necessidades avulsas e candidaturas ----------
import type { Opportunity } from "./types";
import type { Tone } from "@/lib/format";

export const sortOpportunities = (os: Opportunity[]) =>
  [...os].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));

export const activeApplicants = (s: AppState, opportunityId: string) =>
  s.applications.filter((a) => a.opportunityId === opportunityId && (a.status === "candidatado" || a.status === "selecionado"));

export const myApplication = (s: AppState, opportunityId: string, volunteerId: string) =>
  s.applications.find((a) => a.opportunityId === opportunityId && a.volunteerId === volunteerId);

export const availableDays = (s: AppState, volunteerId: string) =>
  new Set(s.dayAvailability.filter((d) => d.volunteerId === volunteerId).map((d) => d.date));

/** Red = below min, green = min reached, blue = max reached. */
export function fillState(count: number, o: Pick<Opportunity, "min" | "max">): { tone: Tone; label: string } {
  if (count >= o.max) return { tone: "info", label: "Máximo atingido" };
  if (count >= o.min) return { tone: "success", label: "Mínimo atingido" };
  return { tone: "destructive", label: "Abaixo do mínimo" };
}

/** Quantidade de candidaturas ativas (o servidor informa a contagem mesmo quando o usuário não vê os nomes). */
export const activeCount = (s: AppState, opportunityId: string) => s.oppCounts[opportunityId] ?? activeApplicants(s, opportunityId).length;

/** Pessoas que podem ser responsáveis por um turno ou vaga. */
export const responsavelOptions = (s: AppState) => [
  ...s.supervisors.filter((x) => x.status === "ativo").map((x) => ({ id: x.id, name: x.name, kind: x.role === "admin" ? "Administrador" : "Supervisor" })),
  ...s.volunteers.filter((v) => v.status === "ativo" && v.role === "responsavel").map((v) => ({ id: v.id, name: v.name, kind: "Responsável" })),
];

export const personName = (s: AppState, id?: string) =>
  id ? (s.volunteers.find((v) => v.id === id)?.name ?? s.supervisors.find((x) => x.id === id)?.name) : undefined;

// ---------- Visão de agenda (escala mensal + vagas confirmadas) ----------
import type { VisibilityPolicy } from "./types";

export interface ScheduleItem {
  key: string;
  kind: "escala" | "vaga";
  date: string;
  start: string;
  end: string;
  note?: string;
  slots: number;
  /** Pessoas que o usuário logado pode ver neste turno (o banco já filtrou pela política). */
  people: string[];
  responsavelId?: string;
}

/** Todos os turnos publicados e vagas confirmadas que o usuário consegue ver. */
export function scheduleItems(s: AppState): ScheduleItem[] {
  const out: ScheduleItem[] = [];
  s.draws
    .filter((d) => d.status === "publicado")
    .forEach((d) => {
      const period = s.periods.find((p) => p.id === d.periodId);
      d.slots.forEach((slot) => {
        const n = period?.needs.find((x) => x.id === slot.needId);
        if (!n) return;
        const out_ = s.attendance.filter((a) => a.needId === n.id && (a.status === "cancelado" || a.status === "substituido")).map((a) => a.volunteerId);
        out.push({
          key: `n:${n.id}`,
          kind: "escala",
          date: n.date,
          start: n.start,
          end: n.end,
          slots: n.slots,
          people: slot.picks.map((p) => p.volunteerId).filter((id) => !out_.includes(id)),
          responsavelId: n.responsavelId,
        });
      });
    });
  s.opportunities
    .filter((o) => o.status === "confirmada")
    .forEach((o) =>
      out.push({
        key: `o:${o.id}`,
        kind: "vaga",
        date: o.date,
        start: o.start,
        end: o.end,
        note: o.note,
        slots: o.max,
        people: s.applications.filter((a) => a.opportunityId === o.id && a.status === "selecionado").map((a) => a.volunteerId),
        responsavelId: o.responsavelId,
      }),
    );
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

export const myScheduleItems = (s: AppState, userId: string) => scheduleItems(s).filter((i) => i.people.includes(userId));

export const VISIBILITY_OPTIONS: { value: VisibilityPolicy; title: string; text: string }[] = [
  {
    value: "privado",
    title: "Privado",
    text: "Cada voluntário vê apenas a própria escala. Ninguém vê quem mais está escalado.",
  },
  {
    value: "mesmo_turno",
    title: "Mesmo turno",
    text: "O voluntário vê quem está no mesmo turno ou vaga que ele, mas não consegue abrir a agenda de outra pessoa.",
  },
  {
    value: "escala_geral",
    title: "Escala geral",
    text: "O voluntário vê a escala de todos os turnos, com os nomes, mas o app nunca mostra a agenda individual de outra pessoa.",
  },
];

// ---------- Agenda da coordenação ----------
export interface AgendaItem {
  key: string;
  kind: "escala" | "vaga";
  date: string;
  start: string;
  end: string;
  note?: string;
  /** Vagas do turno (na vaga avulsa: o máximo). */
  slots: number;
  min?: number;
  /** Situação: rascunho/aberta/... do período ou aberta/confirmada da vaga. */
  status: string;
  /** Quem ocupa a vaga: escalados publicados, ou selecionados/candidatos ativos na vaga avulsa. */
  filled: string[];
  /** Quem se candidatou: disponíveis para o turno, ou candidatos da vaga. */
  candidates: string[];
  responsavelId?: string;
}

/** Todos os horários criados, com ocupação e candidatos (visão completa da coordenação). */
export function agendaItems(s: AppState): AgendaItem[] {
  const out: AgendaItem[] = [];
  s.periods.forEach((p) => {
    const draw = publishedDraw(s, p.id);
    p.needs.forEach((n) => {
      const removed = s.attendance
        .filter((a) => a.needId === n.id && (a.status === "cancelado" || a.status === "substituido"))
        .map((a) => a.volunteerId);
      const picks = draw?.slots.find((sl) => sl.needId === n.id)?.picks.map((pk) => pk.volunteerId).filter((id) => !removed.includes(id)) ?? [];
      out.push({
        key: `n:${n.id}`,
        kind: "escala",
        date: n.date,
        start: n.start,
        end: n.end,
        slots: n.slots,
        status: p.status,
        filled: picks,
        candidates: s.availabilities.filter((a) => a.needId === n.id && a.value === "disponivel").map((a) => a.volunteerId),
        responsavelId: n.responsavelId,
      });
    });
  });
  s.opportunities.forEach((o) => {
    const apps = s.applications.filter((a) => a.opportunityId === o.id);
    const confirmed = o.status === "confirmada";
    out.push({
      key: `o:${o.id}`,
      kind: "vaga",
      date: o.date,
      start: o.start,
      end: o.end,
      note: o.note,
      slots: o.max,
      min: o.min,
      status: o.status,
      filled: apps.filter((a) => (confirmed ? a.status === "selecionado" : a.status === "candidatado")).map((a) => a.volunteerId),
      candidates: apps.filter((a) => a.status !== "cancelado").map((a) => a.volunteerId),
      responsavelId: o.responsavelId,
    });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}
