import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ClipboardList, Repeat, XCircle } from "lucide-react";
import { useStore } from "@/data/store";
import { EmptyState, PageHeader, Panel, Pill, StatCard } from "@/components/app/common";
import { ATTENDANCE_STATUS, fmtDateTime, fmtLong } from "@/lib/format";

export const Route = createFileRoute("/voluntario/historico")({
  head: () => ({
    meta: [
      { title: "Meu histórico — Área do Voluntário" },
      { name: "description", content: "Seus registros de presença." },
      { property: "og:title", content: "Meu histórico — Área do Voluntário" },
      { property: "og:description", content: "Seus registros de presença." },
    ],
  }),
  component: MyHistory,
});

function MyHistory() {
  const { state } = useStore();
  const meId = state.session!.userId;
  const records = state.attendance
    .filter((a) => a.volunteerId === meId)
    .map((a) => ({ a, need: state.periods.flatMap((p) => p.needs).find((n) => n.id === a.needId) }))
    .filter((x) => x.need)
    .sort((x, y) => y.need!.date.localeCompare(x.need!.date));
  const count = (s: string) => records.filter((r) => r.a.status === s).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Meu histórico" subtitle="Seus registros de presença." />
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={CheckCircle2} label="Presenças" value={count("presente")} tone="success" />
        <StatCard icon={XCircle} label="Faltas" value={count("faltou")} tone="destructive" />
        <StatCard icon={Repeat} label="Substituído" value={count("substituido")} tone="warning" />
      </div>
      {records.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhum registro ainda" text="Após servir em uma escala, sua presença aparecerá aqui." />
      ) : (
        <div className="space-y-2">
          {records.map(({ a, need }) => (
            <Panel key={a.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <div className="font-semibold">{fmtLong(need!.date)}</div>
                <div className="text-xs text-muted-foreground">{need!.shift} · registrado em {fmtDateTime(a.recordedAt)}</div>
              </div>
              <Pill tone={ATTENDANCE_STATUS[a.status].tone}>{ATTENDANCE_STATUS[a.status].label}</Pill>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
