import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Lock, Repeat } from "lucide-react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useStore } from "@/data/store";
import { myScheduleItems, personName, scheduleItems, type ScheduleItem } from "@/data/selectors";
import { DateBadge, EmptyState, Notice, Panel, Pill } from "@/components/app/common";
import { VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { AvailabilityControl } from "@/components/app/AvailabilityControl";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { firstName, fmtLong, fmtWeekday, today, toDate } from "@/lib/format";
import { visibleNav } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/voluntario/escala")({
  head: () => ({
    meta: [
      { title: "Agenda — Área do Voluntário" },
      { name: "description", content: "Seu próximo turno, o calendário do mês e as próximas escalas." },
    ],
  }),
  component: MyAgenda,
});

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * Primeira tela do voluntário e do responsável.
 * O que aparece depende da política "Quem vê a escala": o banco só entrega as pessoas
 * permitidas e esta tela apenas organiza o que chegou. Não existe agenda individual de outra pessoa.
 */
function MyAgenda() {
  const { state } = useStore();
  const meId = state.session!.userId;
  const me = state.volunteers.find((v) => v.id === meId);
  const policy = state.settings.visibilityPolicy;
  const geral = policy === "escala_geral";
  const all = useMemo(() => scheduleItems(state), [state]);
  const mine = useMemo(() => myScheduleItems(state, meId), [state, meId]);
  const [scope, setScope] = useState<"minha" | "geral">("minha");
  // No calendário: na escala geral aparecem todos os turnos; nas outras políticas, só os meus.
  const calItems = geral ? all : mine;
  const [month, setMonth] = useState(() => startOfMonth(toDate(today())));
  const [day, setDay] = useState<string | null>(null);

  const next = mine.find((a) => a.date >= today());
  // Ainda não escolheu nenhuma escala fixa (e há escalas para escolher).
  const pending = state.fixedSchedules.some((f) => f.active) && !state.fixedMembers.some((m) => m.volunteerId === meId);
  const canAnswer = visibleNav(state, "voluntario").some((it) => it.key === "disponibilidade");

  const mk = format(month, "yyyy-MM");
  const byDay = calItems.reduce<Record<string, ScheduleItem[]>>((acc, i) => ((acc[i.date] ??= []).push(i), acc), {});
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 0 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }) });
  const listSource = geral && scope === "geral" ? all : mine;
  const upcoming = listSource.filter((a) => a.date >= today());
  const past = mine.filter((a) => a.date < today()).reverse().slice(0, 5);
  const showPeople = policy !== "privado";

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3 pr-12">
        {me && <VolunteerAvatar name={me.name} photoUrl={me.photoUrl} size="md" />}
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">Olá, {firstName(me?.name ?? "")}</p>
          <h1 className="font-display text-2xl font-semibold">Agenda</h1>
        </div>
      </header>

      {/* Resumo compacto: próximo turno e disponibilidade pendente. */}
      <div className="space-y-2">
        {next ? (
          <div className="flex items-center gap-3 rounded-2xl bg-gradient-hero p-3 text-primary-foreground shadow-elegant">
            <DateBadge date={next.date} className="h-12 w-12 bg-primary-foreground/15 text-primary-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Próximo turno</p>
              <p className="truncate font-semibold">{fmtLong(next.date)}</p>
              <p className="flex items-center gap-1 text-sm opacity-90"><Clock className="h-3.5 w-3.5" /> {next.start} – {next.end}</p>
            </div>
          </div>
        ) : (
          <Panel className="p-3 text-sm text-muted-foreground">Você ainda não tem turno publicado.</Panel>
        )}
        {pending && (
          <Notice tone="warning" icon={Repeat}>
            Você ainda não escolheu em quais escalas fixas pode servir.{" "}
            {canAnswer && <Link to="/voluntario/disponibilidade" className="font-bold underline underline-offset-2">Escolher agora</Link>}
          </Notice>
        )}
      </div>

      <Panel className="p-2 sm:p-3">
        <div className="mb-2 flex items-center justify-between gap-1">
          <Button size="icon" variant="ghost" onClick={() => { setMonth(addMonths(month, -1)); setDay(null); }} aria-label="Mês anterior"><ChevronLeft /></Button>
          <span className="font-display text-lg font-semibold capitalize">{format(month, "MMMM yyyy", { locale: ptBR })}</span>
          <Button size="icon" variant="ghost" onClick={() => { setMonth(addMonths(month, 1)); setDay(null); }} aria-label="Próximo mês"><ChevronRight /></Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-muted-foreground">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = ymd(d);
            const list = byDay[key] ?? [];
            const isMine = list.some((i) => i.people.includes(meId));
            return (
              <button
                key={key}
                onClick={() => setDay(day === key ? null : key)}
                aria-label={`${fmtLong(key)}${isMine ? ", você está escalado" : ""}`}
                className={cn(
                  "flex h-12 flex-col items-center justify-center gap-1 rounded-lg border text-sm transition",
                  !key.startsWith(mk) && "opacity-40",
                  key === today() && "border-primary",
                  isMine && "bg-primary text-primary-foreground",
                  day === key && "ring-2 ring-primary ring-offset-1",
                )}
              >
                <span className="font-semibold leading-none">{format(d, "d")}</span>
                <span className={cn("h-1.5 w-1.5 rounded-full", list.length === 0 ? "bg-transparent" : isMine ? "bg-primary-foreground" : "bg-muted-foreground/60")} />
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          {geral ? "Dias em destaque: você está escalado. Ponto cinza: outros turnos." : "Dias em destaque: você está escalado."} Toque em um dia para ver os detalhes.
        </p>
      </Panel>

      {day && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">{fmtLong(day)}</h2>
            <Button size="sm" variant="ghost" onClick={() => setDay(null)}>Fechar</Button>
          </div>
          {(byDay[day] ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{geral ? "Nenhum turno publicado neste dia." : "Você não está escalado neste dia."}</p>
          ) : (
            (byDay[day] ?? []).map((a) => <ShiftCard key={a.key} item={a} meId={meId} showPeople={showPeople} />)
          )}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Próximos turnos</h2>
          {geral && (
            <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
              <TabsList className="h-9 rounded-xl">
                <TabsTrigger value="minha" className="rounded-lg text-xs">Meus</TabsTrigger>
                <TabsTrigger value="geral" className="rounded-lg text-xs">Escala geral</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
        {upcoming.length === 0 && <EmptyState icon={CalendarDays} title="Sem turnos futuros" text="Quando a coordenação publicar a escala, seus turnos aparecem aqui." />}
        {upcoming.map((a) => <ShiftCard key={a.key} item={a} meId={meId} showPeople={showPeople} />)}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Anteriores</h2>
          <div className="space-y-2">
            {past.map((a) => (
              <Panel key={a.key} className="flex items-center gap-3 p-3 opacity-80">
                <DateBadge date={a.date} className="h-11 w-11" />
                <div className="flex-1 text-sm">
                  <div className="font-semibold">{fmtWeekday(a.date)}</div>
                  <div className="text-muted-foreground">{a.start} – {a.end}</div>
                </div>
              </Panel>
            ))}
          </div>
        </section>
      )}

      {policy === "privado" && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5 shrink-0" /> Por decisão da coordenação, os nomes dos colegas de turno não são exibidos.</p>
      )}
    </div>
  );
}

