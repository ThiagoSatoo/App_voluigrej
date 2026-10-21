import { today } from "@/lib/format";
import type { AppState, Need, Period, Volunteer } from "./types";

export const sortNeeds = (needs: Need[]) =>
  [...needs].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));

export const sortPeriods = (ps: Period[]) =>
  [...ps].sort((a, b) => b.year - a.year || b.month - a.month);

export const activeVolunteers = (s: AppState) => s.volunteers.filter((v) => v.status === "ativo");

export const drawsOf = (s: AppState, periodId: string) =>
  s.draws.filter((d) => d.periodId === periodId).sort((a, b) => b.number - a.number);

/** Sorteio publicado que vale para um turno. Um mês pode ter vários (um por escala fixa). */
export function publishedSlotFor(s: AppState, needId: string) {
  for (const d of s.draws) {
    if (d.status !== "publicado") continue;
    const slot = d.slots.find((sl) => sl.needId === needId);
    if (slot) return { draw: d, slot };
  }
  return undefined;
}

export const availabilityOf = (
  s: AppState,
  periodId: string,
  volunteerId: string,
  needId: string,
) =>
  s.availabilities.find(
    (a) => a.periodId === periodId && a.volunteerId === volunteerId && a.needId === needId,
  )?.value;

/** Next scheduled need across all published scales. */
export function nextScheduledNeed(s: AppState) {
  const all = s.draws
    .filter((d) => d.status === "publicado")
    .flatMap((d) => {
      const period = s.periods.find((p) => p.id === d.periodId)!;
      return d.slots.map((slot) => ({
        period,
        slot,
        need: period.needs.find((n) => n.id === slot.needId)!,
      }));
    })
    .filter((x) => x.need && x.need.date >= today())
    .sort((a, b) => a.need.date.localeCompare(b.need.date));
  return all[0];
}

export const attendanceFor = (s: AppState, needId: string, volunteerId: string) =>
  s.attendance
    .filter((a) => a.needId === needId && a.volunteerId === volunteerId)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];

/** Priority rule: fewer recent (3m), then fewer in 12m. */
export const byPriority = (a: Volunteer, b: Volunteer) =>
  a.recent3m - b.recent3m || a.last12m - b.last12m;

// ---------- Necessidades avulsas e candidaturas ----------
import type { Opportunity } from "./types";
import type { Tone } from "@/lib/format";

export const sortOpportunities = (os: Opportunity[]) =>
  [...os].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));

export const activeApplicants = (s: AppState, opportunityId: string) =>
  s.applications.filter(
    (a) =>
      a.opportunityId === opportunityId &&
      (a.status === "candidatado" || a.status === "selecionado"),
  );

export const myApplication = (s: AppState, opportunityId: string, volunteerId: string) =>
  s.applications.find((a) => a.opportunityId === opportunityId && a.volunteerId === volunteerId);

export const availableDays = (s: AppState, volunteerId: string) =>
  new Set(s.dayAvailability.filter((d) => d.volunteerId === volunteerId).map((d) => d.date));

/** Red = below min, green = min reached, blue = max reached. */
export function fillState(
  count: number,
  o: Pick<Opportunity, "min" | "max">,
): { tone: Tone; label: string } {
  if (count >= o.max) return { tone: "info", label: "Máximo atingido" };
  if (count >= o.min) return { tone: "success", label: "Mínimo atingido" };
  return { tone: "destructive", label: "Abaixo do mínimo" };
}

/** Quantidade de candidaturas ativas (o servidor informa a contagem mesmo quando o usuário não vê os nomes). */
export const activeCount = (s: AppState, opportunityId: string) =>
  s.oppCounts[opportunityId] ?? activeApplicants(s, opportunityId).length;

/** Pessoas que podem ser responsáveis por um turno ou vaga. */
export const responsavelOptions = (s: AppState) => [
  ...s.supervisors
    .filter((x) => x.status === "ativo")
    .map((x) => ({
      id: x.id,
      name: x.name,
      kind: x.role === "admin" ? "Administrador" : "Coordenador",
    })),
  ...s.volunteers
    .filter((v) => v.status === "ativo" && v.role === "responsavel")
    .map((v) => ({ id: v.id, name: v.name, kind: "Responsável" })),
];

