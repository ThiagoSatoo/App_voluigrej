import type { AppState, Application, DayAvailability, Opportunity, Attendance, Availability, Draw, Need, Period, Volunteer } from "./types";

type Seed = [id: string, name: string, cpf: string, photo: number | null, r3: number, r12: number, active?: boolean];

const people: Seed[] = [
  ["v1", "João Silva", "11111111111", 12, 2, 7],
  ["v2", "Maria Souza", "22222222222", 47, 2, 8],
  ["v3", "Carlos Oliveira", "33333333333", null, 3, 9],
  ["v4", "Ana Santos", "44444444444", 5, 3, 10],
  ["v5", "Pedro Almeida", "55555555555", 13, 2, 6],
  ["v6", "Juliana Costa", "66666666666", null, 2, 9],
  ["v7", "Lucas Pereira", "77777777777", 14, 1, 5],
  ["v8", "Beatriz Rocha", "88888888888", 9, 1, 4],
  ["v9", "Rafael Lima", "99999999999", null, 1, 6],
  ["v10", "Camila Ferreira", "12312312312", 16, 2, 7],
  ["v11", "Gabriel Martins", "23423423423", 15, 1, 3],
  ["v12", "Larissa Ribeiro", "34534534534", null, 0, 2],
  ["v13", "Thiago Carvalho", "45645645645", 33, 0, 4, false],
  ["v14", "Fernanda Gomes", "56756756756", 44, 0, 5, false],
  ["v15", "Daniel Barbosa", "67867867867", 51, 1, 5],
  ["v16", "Patrícia Mendes", "78978978978", null, 0, 3],
];

const need = (id: string, date: string, shift: Need["shift"], slots: number): Need => ({ id, date, shift, slots });

function seedDraw(
  id: string,
  periodId: string,
  number: number,
  createdAt: string,
  status: Draw["status"],
  needs: Need[],
  order: string[],
  vols: Volunteer[],
): Draw {
  let idx = 0;
  return {
    id,
    periodId,
    number,
    createdAt,
    createdBy: "Supervisor",
    status,
    slots: needs.map((n) => ({
      needId: n.id,
      eligible: n.slots + 4,
      picks: Array.from({ length: n.slots }, (_, k) => {
        const vid = order[idx++ % order.length];
        const v = vols.find((x) => x.id === vid)!;
        return {
          volunteerId: vid,
          recent3m: v.recent3m,
          last12m: v.last12m,
          priority: k + 1,
          tiebreak: k % 3 === 2 ? "Últimos 12 meses" : "Escalas recentes",
        };
      }),
    })),
  };
}

