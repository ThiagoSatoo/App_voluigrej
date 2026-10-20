// Dados de teste parecidos com os reais (nomes longos, ~40 pessoas) para testar o layout.
import { randomUUID } from "node:crypto";

const NAMES = [
  "Maria Aparecida dos Santos Oliveira", "João Pedro Ferreira", "Ana Beatriz Lima", "Carlos Eduardo Nascimento Souza", "Fernanda Costa",
  "Rafael Almeida", "Juliana Ribeiro Martins", "Lucas Gabriel Rocha", "Patrícia Gomes", "Marcos Vinícius Carvalho Pereira",
  "Larissa Mendes", "Thiago Barbosa", "Camila Fernandes Araújo", "Bruno Henrique Dias", "Aline Cristina Teixeira",
  "Gustavo Moreira", "Beatriz Nunes", "Diego Cardoso", "Vanessa Lopes da Silva", "Rodrigo Pinto",
  "Letícia Correia", "Felipe Monteiro", "Gabriela Batista", "André Luiz Ramos", "Priscila Freitas",
  "Eduardo Castro", "Natália Vieira", "Leonardo Azevedo", "Tatiane Cunha", "Vinícius Duarte",
  "Isabela Moraes", "Matheus Campos", "Renata Farias", "Daniel Rezende", "Sabrina Cavalcanti",
];
const cpf = (i) => String(10000000000 + i * 7919).slice(0, 11);
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