export const personName = (s: AppState, id?: string) =>
  id
    ? (s.volunteers.find((v) => v.id === id)?.name ?? s.supervisors.find((x) => x.id === id)?.name)
    : undefined;

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
  /** Turno de escala fixa: data e escala para os botões Disponível/Indisponível. */
  fixedId?: string;
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
        const out_ = s.attendance
          .filter(
            (a) => a.needId === n.id && (a.status === "cancelado" || a.status === "substituido"),
          )
          .map((a) => a.volunteerId);
        out.push({
          key: `n:${n.id}`,
          kind: "escala",
          date: n.date,
          start: n.start,
          end: n.end,
          slots: n.slots,
          people: slot.picks.map((p) => p.volunteerId).filter((id) => !out_.includes(id)),
          responsavelId: n.responsavelId,
          fixedId: n.fixedId,
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
        people: s.applications
          .filter((a) => a.opportunityId === o.id && a.status === "selecionado")
          .map((a) => a.volunteerId),
        responsavelId: o.responsavelId,
      }),
    );
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

export const myScheduleItems = (s: AppState, userId: string) =>
  scheduleItems(s).filter((i) => i.people.includes(userId));

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
  /** Turno da escala mensal: período e se a escala já foi publicada (permite marcar presença). */
  periodId?: string;
  needId?: string;
  fixedId?: string;
  published?: boolean;
}

