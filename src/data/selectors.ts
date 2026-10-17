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
