import { fmtTimeRange } from "@/lib/time";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, CalendarDays, ChevronRight, History, Clock, UserRound } from "lucide-react";
import { useStore } from "@/data/store";
import { availabilityPeriod, hasResponded, nextAssignment } from "@/data/selectors";
import { VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { EmptyState, Panel, Pill } from "@/components/app/common";
import { firstName, fmtDM, fmtLong, periodLabel } from "@/lib/format";

export const Route = createFileRoute("/voluntario/")({
  head: () => ({
    meta: [
      { title: "Início — Área do Voluntário" },
      { name: "description", content: "Sua próxima escala e atalhos rápidos." },
      { property: "og:title", content: "Início — Área do Voluntário" },
      { property: "og:description", content: "Sua próxima escala e atalhos rápidos." },
    ],
  }),
  component: VolunteerHome,
});

function VolunteerHome() {
  const { state } = useStore();
  const me = state.volunteers.find((v) => v.id === state.session?.userId)!;
  const next = nextAssignment(state, me.id);
  const period = availabilityPeriod(state);
  const answered = period ? state.availabilities.filter((a) => a.periodId === period.id && a.volunteerId === me.id).length : 0;
  const responded = period ? hasResponded(state, period.id, me.id) : false;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <VolunteerAvatar name={me.name} photoUrl={me.photoUrl} size="md" />
        <div>
          <p className="text-sm text-muted-foreground">{greet},</p>
          <h1 className="font-display text-2xl font-semibold">{firstName(me.name)}</h1>
        </div>
      </header>

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Próxima escala</h2>
        {next ? (
          <div className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-elegant">
            <div className="flex items-center gap-3">
              <VolunteerAvatar name={me.name} photoUrl={me.photoUrl} size="md" />
              <div className="font-semibold">{me.name}</div>
            </div>
            <div className="mt-5 font-display text-2xl font-semibold">{fmtLong(next.need.date)}</div>
            <div className="mt-1 flex items-center gap-2 opacity-90">
              <Clock className="h-4 w-4" />
              {fmtTimeRange(next.need)}
            </div>
            <div className="mt-4 inline-flex rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-bold">Status: Escalado</div>
          </div>
        ) : (
          <EmptyState icon={CalendarDays} title="Nada por aqui ainda" text="Você ainda não possui uma escala publicada." />
        )}
      </section>

      {period && (
        <Panel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Disponibilidade · {periodLabel(period)}</p>
              <p className="mt-1 font-semibold">
                {period.status !== "aberta"
                  ? "Período encerrado"
                  : responded
                    ? `${answered} de ${period.needs.length} datas respondidas`
                    : "Ainda não informada"}
              </p>
              {period.status === "aberta" && <p className="text-sm text-muted-foreground">Aberta até {fmtDM(period.deadline)}</p>}
            </div>
            <Pill tone={period.status !== "aberta" ? "muted" : responded ? "success" : "warning"}>
              {period.status !== "aberta" ? "Encerrada" : responded ? "Respondida" : "Pendente"}
            </Pill>
          </div>
        </Panel>
      )}

      <section className="grid grid-cols-2 gap-3">
        <Shortcut to="/voluntario/disponibilidade" icon={CalendarCheck} label="Informar disponibilidade" />
        <Shortcut to="/voluntario/escala" icon={CalendarDays} label="Minha escala" />
        <Shortcut to="/voluntario/historico" icon={History} label="Meu histórico" />
        <Shortcut to="/voluntario/perfil" icon={UserRound} label="Meu perfil" />
      </section>
    </div>
  );
}

function Shortcut({ to, icon: Icon, label }: { to: "/voluntario/disponibilidade" | "/voluntario/escala" | "/voluntario/historico" | "/voluntario/perfil"; icon: typeof Clock; label: string }) {
  return (
    <Link to={to} className="group flex flex-col justify-between gap-6 rounded-2xl border bg-card p-4 shadow-soft transition active:scale-[0.98]">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex items-end justify-between text-sm font-semibold leading-tight">
        {label}
        <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
