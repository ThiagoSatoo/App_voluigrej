import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, LayoutGrid, List, UserCheck, UserCog } from "lucide-react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useStore } from "@/data/store";
import { agendaItems, personName, type AgendaItem } from "@/data/selectors";
import { DateBadge, EmptyState, PageHeader, Panel, Pill } from "@/components/app/common";
import { PersonRow } from "@/components/app/VolunteerAvatar";
import { ShiftAttendance } from "@/components/app/AttendanceManager";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PERIOD_STATUS, firstName, fmtLong, today, toDate } from "@/lib/format";
import type { Tone } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/supervisor/escala")({
  head: () => ({
    meta: [
      { title: "Agenda — Painel do Supervisor" },
      { name: "description", content: "Todos os horários criados, com escalados, candidatos e vagas livres." },
    ],
  }),
  component: AgendaPage,
});

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

/** Vermelho = faltam pessoas; verde = completo. Na vaga avulsa, o mínimo também conta. */
function fillTone(i: AgendaItem): Tone {
  if (i.filled.length >= i.slots) return "success";
  if (i.min !== undefined && i.filled.length >= i.min) return "info";
  return i.filled.length === 0 ? "destructive" : "warning";
}

function statusLabel(i: AgendaItem) {
  if (i.kind === "vaga") return i.status === "confirmada" ? "Vaga confirmada" : "Vaga aberta";
  return PERIOD_STATUS[i.status as keyof typeof PERIOD_STATUS]?.label ?? i.status;
}