export function makeFixtures(today = new Date()) {
  const admin = { id: randomUUID(), role: "admin", name: "Thiago Satoo", username: null, status: "ativo", must_change_password: false, photo_path: null, created_at: today.toISOString() };
  const sups = ["Marta Helena Souza", "Paulo Roberto Lima"].map((name) => ({ id: randomUUID(), role: "supervisor", name, username: null, status: "ativo", must_change_password: false, photo_path: null, created_at: today.toISOString() }));
  const vols = NAMES.map((name, i) => ({
    id: randomUUID(),
    role: i < 3 ? "responsavel" : "voluntario",
    name,
    username: null,
    status: i === 34 ? "inativo" : "ativo",
    must_change_password: i % 7 === 0 && i > 2,
    photo_path: null,
    created_at: today.toISOString(),
  }));
  const profiles = [admin, ...sups, ...vols];
  const volunteer_details = profiles.map((p, i) => ({
    id: p.id,
    cpf: cpf(i + 1),
    phone: `(11) 9${String(8000 + i).padStart(4, "0")}-${String(1000 + i * 37).slice(-4)}`,
    email: `pessoa${i}@exemplo.com`,
    birth_date: `19${70 + (i % 30)}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`,
    joined_at: "2024-01-10",
  }));

  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const period = { id: randomUUID(), month: m, year: y, open_date: iso(addDays(today, -20)), deadline: iso(addDays(today, -10)), status: "publicada" };
  const next = { id: randomUUID(), month: m === 12 ? 1 : m + 1, year: m === 12 ? y + 1 : y, open_date: iso(today), deadline: iso(addDays(today, 10)), status: "aberta" };
  const needs = [];
  for (let d = 1; d <= 28; d += 3) {
    const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    needs.push({ id: randomUUID(), period_id: period.id, date, start_time: "09:00", end_time: "11:30", slots: 4, responsavel_id: vols[d % 3].id });
    if (d % 2) needs.push({ id: randomUUID(), period_id: period.id, date, start_time: "18:30", end_time: "21:00", slots: 6, responsavel_id: null });
  }
  for (let d = 2; d <= 28; d += 7) {
    const nm = next.month;
    needs.push({ id: randomUUID(), period_id: next.id, date: `${next.year}-${String(nm).padStart(2, "0")}-${String(d).padStart(2, "0")}`, start_time: "09:00", end_time: "11:00", slots: 5, responsavel_id: null });
  }
  const availabilities = [];
  needs.forEach((n, ni) => vols.forEach((v, vi) => {
    if ((vi + ni) % 3 !== 0) availabilities.push({ period_id: n.period_id, volunteer_id: v.id, need_id: n.id, value: (vi + ni) % 5 === 0 ? "indisponivel" : "disponivel", updated_at: today.toISOString() });
  }));
  const draw = { id: randomUUID(), period_id: period.id, number: 1, created_at: today.toISOString(), created_by: "Marta Helena Souza", status: "publicado" };
  const draw_slots = [];
  const draw_picks = [];
  needs.filter((n) => n.period_id === period.id).forEach((n, ni) => {
    draw_slots.push({ draw_id: draw.id, need_id: n.id, eligible: 12 });
    const take = ni % 4 === 0 ? n.slots - 1 : n.slots; // alguns turnos incompletos
    for (let k = 0; k < take; k++) {
      const v = vols[(ni * 3 + k) % 33];
      draw_picks.push({ draw_id: draw.id, need_id: n.id, volunteer_id: v.id, priority: k + 1, recent3m: k % 3, last12m: k % 5, tiebreak: "Escalas recentes" });
    }
  });
  // O voluntário de teste (vols[3]) aparece em alguns turnos
  draw_picks.push({ draw_id: draw.id, need_id: needs[needs.length - 8].id, volunteer_id: vols[3].id, priority: 9, recent3m: 0, last12m: 1, tiebreak: "Aleatório" });

  const opportunities = [
    { id: randomUUID(), date: iso(addDays(today, 2)), start_time: "19:00", end_time: "22:00", min: 3, max: 8, note: "Conferência de jovens — recepção e estacionamento", status: "aberta", created_at: today.toISOString(), responsavel_id: vols[0].id },
    { id: randomUUID(), date: iso(addDays(today, 5)), start_time: "08:00", end_time: "12:00", min: 2, max: 4, note: "Mutirão de limpeza", status: "confirmada", created_at: today.toISOString(), responsavel_id: null },
    { id: randomUUID(), date: iso(addDays(today, 9)), start_time: "14:00", end_time: "17:00", min: 5, max: 10, note: null, status: "aberta", created_at: today.toISOString(), responsavel_id: sups[0].id },
  ];
  const applications = [];
  opportunities.forEach((o, oi) => vols.slice(oi * 4, oi * 4 + 7).forEach((v, k) =>
    applications.push({ id: randomUUID(), opportunity_id: o.id, volunteer_id: v.id, status: o.status === "confirmada" ? (k < 4 ? "selecionado" : "nao_selecionado") : k === 6 ? "cancelado" : "candidatado", updated_at: today.toISOString() }),
  ));
  applications.push({ id: randomUUID(), opportunity_id: opportunities[1].id, volunteer_id: vols[3].id, status: "selecionado", updated_at: today.toISOString() });
  const day_availability = vols.slice(0, 20).flatMap((v, i) => [0, 1, 2, 5, 9].filter((d) => (d + i) % 2 === 0).map((d) => ({ volunteer_id: v.id, date: iso(addDays(today, d)) })));
  const attendance = draw_picks.slice(0, 10).map((p, i) => ({ id: randomUUID(), period_id: period.id, need_id: p.need_id, volunteer_id: p.volunteer_id, status: i % 4 === 0 ? "faltou" : "presente", recorded_at: today.toISOString(), recorded_by: "Marta Helena Souza" }));
  const substitutions = [{ id: randomUUID(), period_id: period.id, need_id: draw_picks[2].need_id, out_id: vols[10].id, in_id: draw_picks[2].volunteer_id, at: today.toISOString(), recorded_by: "Marta Helena Souza", reason: "Viagem de trabalho" }];

  // Escalas fixas (horários semanais), participantes e um "não posso" do voluntário de teste.
  const fixed_schedules = [
    { id: randomUUID(), weekday: 0, start_time: "09:00", end_time: "11:30", slots: 4, responsavel_id: vols[0].id, note: "Culto da manhã", active: true, created_at: today.toISOString() },
    { id: randomUUID(), weekday: 0, start_time: "18:30", end_time: "21:00", slots: 6, responsavel_id: null, note: null, active: true, created_at: today.toISOString() },
    { id: randomUUID(), weekday: 3, start_time: "19:30", end_time: "21:30", slots: 3, responsavel_id: sups[0].id, note: "Culto de quarta — recepção e estacionamento", active: true, created_at: today.toISOString() },
    { id: randomUUID(), weekday: 6, start_time: "15:00", end_time: "17:00", slots: 2, responsavel_id: null, note: "Ensaio", active: false, created_at: today.toISOString() },
  ];
  const fixed_members = vols.slice(0, 24).flatMap((v, i) => fixed_schedules.slice(0, 3).filter((_, k) => (i + k) % 2 === 0 || i === 3).map((f) => ({ fixed_id: f.id, volunteer_id: v.id, created_at: today.toISOString() })));
  const nextSunday = iso(addDays(today, (7 - today.getDay()) % 7 || 7));
  const fixed_exceptions = [{ fixed_id: fixed_schedules[0].id, volunteer_id: vols[3].id, date: nextSunday, created_at: today.toISOString(), created_by: vols[3].name }];

  const notificationsFor = (uid) => [
    { id: randomUUID(), type: "candidatura_cancelada", recipient_id: uid, key: null, opportunity_id: opportunities[0].id, message: "Fernanda Costa cancelou a candidatura. A escala está abaixo do mínimo (2/3).", created_at: today.toISOString(), read: false },
    { id: randomUUID(), type: "aniversario_7d", recipient_id: uid, key: null, opportunity_id: null, message: "Daqui a 7 dias é aniversário de Maria Aparecida dos Santos Oliveira.", created_at: today.toISOString(), read: true },
  ];

  return {
    users: { admin, sup: sups[0], vol: vols[3], resp: vols[0] },
    tables: {
      profiles, volunteer_details, periods: [period, next], needs, availabilities, draws: [draw], draw_slots, draw_picks,
      attendance, substitutions, opportunities, applications, day_availability, notif_prefs: [],
      app_settings: [{ id: 1, church_name: "Igreja Comunidade da Graça — Unidade Centro", ministry_name: "", visibility_policy: "escala_geral" }],
      nav_config: [{ id: 1, config: {} }],
      fixed_schedules, fixed_members, fixed_exceptions,
    },
    notificationsFor,
  };
}
