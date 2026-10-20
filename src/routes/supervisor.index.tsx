import { fmtTimeRange } from "@/lib/time";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CalendarDays, CheckCircle2, ChevronRight, Repeat, Target, UserCheck, Users } from "lucide-react";
import { MyCpfCard } from "@/components/app/MyCpfCard";
import { useStore } from "@/data/store";
import { activeVolunteers, agendaItems, fixedDraws, fixedLabel, nextScheduledNeed, sortFixed } from "@/data/selectors";
import { PageHeader, Panel, Pill, StatCard } from "@/components/app/common";
import { VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { MONTHS, fmtLong, today } from "@/lib/format";
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
  const next = nextScheduledNeed(state);
  const fixed = sortFixed(state.fixedSchedules.filter((f) => f.active));
  const withoutFixed = active.filter((v) => !state.fixedMembers.some((m) => m.volunteerId === v.id)).length;
  // Mês atual: vagas dos turnos e quanto já está preenchido (escalas publicadas).
  const [y, m] = today().split("-").map(Number);
  const monthItems = agendaItems(state).filter((i) => i.kind === "escala" && i.date.startsWith(today().slice(0, 7)));
  const slotsNeeded = monthItems.reduce((t, i) => t + i.slots, 0);
  const filled = monthItems.reduce((t, i) => t + Math.min(i.filled.length, i.slots), 0);
  const monthStatus = fixed.map((f) => {
    const ds = fixedDraws(state, f.id, y, m).draws;
    return { f, draft: ds.some((d) => d.status === "rascunho"), published: ds.some((d) => d.status === "publicado") };
  });

  return (
    <div className="space-y-6">
      <PageHeader title={`Olá, ${state.supervisors.find((x) => x.id === state.session?.userId)?.name ?? state.session?.name ?? ""}`} subtitle={state.settings.churchName} />
      <SupervisorAlerts />
      {(() => {
        const me = state.supervisors.find((x) => x.id === state.session?.userId);
        return me && !me.cpf ? (
          <Panel className="space-y-2">
            <p className="font-semibold">Falta um passo: seu CPF</p>
            <MyCpfCard />
          </Panel>
        ) : null;
      })()}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Users} label="Total de voluntários" value={state.volunteers.length} />
        <StatCard icon={UserCheck} label="Voluntários ativos" value={active.length} tone="success" />
        <StatCard icon={Repeat} label="Escalas fixas ativas" value={fixed.length} tone="accent" />
        <StatCard icon={AlertCircle} label="Sem escala fixa" value={withoutFixed} tone="warning" hint="Voluntários ativos" />
        <StatCard icon={Target} label="Vagas no mês" value={slotsNeeded} tone="primary" hint={MONTHS[m - 1]} />
        <StatCard icon={CheckCircle2} label="Vagas preenchidas" value={filled} tone="success" hint="Escalas publicadas" />
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

      {monthStatus.length > 0 && (
        <Panel>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Escalas fixas · {MONTHS[m - 1]}</p>
          <div className="mt-2 divide-y">
            {monthStatus.map(({ f, draft, published }) => (
              <div key={f.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0 truncate font-medium">{fixedLabel(f)}</span>
                <Pill tone={draft ? "warning" : published ? "success" : "muted"}>{draft ? "Rascunho" : published ? "Publicada" : "Sem sorteio"}</Pill>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Quick to="/supervisor/periodos" icon={Repeat} label="Escalas fixas e sorteio" />
        <Quick to="/supervisor/escala" icon={CalendarDays} label="Agenda" />
        <Quick to="/supervisor/escala" icon={UserCheck} label="Registrar presença" />
      </div>
    </div>
  );
}

function Quick({ to, icon: Icon, label }: { to: "/supervisor/periodos" | "/supervisor/escala"; icon: typeof Users; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border bg-card p-4 font-semibold shadow-soft transition hover:border-primary">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary"><Icon className="h-5 w-5" /></span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
