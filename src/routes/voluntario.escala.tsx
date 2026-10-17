import { fmtTimeRange } from "@/lib/time";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { useStore } from "@/data/store";
import { assignmentsOf } from "@/data/selectors";
import { DateBadge, EmptyState, PageHeader, Panel, Pill } from "@/components/app/common";
import { VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { today, fmtWeekday, periodLabel } from "@/lib/format";

export const Route = createFileRoute("/voluntario/escala")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Minha escala — Área do Voluntário" },
      { name: "description", content: "Suas datas escaladas publicadas." },
      { property: "og:title", content: "Minha escala — Área do Voluntário" },
      { property: "og:description", content: "Suas datas escaladas publicadas." },
    ],
  }),
  component: MySchedule,
});

function MySchedule() {
  const { state } = useStore();
  const me = state.volunteers.find((v) => v.id === state.session!.userId)!;
  const list = assignmentsOf(state, me.id);
  const upcoming = list.filter((a) => a.need.date >= today());
  const past = list.filter((a) => a.need.date < today()).reverse();

  // Group by period label
  const groups = upcoming.reduce<Record<string, typeof upcoming>>((acc, a) => {
    (acc[periodLabel(a.period)] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <PageHeader title="Minha escala" subtitle="Somente suas escalas publicadas." />
      {upcoming.length === 0 && <EmptyState icon={CalendarDays} title="Sem escalas futuras" text="Você ainda não possui uma escala publicada." />}
      {Object.entries(groups).map(([label, items]) => (
        <section key={label}>
          <h2 className="mb-2 font-display text-lg font-semibold uppercase tracking-wide">{label}</h2>
          <div className="space-y-3">
            {items.map((a) => (
              <Panel key={a.need.id} className="flex items-center gap-3 p-4">
                <DateBadge date={a.need.date} />
                <div className="flex-1">
                  <div className="font-semibold">{fmtWeekday(a.need.date)}</div>
                  <div className="text-sm text-muted-foreground">{fmtTimeRange(a.need)}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <VolunteerAvatar name={me.name} photoUrl={me.photoUrl} size="xs" />
                  <Pill tone="primary">Escalado</Pill>
                </div>
              </Panel>
            ))}
          </div>
        </section>
      ))}
      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Anteriores</h2>
          <div className="space-y-2">
            {past.map((a) => (
              <Panel key={a.need.id} className="flex items-center gap-3 p-3 opacity-80">
                <DateBadge date={a.need.date} className="h-11 w-11" />
                <div className="flex-1 text-sm">
                  <div className="font-semibold">{fmtWeekday(a.need.date)}</div>
                  <div className="text-muted-foreground">{fmtTimeRange(a.need)}</div>
                </div>
              </Panel>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
