import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { addDays, format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarSearch, Check, ChevronLeft, ChevronRight, Clock, HandHeart, X } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { activeApplicants, availableDays, fillState, myApplication, sortOpportunities } from "@/data/selectors";
import { DateBadge, EmptyState, Notice, PageHeader, Panel, Pill } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEMO_TODAY, fmtDM, fmtLong, toDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/voluntario/vagas")({
  head: () => ({
    meta: [
      { title: "Vagas — Área do Voluntário" },
      { name: "description", content: "Marque seus dias disponíveis e candidate-se às escalas compatíveis." },
      { property: "og:title", content: "Vagas — Área do Voluntário" },
      { property: "og:description", content: "Marque seus dias disponíveis e candidate-se às escalas." },
    ],
  }),
  component: VagasPage,
});

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function VagasPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Vagas" subtitle="Disponibilidade não é candidatura: primeiro marque seus dias, depois escolha onde quer servir." />
      <Tabs defaultValue="vagas">
        <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl">
          <TabsTrigger value="semana" className="rounded-lg">Minha semana</TabsTrigger>
          <TabsTrigger value="vagas" className="rounded-lg">Escalas disponíveis</TabsTrigger>
        </TabsList>
        <TabsContent value="semana" className="mt-4"><WeekAvailability /></TabsContent>
        <TabsContent value="vagas" className="mt-4"><AvailableScales /></TabsContent>
      </Tabs>
    </div>
  );
}

function WeekAvailability() {
  const { state } = useStore();
  const meId = state.session!.userId;
  const [offset, setOffset] = useState(0);
  const weekStart = addDays(startOfWeek(toDate(DEMO_TODAY), { weekStartsOn: 1 }), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => iso(addDays(weekStart, i)));
  const saved = availableDays(state, meId);
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => setSel(days.filter((d) => saved.has(d))), [offset]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = sel.length !== days.filter((d) => saved.has(d)).length || sel.some((d) => !saved.has(d));

  return (
    <div className="space-y-3">
      <Panel className="flex items-center justify-between p-3">
        <Button variant="ghost" size="icon" disabled={offset === 0} onClick={() => setOffset((o) => o - 1)} aria-label="Semana anterior"><ChevronLeft /></Button>
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Semana</div>
          <div className="font-display font-semibold">{fmtDM(days[0])} a {fmtDM(days[6])}</div>
        </div>
        <Button variant="ghost" size="icon" disabled={offset >= 11} onClick={() => setOffset((o) => o + 1)} aria-label="Próxima semana"><ChevronRight /></Button>
      </Panel>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => setSel(days)}>Selecionar todos</Button>
        <Button variant="outline" onClick={() => setSel([])}>Desmarcar todos</Button>
      </div>
      <div className="space-y-2">
        {days.map((d) => {
          const on = sel.includes(d);
          return (
            <button
              key={d}
              onClick={() => setSel((s) => (on ? s.filter((x) => x !== d) : [...s, d]))}
              className={cn("flex w-full items-center gap-3 rounded-2xl border-2 bg-card p-3 text-left transition", on ? "border-success bg-success-soft" : "border-border")}
            >
              <DateBadge date={d} className="h-11 w-11" />
              <span className="flex-1 font-semibold capitalize">{format(toDate(d), "EEEE", { locale: ptBR })}</span>
              <span className={cn("grid h-7 w-7 place-items-center rounded-full border-2", on ? "border-success bg-success text-success-foreground" : "border-input")}>
                {on && <Check className="h-4 w-4" />}
              </span>
            </button>
          );
        })}
      </div>
      <Button size="lg" className="w-full" disabled={!dirty} onClick={() => { repo.setWeekAvailability(meId, days, sel); toast.success("Disponibilidade da semana salva"); }}>
        Salvar semana
      </Button>
    </div>
  );
}

function AvailableScales() {
  const { state } = useStore();
  const meId = state.session!.userId;
  const days = availableDays(state, meId);
  const list = sortOpportunities(state.opportunities).filter((o) => o.date >= DEMO_TODAY && days.has(o.date));

  if (days.size === 0)
    return <EmptyState icon={CalendarSearch} title="Marque seus dias primeiro" text="Vá em “Minha semana” e marque os dias em que você está disponível." />;
  if (list.length === 0)
    return <EmptyState icon={HandHeart} title="Nenhuma escala compatível" text="Ainda não há necessidades nos dias em que você marcou disponibilidade." />;

  return (
    <div className="space-y-3">
      {list.map((o) => {
        const count = activeApplicants(state, o.id).length;
        const fill = fillState(count, o);
        const mine = myApplication(state, o.id, meId);
        const open = o.status === "aberta";
        const applied = mine?.status === "candidatado";
        const full = count >= o.max;
        return (
          <Panel key={o.id} className="p-4">
            <div className="flex items-start gap-3">
              <DateBadge date={o.date} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{fmtLong(o.date)}</div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {o.start} – {o.end}</div>
                {o.note && <div className="truncate text-xs text-muted-foreground">{o.note}</div>}
              </div>
              <Pill tone={fill.tone}>{fill.label}</Pill>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>Mín. <b>{o.min}</b></span>
              <span>Máx. <b>{o.max}</b></span>
              <span>Candidatos <b>{count}</b></span>
            </div>
            <div className="mt-3">
              {mine?.status === "selecionado" && <Notice tone="success" icon={Check}>Selecionado</Notice>}
              {mine?.status === "nao_selecionado" && <Notice tone="muted" icon={X}>Não selecionado</Notice>}
              {open && applied && (
                <div className="flex items-center gap-2">
                  <div className="flex h-11 flex-1 items-center justify-center rounded-xl bg-success-soft font-semibold text-success">✓ Candidatado</div>
                  <Button variant="outline" className="h-11" onClick={() => { const r = repo.cancelApplication(o.id, meId); r.ok ? toast("Candidatura cancelada") : toast.error(r.error); }}>Cancelar</Button>
                </div>
              )}
              {open && !applied && (
                <Button size="lg" className="w-full" disabled={full} onClick={() => { const r = repo.applyTo(o.id, meId); r.ok ? toast.success("Candidatura enviada!") : toast.error(r.error); }}>
                  {full ? "Vagas esgotadas" : "Quero participar"}
                </Button>
              )}
              {!open && !mine && <p className="text-sm text-muted-foreground">Seleção encerrada.</p>}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