function AgendaPage() {
  const { state } = useStore();
  const items = useMemo(() => agendaItems(state), [state]);
  const [month, setMonth] = useState(() => startOfMonth(toDate(today())));
  const [view, setView] = useState<"calendario" | "lista">("calendario");
  const [kind, setKind] = useState<"todos" | "escala" | "vaga">("todos");
  // Abre já no dia de hoje quando há horários, para marcar a presença mais rápido.
  const [day, setDay] = useState<string | null>(() => (items.some((i) => i.date === today()) ? today() : null));
  const name = (id: string) => personName(state, id) ?? "—";

  const mk = format(month, "yyyy-MM");
  const monthItems = items.filter((i) => i.date.startsWith(mk) && (kind === "todos" || i.kind === kind));
  const byDay = monthItems.reduce<Record<string, AgendaItem[]>>((acc, i) => ((acc[i.date] ??= []).push(i), acc), {});
  const totals = monthItems.reduce(
    (t, i) => ({ slots: t.slots + i.slots, filled: t.filled + Math.min(i.filled.length, i.slots) }),
    { slots: 0, filled: 0 },
  );
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 0 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }) });
  const shown = day ? (byDay[day] ?? []) : monthItems;

  return (
    <div className="space-y-4">
      <PageHeader title="Agenda" subtitle="Todos os horários, com escalados, candidatos e vagas livres. Abra um turno de hoje ou passado para marcar a presença." />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" onClick={() => { setMonth(addMonths(month, -1)); setDay(null); }} aria-label="Mês anterior"><ChevronLeft /></Button>
          <span className="min-w-36 text-center font-display text-lg font-semibold capitalize">{format(month, "MMMM yyyy", { locale: ptBR })}</span>
          <Button size="icon" variant="outline" onClick={() => { setMonth(addMonths(month, 1)); setDay(null); }} aria-label="Próximo mês"><ChevronRight /></Button>
        </div>
        <Tabs value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="todos" className="rounded-lg">Todos</TabsTrigger>
            <TabsTrigger value="escala" className="rounded-lg">Escala mensal</TabsTrigger>
            <TabsTrigger value="vaga" className="rounded-lg">Vagas avulsas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant={view === "calendario" ? "default" : "outline"} onClick={() => setView("calendario")}><LayoutGrid /> Calendário</Button>
          <Button size="sm" variant={view === "lista" ? "default" : "outline"} onClick={() => { setView("lista"); setDay(null); }}><List /> Lista</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Total label="Horários" value={monthItems.length} />
        <Total label="Vagas preenchidas" value={totals.filled} tone="text-success" />
        <Total label="Vagas vazias" value={totals.slots - totals.filled} tone={totals.slots - totals.filled > 0 ? "text-destructive" : undefined} />
      </div>

      {view === "calendario" && (
        <Panel className="p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-muted-foreground">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const key = ymd(d);
              const list = byDay[key] ?? [];
              const inMonth = key.startsWith(mk);
              return (
                <button
                  key={key}
                  onClick={() => setDay(day === key ? null : key)}
                  className={cn(
                    "flex min-h-16 flex-col gap-0.5 rounded-lg border p-1 text-left align-top transition sm:min-h-28 sm:p-1.5",
                    !inMonth && "opacity-40",
                    key === today() && "border-primary",
                    day === key && "bg-primary-soft ring-2 ring-primary",
                  )}
                >
                  <span className="text-xs font-semibold">{format(d, "d")}</span>
                  {list.map((i) => (
                    <div key={i.key} className="w-full overflow-hidden">
                      <Pill tone={fillTone(i)} className="w-full justify-between px-1 text-[10px]">
                        <span className="hidden sm:inline">{i.start}</span>
                        <span>{i.filled.length}/{i.slots}</span>
                      </Pill>
                      {/* Em telas maiores, todos os nomes aparecem direto no calendário. */}
                      <div className="hidden text-[10px] leading-tight text-muted-foreground sm:block">
                        {i.filled.map((id) => <div key={id} className="truncate">{firstName(name(id))}</div>)}
                      </div>
                    </div>
                  ))}
                </button>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-xs text-muted-foreground">Toque em um dia para ver os detalhes. Cores: vermelho = ninguém, laranja = faltam pessoas, azul = mínimo atingido, verde = completo.</p>
        </Panel>
      )}

      <div className="space-y-2">
        {day && (
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{fmtLong(day)}</h2>
            <Button size="sm" variant="ghost" onClick={() => setDay(null)}>Ver o mês todo</Button>
          </div>
        )}
        {shown.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Nenhum horário" text={day ? "Não há horários neste dia." : "Crie turnos em Períodos ou vagas em Necessidades."} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {shown.map((i) => <AgendaCard key={i.key} item={i} name={name} open={!!day} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Total({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl bg-card p-3 shadow-soft">
      <div className={cn("font-display text-2xl font-semibold", tone)}>{value}</div>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

function AgendaCard({ item: i, name, open }: { item: AgendaItem; name: (id: string) => string; open: boolean }) {
  const empty = Math.max(0, i.slots - i.filled.length);
  const waiting = i.candidates.filter((id) => !i.filled.includes(id));
  // Presença: só em turno publicado de hoje ou de antes.
  const canMark = i.kind === "escala" && !!i.published && !!i.periodId && !!i.needId && i.date <= today();
  const [marking, setMarking] = useState(open);
  return (
    <Panel className="p-4">
      <div className="flex items-start gap-3">
        <DateBadge date={i.date} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{fmtLong(i.date)}</div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {i.start} – {i.end}</div>
          {i.note && <div className="truncate text-xs text-muted-foreground">{i.note}</div>}
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Pill tone={i.kind === "vaga" ? "accent" : "primary"}>{i.kind === "vaga" ? "Vaga avulsa" : "Escala mensal"}</Pill>
            <Pill tone="muted">{statusLabel(i)}</Pill>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Box label="Preenchidas" value={Math.min(i.filled.length, i.slots)} tone="text-success" />
        <Box label="Vazias" value={empty} tone={empty > 0 ? "text-destructive" : undefined} />
        <Box label={i.kind === "vaga" ? "Candidatos" : "Disponíveis"} value={i.candidates.length} />
      </div>
      {i.min !== undefined && <p className="mt-1 text-xs text-muted-foreground">Mínimo {i.min} · máximo {i.slots}</p>}
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <UserCog className="h-3.5 w-3.5" /> Responsável: {i.responsavelId ? name(i.responsavelId) : "equipe"}
      </div>

      {canMark && marking ? (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Presença</p>
            <Button size="sm" variant="ghost" onClick={() => setMarking(false)}>Fechar</Button>
          </div>
          <ShiftAttendance periodId={i.periodId!} needId={i.needId!} compact />
        </div>
      ) : (
        <>
          <Section title={i.kind === "vaga" ? (i.status === "confirmada" ? "Selecionados" : "Candidatos ativos") : "Escalados"} ids={i.filled} name={name}
            empty={i.kind === "escala" ? "Ainda não há escala publicada para este turno." : "Ninguém ainda."} />
          {canMark && <Button size="sm" className="mt-2 w-full" onClick={() => setMarking(true)}><UserCheck /> Marcar presença</Button>}
        </>
      )}
      {waiting.length > 0 && (
        <Section title={i.kind === "vaga" ? "Outros candidatos" : "Disponíveis (não escalados)"} ids={waiting} name={name} muted />
      )}
    </Panel>
  );
}

function Section({ title, ids, name, empty, muted }: { title: string; ids: string[]; name: (id: string) => string; empty?: string; muted?: boolean }) {
  const { state } = useStore();
  return (
    <div className={cn("mt-3", muted && "opacity-80")}>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title} ({ids.length})</p>
      {ids.length === 0 ? (
        <p className="py-1 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="divide-y">
          {ids.map((id) => (
            <PersonRow key={id} name={name(id)} photoUrl={state.volunteers.find((v) => v.id === id)?.photoUrl} />
          ))}
        </div>
      )}
    </div>
  );
}

function Box({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl bg-secondary px-2 py-2">
      <div className={cn("font-display text-lg font-semibold", tone)}>{value}</div>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
    </div>
  );
}