function ShiftCard({ item: a, meId, showPeople }: { item: ScheduleItem; meId: string; showPeople: boolean }) {
  const { state } = useStore();
  const isMine = a.people.includes(meId);
  const others = a.people.filter((id) => id !== meId);
  return (
    <Panel className={cn("p-4", isMine && "border-primary")}>
      <div className="flex items-center gap-3">
        <DateBadge date={a.date} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{fmtWeekday(a.date)}</div>
          <div className="text-sm text-muted-foreground">{a.start} – {a.end}{a.note ? ` · ${a.note}` : ""}</div>
        </div>
        {isMine ? <Pill tone={a.kind === "vaga" ? "accent" : "primary"}>{a.kind === "vaga" ? "Vaga" : "Você"}</Pill> : <Pill tone="muted">{a.kind === "vaga" ? "Vaga" : "Turno"}</Pill>}
      </div>
      {showPeople && others.length > 0 && <People ids={others} title={isMine ? "Com você" : "Escalados"} />}
      {a.responsavelId && a.responsavelId !== meId && (
        <p className="mt-2 text-xs text-muted-foreground">Responsável: {personName(state, a.responsavelId) ?? "—"}</p>
      )}
      {isMine && a.fixedId && a.date >= today() && (
        <div className="mt-3 border-t pt-3">
          <AvailabilityControl fixedId={a.fixedId} date={a.date} />
          <p className="mt-1.5 text-[11px] text-muted-foreground">Não pode ir? Marque “Indisponível”. Mudou de ideia? Use a aba Escalas.</p>
        </div>
      )}
    </Panel>
  );
}

/** Os nomes não são clicáveis: não há agenda individual de ninguém. */
function People({ ids, title }: { ids: string[]; title?: string }) {
  const { state } = useStore();
  return (
    <div className="mt-3">
      {title && <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>}
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => {
          const v = state.volunteers.find((x) => x.id === id);
          const nm = personName(state, id) ?? "Voluntário";
          return (
            <span key={id} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary py-1 pl-1 pr-3 text-xs font-medium">
              <VolunteerAvatar name={nm} photoUrl={v?.photoUrl} size="xs" />
              <span className="truncate">{nm}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
