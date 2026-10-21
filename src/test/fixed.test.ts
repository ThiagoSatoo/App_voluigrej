import { describe, expect, it } from "vitest";
import { emptyState } from "@/data/store";
import { agendaItems, backupsOf, fixedCandidates, fixedDayStatus, fixedLabel, nextDates, publishedSlotFor } from "@/data/selectors";
import type { AppState, Volunteer } from "@/data/types";

const vol = (id: string, status: Volunteer["status"] = "ativo"): Volunteer => ({
  id, name: id.toUpperCase(), cpf: "", phone: "", email: "", birthDate: "", status, role: "voluntario",
  recent3m: 0, last12m: 0, mustChangePassword: false, joinedAt: "",
});
const pick = (v: string, i: number) => ({ volunteerId: v, recent3m: 0, last12m: 0, priority: i + 1, tiebreak: "" });

// Domingo 09:00 (escala fixa f1) e domingo 18:00 (f2) no mesmo mês, cada uma com o próprio sorteio.
const base = (): AppState => ({
  ...emptyState(),
  volunteers: ["a", "b", "c", "d"].map((v) => vol(v)).concat(vol("x", "inativo")),
  fixedSchedules: [
    { id: "f1", weekday: 0, start: "09:00", end: "11:00", slots: 2, active: true },
    { id: "f2", weekday: 0, start: "18:00", end: "20:00", slots: 1, active: true },
  ],
  fixedMembers: ["a", "b", "c", "d", "x"].map((v) => ({ fixedId: "f1", volunteerId: v })),
  fixedExceptions: [{ fixedId: "f1", volunteerId: "d", date: "2099-03-01", createdBy: "" }],
  periods: [{
    id: "p", month: 3, year: 2099, openDate: "2099-03-01", deadline: "2099-03-01", status: "publicada",
    needs: [
      { id: "n1", date: "2099-03-01", start: "09:00", end: "11:00", slots: 2, fixedId: "f1" },
      { id: "n2", date: "2099-03-01", start: "18:00", end: "20:00", slots: 1, fixedId: "f2" },
    ],
  }],
  draws: [
    { id: "d1", periodId: "p", number: 1, createdAt: "", createdBy: "", status: "publicado", fixedId: "f1", slots: [{ needId: "n1", eligible: 3, picks: ["a", "c"].map(pick) }] },
    { id: "d2", periodId: "p", number: 2, createdAt: "", createdBy: "", status: "publicado", fixedId: "f2", slots: [{ needId: "n2", eligible: 1, picks: ["b"].map(pick) }] },
    { id: "d3", periodId: "p", number: 3, createdAt: "", createdBy: "", status: "rascunho", fixedId: "f1", slots: [{ needId: "n1", eligible: 3, picks: ["b"].map(pick) }] },
  ],
  // "a" saiu e foi substituído por "c"; depois tocou em "Disponível" => backup.
  attendance: [{ id: "t", periodId: "p", needId: "n1", volunteerId: "a", status: "substituido", recordedAt: "", supervisor: "" }],
  fixedReleased: [{ fixedId: "f1", volunteerId: "a", date: "2099-03-01", createdBy: "" }],
});

describe("Escalas fixas", () => {
  it("próximas datas caem sempre no dia da semana da escala", () => {
    expect(nextDates({ weekday: 0 }, "2026-10-20", 3)).toEqual(["2026-10-25", "2026-11-01", "2026-11-08"]);
    expect(nextDates({ weekday: 2 }, "2026-10-20", 2)).toEqual(["2026-10-20", "2026-10-27"]); // hoje conta
    expect(fixedLabel({ weekday: 3, start: "19:30", end: "21:30" })).toBe("Quarta 19:30–21:30");
  });

  it("cada turno usa o sorteio publicado da própria escala fixa (vários no mesmo mês) e ignora rascunhos", () => {
    const s = base();
    expect(publishedSlotFor(s, "n1")?.draw.id).toBe("d1");
    expect(publishedSlotFor(s, "n2")?.draw.id).toBe("d2");
    const items = agendaItems(s);
    expect(items.find((i) => i.needId === "n1")?.filled).toEqual(["c"]); // "a" saiu
    expect(items.find((i) => i.needId === "n2")?.filled).toEqual(["b"]);
  });

  it("candidatos: participantes ativos, sem quem avisou que não pode", () => {
    expect(fixedCandidates(base(), "f1", "2099-03-01")).toEqual(["a", "b", "c"]);
    expect(fixedCandidates(base(), "f1", "2099-03-08")).toEqual(["a", "b", "c", "d"]);
  });

  it("backup: saiu do turno e desfez o aviso; deixa de ser backup se avisar de novo", () => {
    const s = base();
    expect(backupsOf(s, "n1")).toEqual(["a"]);
    expect(backupsOf(s, "n2")).toEqual([]);
    s.fixedExceptions.push({ fixedId: "f1", volunteerId: "a", date: "2099-03-01", createdBy: "" });
    expect(backupsOf(s, "n1")).toEqual([]);
  });

  it("quem só desfez o aviso sem ter saído do turno não é backup", () => {
    const s = base();
    s.attendance = [];
    expect(backupsOf(s, "n1")).toEqual([]);
  });

  it("situação do dia para os botões Disponível/Indisponível", () => {
    const s = base();
    expect(fixedDayStatus(s, "f1", "c", "2099-03-01")).toMatchObject({ picked: true, off: false, backup: false, published: true });
    expect(fixedDayStatus(s, "f1", "a", "2099-03-01")).toMatchObject({ picked: false, off: false, backup: true });
    expect(fixedDayStatus(s, "f1", "d", "2099-03-01")).toMatchObject({ picked: false, off: true });
    expect(fixedDayStatus(s, "f1", "b", "2099-03-08")).toMatchObject({ published: false, closed: false });
  });
});