/** Todos os horários criados, com ocupação e candidatos (visão completa da coordenação). */
export function agendaItems(s: AppState): AgendaItem[] {
  const out: AgendaItem[] = [];
  s.periods.forEach((p) => {
    p.needs.forEach((n) => {
      const removed = s.attendance
        .filter(
          (a) => a.needId === n.id && (a.status === "cancelado" || a.status === "substituido"),
        )
        .map((a) => a.volunteerId);
      const pub = publishedSlotFor(s, n.id);
      const picks =
        pub?.slot.picks.map((pk) => pk.volunteerId).filter((id) => !removed.includes(id)) ?? [];
      out.push({
        key: `n:${n.id}`,
        kind: "escala",
        date: n.date,
        start: n.start,
        end: n.end,
        slots: n.slots,
        status: p.status,
        filled: picks,
        candidates: n.fixedId
          ? fixedCandidates(s, n.fixedId, n.date)
          : s.availabilities
              .filter((a) => a.needId === n.id && a.value === "disponivel")
              .map((a) => a.volunteerId),
        responsavelId: n.responsavelId,
        periodId: p.id,
        needId: n.id,
        fixedId: n.fixedId,
        published: !!pub,
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
      filled: apps
        .filter((a) => (confirmed ? a.status === "selecionado" : a.status === "candidatado"))
        .map((a) => a.volunteerId),
      candidates: apps.filter((a) => a.status !== "cancelado").map((a) => a.volunteerId),
      responsavelId: o.responsavelId,
    });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

// ---------- Equipe (todos juntos) ----------
export type TeamRole = "voluntario" | "responsavel" | "supervisor";

export interface TeamMember {
  id: string;
  name: string;
  role: "admin" | TeamRole;
  cpf: string;
  phone: string;
  email: string;
  birthDate: string;
  status: "ativo" | "inativo";
  photoUrl?: string;
  mustChangePassword: boolean;
  recent3m?: number;
  last12m?: number;
  username?: string;
}

export const ROLE_LABEL: Record<TeamMember["role"], string> = {
  admin: "Administrador",
  supervisor: "Coordenador",
  responsavel: "Responsável",
  voluntario: "Voluntário",
};

export const ROLE_ORDER: Record<TeamMember["role"], number> = {
  admin: 0,
  supervisor: 1,
  responsavel: 2,
  voluntario: 3,
};

/** Admin, supervisores, responsáveis e voluntários numa lista só. */
export function teamMembers(s: AppState): TeamMember[] {
  return [
    ...s.supervisors.map((x) => ({
      id: x.id,
      name: x.name,
      role: x.role,
      cpf: x.cpf,
      phone: x.phone,
      email: x.email,
      birthDate: x.birthDate,
      status: x.status,
      photoUrl: x.photoUrl,
      mustChangePassword: x.mustChangePassword,
      username: x.username,
    })),
    ...s.volunteers.map((v) => ({
      id: v.id,
      name: v.name,
      role: v.role,
      cpf: v.cpf,
      phone: v.phone,
      email: v.email,
      birthDate: v.birthDate,
      status: v.status,
      photoUrl: v.photoUrl,
      mustChangePassword: v.mustChangePassword,
      recent3m: v.recent3m,
      last12m: v.last12m,
    })),
  ];
}

/** Quem o usuário logado pode gerenciar (o servidor aplica a mesma regra). */
export function canManageMember(s: AppState, m: TeamMember) {
  const me = s.session;
  if (!me) return false;
  if (m.role === "admin") return false;
  if (m.role === "supervisor") return me.role === "admin";
  return me.role === "admin" || me.role === "supervisor";
}

// ---------- Escalas fixas ----------
import type { FixedSchedule } from "./types";
import { addDays, format } from "date-fns";
import { toDate } from "@/lib/format";

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const sortFixed = (fs: FixedSchedule[]) =>
  [...fs].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));

export const fixedLabel = (f: Pick<FixedSchedule, "weekday" | "start" | "end">) =>
  `${WEEKDAYS[f.weekday]} ${f.start}–${f.end}`;

export const fixedMembersOf = (s: AppState, fixedId: string) =>
  s.fixedMembers.filter((m) => m.fixedId === fixedId).map((m) => m.volunteerId);

export const isFixedMember = (s: AppState, fixedId: string, volunteerId: string) =>
  s.fixedMembers.some((m) => m.fixedId === fixedId && m.volunteerId === volunteerId);

export const isUnavailable = (s: AppState, fixedId: string, volunteerId: string, date: string) =>
  s.fixedExceptions.some(
    (e) => e.fixedId === fixedId && e.volunteerId === volunteerId && e.date === date,
  );

/** Participantes ativos da escala fixa que não avisaram indisponibilidade nesta data. */
export const fixedCandidates = (s: AppState, fixedId: string, date: string) =>
  fixedMembersOf(s, fixedId).filter(
    (id) =>
      s.volunteers.some((v) => v.id === id && v.status === "ativo") &&
      !isUnavailable(s, fixedId, id, date),
  );

/** Próximas datas da escala fixa a partir de "from" (inclusive). */
export function nextDates(
  f: Pick<FixedSchedule, "weekday">,
  from: string,
  count: number,
): string[] {
  const start = toDate(from);
  const first = addDays(start, (f.weekday - start.getDay() + 7) % 7);
  return Array.from({ length: count }, (_, i) => format(addDays(first, i * 7), "yyyy-MM-dd"));
}

/** Turno gerado pela escala fixa nesta data (se já houve sorteio do mês). */
export const fixedNeed = (s: AppState, fixedId: string, date: string) =>
  s.periods
    .flatMap((p) => p.needs.map((n) => ({ p, n })))
    .find((x) => x.n.fixedId === fixedId && x.n.date === date);

/** Sorteios de uma escala fixa num mês, do mais novo para o mais antigo. */
export function fixedDraws(s: AppState, fixedId: string, year: number, month: number) {
  const period = s.periods.find((p) => p.year === year && p.month === month);
  if (!period) return { period, draws: [] as AppState["draws"] };
  return {
    period,
    draws: s.draws
      .filter((d) => d.periodId === period.id && d.fixedId === fixedId)
      .sort((a, b) => b.number - a.number),
  };
}

/**
 * Backup de um turno de escala fixa: saiu do turno ("Indisponível") e depois tocou em "Disponível"
 * sem voltar (o lugar foi ocupado). A coordenação pode trocá-lo por alguém escalado.
 */
export function backupsOf(s: AppState, needId: string): string[] {
  const n = s.periods.flatMap((p) => p.needs).find((x) => x.id === needId);
  if (!n?.fixedId) return [];
  return s.attendance
    .filter((a) => a.needId === needId && (a.status === "cancelado" || a.status === "substituido"))
    .map((a) => a.volunteerId)
    .filter(
      (id) =>
        s.fixedReleased.some(
          (e) => e.fixedId === n.fixedId && e.volunteerId === id && e.date === n.date,
        ) && !isUnavailable(s, n.fixedId!, id, n.date),
    );
}

/** Situação de uma pessoa numa data de uma escala fixa (para os botões Disponível/Indisponível). */
export function fixedDayStatus(s: AppState, fixedId: string, volunteerId: string, date: string) {
  const need = fixedNeed(s, fixedId, date)?.n;
  const slot = need ? publishedSlotFor(s, need.id)?.slot : undefined;
  const removed =
    !!need &&
    s.attendance.some(
      (a) =>
        a.needId === need.id &&
        a.volunteerId === volunteerId &&
        (a.status === "cancelado" || a.status === "substituido"),
    );
  return {
    need,
    /** Já houve sorteio publicado para esta data. */
    published: !!slot,
    /** Está escalado (publicado) e não saiu. */
    picked: !!slot?.picks.some((p) => p.volunteerId === volunteerId) && !removed,
    off: isUnavailable(s, fixedId, volunteerId, date),
    backup: !!need && backupsOf(s, need.id).includes(volunteerId),
    /** O turno já começou ou passou: não dá mais para mudar. */
    closed: !!need && `${need.date}T${need.start}` <= nowLocal(),
  };
}

/** Data e hora de agora em São Paulo, no formato "YYYY-MM-DDTHH:mm". */
function nowLocal() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  return parts.replace(" ", "T");
}
