import { fmtTimeRange } from "@/lib/time";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { useStore } from "@/data/store";
import { publishedDraw } from "@/data/selectors";
import { DateBadge, EmptyState, PageHeader, Panel, Pill } from "@/components/app/common";
import { PersonRow } from "@/components/app/VolunteerAvatar";
import { PeriodSelect } from "@/components/app/PeriodSelect";
import { fmtDM, fmtWeekday, periodLabel } from "@/lib/format";

export const Route = createFileRoute("/supervisor/escala")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Escala completa — Painel do Supervisor" },
      { name: "description", content: "Visualize a escala publicada de todos os voluntários." },
      { property: "og:title", content: "Escala completa — Painel do Supervisor" },
      { property: "og:description", content: "Visualize a escala publicada." },
    ],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const { state } = useStore();
  const withScale = state.periods.filter((p) => publishedDraw(state, p.id));
  const [pid, setPid] = useState(withScale.find((p) => p.status === "publicada")?.id ?? withScale[0]?.id);
  const period = state.periods.find((p) => p.id === pid);
  const draw = period ? publishedDraw(state, period.id) : undefined;

  return (
    <div>
      <PageHeader title="Escala" subtitle={period ? periodLabel(period).toUpperCase() : undefined} actions={<PeriodSelect periods={withScale} value={pid} onChange={setPid} />} />
      {!draw || !period ? (
        <EmptyState icon={CalendarDays} title="Nenhuma escala publicada" text="Publique um sorteio para visualizar a escala." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {draw.slots.map((slot) => {
            const n = period.needs.find((x) => x.id === slot.needId);
            if (!n) return null;
            return (
              <Panel key={slot.needId}>
                <div className="mb-2 flex items-center gap-3">
                  <DateBadge date={n.date} />
                  <div className="flex-1">
                    <div className="font-semibold">{fmtWeekday(n.date)} — {fmtDM(n.date)}</div>
                    <div className="text-sm text-muted-foreground">{fmtTimeRange(n)}</div>
                  </div>
                  <Pill tone={slot.picks.length < n.slots ? "destructive" : "success"}>{slot.picks.length}/{n.slots}</Pill>
                </div>
                <div className="divide-y">
                  {slot.picks.map((p) => {
                    const v = state.volunteers.find((x) => x.id === p.volunteerId)!;
                    return <PersonRow key={p.volunteerId} name={v.name} photoUrl={v.photoUrl} />;
                  })}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