export function createSeed(): AppState {
  const volunteers: Volunteer[] = people.map(([id, name, cpf, photo, r3, r12, active = true], i) => ({
    id,
    name,
    cpf,
    phone: `(11) 9${String(8000 + i * 137).padStart(4, "0")}-${String(1000 + i * 241).slice(0, 4)}`,
    email: `${name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}@exemplo.com`,
    photoUrl: photo ? `https://i.pravatar.cc/240?img=${photo}` : undefined,
    status: active ? "ativo" : "inativo",
    recent3m: r3,
    last12m: r12,
    lastScaleDate: r3 > 0 ? (i % 2 ? "2026-10-03" : "2026-09-26") : undefined,
    password: "123456",
    mustChangePassword: id === "v2",
    joinedAt: `202${4 + (i % 2)}-0${(i % 9) + 1}-10`,
  }));

  const sepNeeds = [
    need("n-09-05", "2026-09-05", "Manhã", 4),
    need("n-09-12", "2026-09-12", "Manhã", 5),
    need("n-09-19", "2026-09-19", "Tarde", 3),
    need("n-09-26", "2026-09-26", "Manhã", 4),
  ];
  const octNeeds = [
    need("n-10-03", "2026-10-03", "Manhã", 4),
    need("n-10-10", "2026-10-10", "Manhã", 5),
    need("n-10-17", "2026-10-17", "Tarde", 3),
    need("n-10-24", "2026-10-24", "Manhã", 5),
    need("n-10-31", "2026-10-31", "Manhã", 4),
  ];
  const novNeeds = [
    need("n-11-07", "2026-11-07", "Manhã", 4),
    need("n-11-14", "2026-11-14", "Manhã", 6),
    need("n-11-21", "2026-11-21", "Tarde", 5),
    need("n-11-28", "2026-11-28", "Manhã", 5),
  ];

  const periods: Period[] = [
    { id: "p-2026-09", month: 9, year: 2026, openDate: "2026-08-15", deadline: "2026-08-25", status: "encerrado", needs: sepNeeds },
    { id: "p-2026-10", month: 10, year: 2026, openDate: "2026-09-10", deadline: "2026-09-25", status: "publicada", needs: octNeeds },
    { id: "p-2026-11", month: 11, year: 2026, openDate: "2026-10-01", deadline: "2026-10-25", status: "aberta", needs: novNeeds },
  ];

  const sepOrder = ["v7", "v8", "v9", "v10", "v11", "v1", "v2", "v3", "v4", "v5", "v6", "v12", "v15", "v16"];
  const octOrder = ["v3", "v4", "v5", "v6", "v1", "v2", "v7", "v8", "v9", "v10", "v11", "v12", "v15", "v16"];
  const altOrder = ["v4", "v3", "v6", "v5", "v2", "v1", "v8", "v7", "v10", "v9", "v12", "v11", "v16", "v15"];

  const draws: Draw[] = [
    seedDraw("d-09-1", "p-2026-09", 1, "2026-08-27T14:10:00", "publicado", sepNeeds, sepOrder, volunteers),
    seedDraw("d-10-1", "p-2026-10", 1, "2026-09-27T19:20:00", "substituido", octNeeds, altOrder, volunteers),
    seedDraw("d-10-2", "p-2026-10", 2, "2026-09-28T20:05:00", "publicado", octNeeds, octOrder, volunteers),
  ];

  // Substituição registrada em setembro: v3 saiu, v13 entrou (antes de ser desativado)
  const sepSlot = draws[0].slots.find((s) => s.needId === "n-09-12")!;
  const subIdx = sepSlot.picks.findIndex((p) => p.volunteerId === "v3");
  if (subIdx >= 0) sepSlot.picks[subIdx] = { ...sepSlot.picks[subIdx], volunteerId: "v13" };

  const attendance: Attendance[] = [];
  let aid = 0;
  const record = (periodId: string, needId: string, volunteerId: string, status: Attendance["status"], recordedAt: string) =>
    attendance.push({ id: `a${++aid}`, periodId, needId, volunteerId, status, recordedAt, supervisor: "Supervisor" });

  draws[0].slots.forEach((s) => {
    const n = sepNeeds.find((x) => x.id === s.needId)!;
    s.picks.forEach((p, i) => {
      const status = (s.needId === "n-09-19" && i === 1) || (s.needId === "n-09-26" && i === 3) ? "faltou" : "presente";
      record("p-2026-09", s.needId, p.volunteerId, status, `${n.date}T12:30:00`);
    });
  });
  record("p-2026-09", "n-09-12", "v3", "substituido", "2026-09-11T18:00:00");
  draws[2].slots[0].picks.forEach((p) => record("p-2026-10", "n-10-03", p.volunteerId, "presente", "2026-10-03T12:15:00"));

  const substitutions = [
    {
      id: "s1",
      periodId: "p-2026-09",
      needId: "n-09-12",
      outId: "v3",
      inId: "v13",
      at: "2026-09-11T18:00:00",
      supervisor: "Supervisor",
      reason: "Viagem a trabalho",
    },
  ];

  // Disponibilidades de novembro (v1, v11 e v12 ainda não responderam)
  const availabilities: Availability[] = [];
  const pending = new Set(["v1", "v11", "v12"]);
  const scarce = new Set(["v3", "v8", "v15"]);
  volunteers
    .filter((v) => v.status === "ativo" && !pending.has(v.id))
    .forEach((v, vi) => {
      novNeeds.forEach((n, ni) => {
        const value =
          n.id === "n-11-21" ? (scarce.has(v.id) ? "disponivel" : "indisponivel") : (vi + ni * 2) % 4 === 0 ? "indisponivel" : "disponivel";
        availabilities.push({ periodId: "p-2026-11", volunteerId: v.id, needId: n.id, value, updatedAt: "2026-10-03T10:00:00" });
      });
    });

  // Necessidades avulsas (fluxo de candidatura)
  const opportunities: Opportunity[] = [
    { id: "o1", date: "2026-10-14", start: "19:00", end: "21:00", min: 2, max: 4, note: "Culto de quarta", status: "aberta", createdAt: "2026-10-01T10:00:00" },
    { id: "o2", date: "2026-10-18", start: "09:00", end: "12:00", min: 3, max: 5, note: "Culto de domingo", status: "aberta", createdAt: "2026-10-01T10:00:00" },
    { id: "o3", date: "2026-10-21", start: "19:30", end: "21:30", min: 2, max: 3, note: "Ensaio geral", status: "aberta", createdAt: "2026-10-01T10:00:00" },
    { id: "o4", date: "2026-10-25", start: "18:00", end: "21:00", min: 4, max: 6, note: "Conferência de jovens", status: "aberta", createdAt: "2026-10-01T10:00:00" },
  ];
  const dayAvailability: DayAvailability[] = [];
  const apps: Application[] = [];
  const avail = (vid: string, dates: string[]) => dates.forEach((date) => dayAvailability.push({ volunteerId: vid, date }));
  const apply = (oid: string, vids: string[]) =>
    vids.forEach((vid) => apps.push({ id: `ap-${oid}-${vid}`, opportunityId: oid, volunteerId: vid, status: "candidatado", updatedAt: "2026-10-04T09:00:00" }));
  avail("v1", ["2026-10-14", "2026-10-18", "2026-10-21", "2026-10-25"]);
  ["v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10", "v15", "v16"].forEach((v) => avail(v, ["2026-10-14", "2026-10-18", "2026-10-21", "2026-10-25"]));
  apply("o1", ["v4"]);
  apply("o2", ["v2", "v3", "v5", "v7", "v8", "v16"]);
  apply("o3", ["v6", "v9", "v10"]);
  apply("o4", ["v2", "v3", "v15", "v16"]);

  return {
    opportunities,
    dayAvailability,
    applications: apps,
    notifications: [],
    volunteers,
    periods,
    availabilities,
    draws,
    attendance,
    substitutions,
    session: null,
    settings: {
      churchName: "Igreja Comunidade da Graça",
      ministryName: "Ministério de Recepção",
      supervisorName: "Supervisor",
      supervisorPassword: "123456",
    },
  };
}
