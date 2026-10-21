import { describe, expect, it } from "vitest";
import { emptyState } from "@/data/store";
import { agendaItems, myScheduleItems } from "@/data/selectors";
import type { AppState } from "@/data/types";

const base = (): AppState => ({
  ...emptyState(),
  periods: [
    {
      id: "p",
      month: 3,
      year: 2099,
      openDate: "2099-02-01",
      deadline: "2099-02-20",
      status: "publicada",
      needs: [{ id: "n", date: "2099-03-01", start: "09:00", end: "10:00", slots: 3 }],
    },
  ],
  availabilities: ["a", "b", "c", "d"].map((v) => ({
    periodId: "p",
    volunteerId: v,
    needId: "n",
    value: "disponivel" as const,
    updatedAt: "",
  })),
  draws: [
    {
      id: "d",
      periodId: "p",
      number: 1,
      createdAt: "",
      createdBy: "",
      status: "publicado",
      slots: [
        {
          needId: "n",
          eligible: 4,
          picks: ["a", "b", "c"].map((v, i) => ({
            volunteerId: v,
            recent3m: 0,
            last12m: 0,
            priority: i + 1,
            tiebreak: "",
          })),
        },
      ],
    },
  ],
  attendance: [
    {
      id: "x",
      periodId: "p",
      needId: "n",
      volunteerId: "c",
      status: "cancelado",
      recordedAt: "",
      supervisor: "",
    },
  ],
  opportunities: [
    {
      id: "o",
      date: "2099-03-02",
      start: "18:00",
      end: "20:00",
      min: 2,
      max: 4,
      status: "aberta",
      createdAt: "",
    },
  ],
  applications: [
    { id: "1", opportunityId: "o", volunteerId: "a", status: "candidatado", updatedAt: "" },
    { id: "2", opportunityId: "o", volunteerId: "b", status: "cancelado", updatedAt: "" },
  ],
});

describe("Agenda da coordenação", () => {
  it("conta escalados (sem cancelados), vagas vazias e disponíveis no turno mensal", () => {
    const n = agendaItems(base()).find((i) => i.kind === "escala")!;
    expect(n.filled).toEqual(["a", "b"]);
    expect(n.slots - n.filled.length).toBe(1);
    expect(n.candidates).toHaveLength(4);
  });
  it("na vaga avulsa aberta, conta candidatos ativos e ignora cancelados", () => {
    const o = agendaItems(base()).find((i) => i.kind === "vaga")!;
    expect(o.filled).toEqual(["a"]);
    expect(o.candidates).toEqual(["a"]);
    expect(o.min).toBe(2);
  });
  it("a escala do voluntário não inclui turno em que ele foi cancelado", () => {
    expect(myScheduleItems(base(), "c")).toHaveLength(0);
    expect(myScheduleItems(base(), "a")).toHaveLength(1);
  });
});
