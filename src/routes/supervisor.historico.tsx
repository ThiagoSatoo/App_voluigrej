import { fmtTimeRange } from "@/lib/time";
import { createFileRoute } from "@tanstack/react-router";
import { Ban, CalendarCheck, CheckCircle2, Repeat, XCircle } from "lucide-react";
import { useStore } from "@/data/store";
import { drawsOf, fixedLabel, sortPeriods } from "@/data/selectors";
import { PageHeader, Panel, Pill, StatCard } from "@/components/app/common";
import { VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { DRAW_STATUS, fmtDM, fmtDMY, fmtDateTime, periodLabel } from "@/lib/format";

export const Route = createFileRoute("/supervisor/historico")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Histórico — Painel da Coordenação" },
      { name: "description", content: "Escalas realizadas, presenças, faltas, substituições e versões de sorteio." },
      { property: "og:title", content: "Histórico — Painel da Coordenação" },
      { property: "og:description", content: "Histórico de escalas e sorteios." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { state } = useStore();
  const c = (s: string) => state.attendance.filter((a) => a.status === s).length;
  const needs = state.periods.flatMap((p) => p.needs);
  const done = new Set(state.attendance.filter((a) => a.status === "presente").map((a) => a.needId)).size;
  const ranking = [...state.volunteers].sort((a, b) => b.last12m - a.last12m);
  const max = Math.max(1, ...ranking.map((v) => v.last12m));
  const pres = c("presente"), falt = c("faltou");

  return (
    <div className="space-y-5">
      <PageHeader title="Histórico" subtitle="Dados que alimentam a prioridade do sorteio." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard icon={CalendarCheck} label="Escalas realizadas" value={done} />
        <StatCard icon={Ban} label="Canceladas" value={c("cancelado")} tone="muted" />
        <StatCard icon={Repeat} label="Substituições" value={state.substitutions.length} tone="warning" />
        <StatCard icon={CheckCircle2} label="Presenças" value={pres} tone="success" />
        <StatCard icon={XCircle} label="Faltas" value={falt} tone="destructive" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-1 font-display text-lg font-semibold">Taxa de presença</h2>
          <div className="mb-2 font-display text-4xl font-semibold text-primary">{Math.round((pres / Math.max(1, pres + falt)) * 100)}%</div>
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            <div className="bg-success" style={{ width: `${(pres / Math.max(1, pres + falt)) * 100}%` }} />
            <div className="bg-destructive" style={{ width: `${(falt / Math.max(1, pres + falt)) * 100}%` }} />
          </div>
          <h3 className="mt-6 mb-2 font-semibold">Substituições</h3>
          <div className="space-y-2">
            {state.substitutions.map((s) => {
              const n = needs.find((x) => x.id === s.needId);
              return (
                <div key={s.id} className="rounded-xl bg-secondary p-3 text-sm">
                  <b>{state.volunteers.find((v) => v.id === s.outId)?.name}</b> → <b>{state.volunteers.find((v) => v.id === s.inId)?.name}</b>
                  <div className="text-xs text-muted-foreground">{n ? `${fmtDM(n.date)} ${fmtTimeRange(n)} · ` : ""}{s.reason} · {fmtDateTime(s.at)} · {s.supervisor}</div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel>
          <h2 className="mb-3 font-display text-lg font-semibold">Escalas por voluntário (12 meses)</h2>
          <div className="space-y-2">
            {ranking.map((v) => (
              <div key={v.id} className="flex items-center gap-2">
                <VolunteerAvatar name={v.name} photoUrl={v.photoUrl} size="xs" />
                <span className="w-28 truncate text-xs font-medium">{v.name}</span>
                <div className="h-2.5 flex-1 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(v.last12m / max) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-xs font-bold">{v.last12m}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <h2 className="mb-3 font-display text-lg font-semibold">Histórico dos sorteios</h2>
        <div className="space-y-4">
          {sortPeriods(state.periods).filter((p) => drawsOf(state, p.id).length).map((p) => (
            <div key={p.id}>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">{periodLabel(p)}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {drawsOf(state, p.id).map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                    <div className="min-w-0">
                      <b>Sorteio #{d.number}</b>
                      <div className="truncate text-xs text-muted-foreground">
                        {(() => { const f = state.fixedSchedules.find((x) => x.id === d.fixedId); return f ? `${fixedLabel(f)} · ` : ""; })()}Data: {fmtDMY(d.createdAt.slice(0, 10))}
                      </div>
                    </div>
                    <Pill tone={DRAW_STATUS[d.status].tone}>{DRAW_STATUS[d.status].label}</Pill>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
