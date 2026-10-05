import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarX2, ChevronDown, Lock } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { activeVolunteers, availabilityOf, availabilityPeriod, byPriority, hasResponded, sortNeeds } from "@/data/selectors";
import { ConfirmDialog, DateBadge, EmptyState, PageHeader, Panel, Pill } from "@/components/app/common";
import { PersonRow } from "@/components/app/VolunteerAvatar";
import { PeriodSelect } from "@/components/app/PeriodSelect";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PERIOD_STATUS, fmtDM, fmtWeekday } from "@/lib/format";

export const Route = createFileRoute("/supervisor/disponibilidades")({
  head: () => ({
    meta: [
      { title: "Disponibilidades — Painel do Supervisor" },
      { name: "description", content: "Acompanhe quem respondeu e quem está disponível em cada data." },
      { property: "og:title", content: "Disponibilidades — Painel do Supervisor" },
      { property: "og:description", content: "Acompanhe quem respondeu e quem está disponível." },
    ],
  }),
  component: AvailabilityOverview,
});

function AvailabilityOverview() {
  const { state } = useStore();
  const candidates = state.periods.filter((p) => p.status !== "rascunho");
  const [pid, setPid] = useState(availabilityPeriod(state)?.id ?? candidates[0]?.id);
  const [confirm, setConfirm] = useState(false);
  const period = state.periods.find((p) => p.id === pid);
  if (!period) return <EmptyState icon={CalendarX2} title="Nenhum período com disponibilidade" />;

  const active = activeVolunteers(state);
  const responded = active.filter((v) => hasResponded(state, period.id, v.id));
  const pending = active.filter((v) => !hasResponded(state, period.id, v.id));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Disponibilidades"
        subtitle={<span className="inline-flex items-center gap-2">Prazo: {fmtDM(period.deadline)} <Pill tone={PERIOD_STATUS[period.status].tone}>{PERIOD_STATUS[period.status].label}</Pill></span>}
        actions={
          <>
            <PeriodSelect periods={candidates} value={pid} onChange={setPid} />
            {period.status === "aberta" && <Button variant="outline" onClick={() => setConfirm(true)}><Lock /> Encerrar</Button>}
          </>
        }
      />

      <Tabs defaultValue="datas">
        <TabsList className="h-11 rounded-xl">
          <TabsTrigger value="datas" className="rounded-lg">Por data</TabsTrigger>
          <TabsTrigger value="respostas" className="rounded-lg">Respostas ({responded.length}/{active.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="datas" className="mt-4 space-y-3">
          {sortNeeds(period.needs).map((n) => {
            const avail = active.filter((v) => availabilityOf(state, period.id, v.id, n.id) === "disponivel").sort(byPriority);
            const unavail = active.filter((v) => availabilityOf(state, period.id, v.id, n.id) === "indisponivel").length;
            const none = active.length - avail.length - unavail;
            return (
              <Collapsible key={n.id}>
                <Panel className="p-4">
                  <div className="flex items-center gap-3">
                    <DateBadge date={n.date} />
                    <div className="flex-1">
                      <div className="font-semibold">{fmtDM(n.date)} · {fmtWeekday(n.date)}</div>
                      <div className="text-sm text-muted-foreground">{n.shift} · {n.slots} vagas</div>
                    </div>
                    {avail.length < n.slots && <Pill tone="destructive">Insuficiente</Pill>}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <Count n={avail.length} label="disponíveis" cls="bg-success-soft text-success" />
                    <Count n={unavail} label="indisponíveis" cls="bg-destructive-soft text-destructive" />
                    <Count n={none} label="sem resposta" cls="bg-warning-soft text-accent-foreground" />
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="mt-2 w-full">Ver disponíveis <ChevronDown /></Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 divide-y border-t">
                      {avail.length === 0 && <p className="py-3 text-sm text-muted-foreground">Ninguém disponível.</p>}
                      {avail.map((v) => <PersonRow key={v.id} name={v.name} photoUrl={v.photoUrl} sub={`${v.recent3m} escalas recentes · ${v.last12m} em 12 meses`} />)}
                    </div>
                  </CollapsibleContent>
                </Panel>
              </Collapsible>
            );
          })}
        </TabsContent>
        <TabsContent value="respostas" className="mt-4 grid gap-4 md:grid-cols-2">
          <Panel>
            <h3 className="mb-2 flex items-center justify-between font-semibold">Ainda não responderam <Pill tone="warning">{pending.length}</Pill></h3>
            <div className="divide-y">
              {pending.length === 0 && <p className="py-3 text-sm text-muted-foreground">Todos responderam. 🎉</p>}
              {pending.map((v) => <PersonRow key={v.id} name={v.name} photoUrl={v.photoUrl} sub={v.phone} />)}
            </div>
          </Panel>
          <Panel>
            <h3 className="mb-2 flex items-center justify-between font-semibold">Responderam <Pill tone="success">{responded.length}</Pill></h3>
            <div className="divide-y">
              {responded.map((v) => {
                const c = period.needs.filter((n) => availabilityOf(state, period.id, v.id, n.id) === "disponivel").length;
                return <PersonRow key={v.id} name={v.name} photoUrl={v.photoUrl} sub={`Disponível em ${c} de ${period.needs.length} datas`} />;
              })}
            </div>
          </Panel>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Encerrar disponibilidade?"
        description={`${pending.length} voluntário(s) ainda não responderam. Após encerrar, as respostas não poderão mais ser alteradas.`}
        confirmLabel="Encerrar"
        onConfirm={() => { repo.setPeriodStatus(period.id, "encerrada"); toast.success("Disponibilidade encerrada"); }}
      />
    </div>
  );
}

function Count({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div className={`rounded-xl px-2 py-2 ${cls}`}>
      <div className="font-display text-xl font-semibold">{n}</div>
      <div className="text-[11px] font-semibold">{label}</div>
    </div>
  );
}
