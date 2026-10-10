import { fmtTimeRange } from "@/lib/time";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CalendarDays, CheckCircle2, ChevronRight, ClipboardCheck, Shuffle, Target, UserCheck, Users } from "lucide-react";
import { useStore } from "@/data/store";
import { activeVolunteers, availabilityPeriod, hasResponded, latestDraw, nextScheduledNeed } from "@/data/selectors";
import { PageHeader, Panel, Pill, StatCard } from "@/components/app/common";
import { VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { PERIOD_STATUS, fmtDM, fmtLong, periodLabel } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { SupervisorAlerts } from "@/components/app/SupervisorAlerts";

export const Route = createFileRoute("/supervisor/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Dashboard — Painel do Supervisor" },
      { name: "description", content: "Visão geral de voluntários, disponibilidades e escalas." },
      { property: "og:title", content: "Dashboard — Painel do Supervisor" },
      { property: "og:description", content: "Visão geral de voluntários, disponibilidades e escalas." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { state } = useStore();
  const active = activeVolunteers(state);
  const period = availabilityPeriod(state);
  const responded = period ? active.filter((v) => hasResponded(state, period.id, v.id)).length : 0;
  const slotsNeeded = period ? period.needs.reduce((s, n) => s + n.slots, 0) : 0;
  const draw = period ? latestDraw(state, period.id) : undefined;
  const filled = draw ? draw.slots.reduce((s, sl) => s + sl.picks.length, 0) : 0;
  const next = nextScheduledNeed(state);

  return (
    <div className="space-y-6">
      <PageHeader title={`Olá, ${state.supervisors.find((x) => x.id === state.session?.userId)?.name ?? state.settings.supervisorName}`} subtitle={`${state.settings.ministryName} · ${state.settings.churchName}`} />
      <SupervisorAlerts />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Users} label="Total de voluntários" value={state.volunteers.length} />
        <StatCard icon={UserCheck} label="Voluntários ativos" value={active.length} tone="success" />
        <StatCard icon={ClipboardCheck} label="Disponibilidades respondidas" value={responded} tone="accent" hint={period ? periodLabel(period) : undefined} />
        <StatCard icon={AlertCircle} label="Pendências" value={active.length - responded} tone="warning" hint="Sem resposta" />
        <StatCard icon={Target} label="Vagas necessárias" value={slotsNeeded} tone="primary" />
        <StatCard icon={CheckCircle2} label="Vagas preenchidas" value={filled} tone="success" hint={draw ? `Sorteio #${draw.number}` : "Sorteio não realizado"} />
        <div className="col-span-2">
          <Panel className="h-full">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <CalendarDays className="h-4 w-4" /> Próxima escala
            </div>
            {next ? (
              <>
                <div className="font-display text-lg font-semibold">{fmtLong(next.need.date)} · {fmtTimeRange(next.need)}</div>
                <div className="mt-3 flex -space-x-2">
                  {next.slot.picks.map((p) => {
                    const v = state.volunteers.find((x) => x.id === p.volunteerId)!;
                    return <VolunteerAvatar key={p.volunteerId} name={v.name} photoUrl={v.photoUrl} size="sm" />;
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma escala futura publicada.</p>
            )}
          </Panel>
        </div>
      </div>

      {period && (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Período em andamento</p>
              <h2 className="font-display text-xl font-semibold">{periodLabel(period)}</h2>
              <p className="text-sm text-muted-foreground">Prazo das disponibilidades: {fmtDM(period.deadline)}</p>
            </div>
            <Pill tone={PERIOD_STATUS[period.status].tone}>{PERIOD_STATUS[period.status].label}</Pill>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-sm">
              <span>Respostas</span>
              <span className="font-semibold">{responded}/{active.length}</span>
            </div>
            <Progress value={(responded / Math.max(1, active.length)) * 100} className="h-2" />
          </div>
        </Panel>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Quick to="/supervisor/disponibilidades" icon={ClipboardCheck} label="Ver disponibilidades" />
        <Quick to="/supervisor/sorteio" icon={Shuffle} label="Sorteio da escala" />
        <Quick to="/supervisor/presenca" icon={UserCheck} label="Registrar presença" />
      </div>
    </div>
  );
}

function Quick({ to, icon: Icon, label }: { to: "/supervisor/disponibilidades" | "/supervisor/sorteio" | "/supervisor/presenca"; icon: typeof Users; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border bg-card p-4 font-semibold shadow-soft transition hover:border-primary">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary"><Icon className="h-5 w-5" /></span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
