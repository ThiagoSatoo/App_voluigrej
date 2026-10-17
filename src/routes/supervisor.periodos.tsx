import { TimeRangeFields } from "@/components/app/TimeRangeFields";
import { fmtTimeRange } from "@/lib/time";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { ResponsavelSelect } from "@/components/app/ResponsavelSelect";
import { act } from "@/lib/act";
import { sortNeeds, sortPeriods } from "@/data/selectors";
import type { Period, PeriodStatus } from "@/data/types";
import { ConfirmDialog, DateBadge, EmptyState, PageHeader, Panel, Pill } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTHS, PERIOD_STATUS, fmtDMY, fmtWeekday, periodLabel, today } from "@/lib/format";

export const Route = createFileRoute("/supervisor/periodos")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Períodos — Painel do Supervisor" },
      { name: "description", content: "Crie períodos mensais e defina as necessidades de cada data e horário." },
      { property: "og:title", content: "Períodos — Painel do Supervisor" },
      { property: "og:description", content: "Crie períodos mensais e defina as necessidades." },
    ],
  }),
  component: PeriodsPage,
});

const NEXT_ACTION: Partial<Record<PeriodStatus, { label: string; to: PeriodStatus; confirm: string }>> = {
  rascunho: { label: "Abrir disponibilidade", to: "aberta", confirm: "Os voluntários poderão informar disponibilidade para este período." },
  aberta: { label: "Encerrar disponibilidade", to: "encerrada", confirm: "Após encerrar, os voluntários não poderão mais alterar suas respostas." },
  publicada: { label: "Encerrar período", to: "encerrado", confirm: "O período será arquivado como encerrado." },
};

function PeriodsPage() {
  const { state } = useStore();
  const [creating, setCreating] = useState(false);
  const periods = sortPeriods(state.periods);
  const [selected, setSelected] = useState<string>(periods.find((p) => p.status !== "encerrado")?.id ?? periods[0]?.id);
  const current = state.periods.find((p) => p.id === selected);

  return (
    <div>
      <PageHeader title="Períodos" subtitle="Cada mês tem suas próprias datas, horários e vagas." actions={<Button onClick={() => setCreating(true)}><CalendarPlus /> Novo período</Button>} />
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
        {periods.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className={`shrink-0 rounded-2xl border px-4 py-3 text-left transition ${p.id === selected ? "border-primary bg-primary-soft" : "bg-card"}`}
          >
            <div className="font-display font-semibold">{periodLabel(p)}</div>
            <div className="mt-1"><Pill tone={PERIOD_STATUS[p.status].tone}>{PERIOD_STATUS[p.status].label}</Pill></div>
          </button>
        ))}
      </div>
      {current ? <PeriodDetail period={current} /> : <EmptyState icon={CalendarPlus} title="Nenhum período" text="Crie o primeiro período mensal." />}
      <NewPeriodDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function PeriodDetail({ period }: { period: Period }) {
  const [confirm, setConfirm] = useState(false);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [slots, setSlots] = useState(4);
  const editable = period.status === "rascunho" || period.status === "aberta";
  const action = NEXT_ACTION[period.status];
  const total = period.needs.reduce((s, n) => s + n.slots, 0);

  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const add = async () => {
    if (!date) { toast.error("Escolha uma data."); return; }
    const [y, m] = date.split("-").map(Number);
    if (y !== period.year || m !== period.month) { toast.error(`A data precisa estar em ${periodLabel(period)}.`); return; }
    const result = await repo.addNeed(period.id, { date, start, end, slots, responsavelId: responsavelId ?? undefined });
    if (!result.ok) { toast.error(result.error); return; }
    setDate("");
    toast.success("Necessidade adicionada");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold uppercase">{periodLabel(period)}</h2>
              <p className="text-sm text-muted-foreground">{period.needs.length} datas/horários · {total} vagas</p>
            </div>
            <Pill tone={PERIOD_STATUS[period.status].tone}>{PERIOD_STATUS[period.status].label}</Pill>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Abertura</Label>
              <Input type="date" disabled={!editable} value={period.openDate} onChange={(e) => e.target.value && act(repo.updatePeriod(period.id, { openDate: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prazo final</Label>
              <Input type="date" disabled={!editable} value={period.deadline} onChange={(e) => e.target.value && act(repo.updatePeriod(period.id, { deadline: e.target.value }))} className="rounded-xl" />
            </div>
          </div>
          {action && (
            <Button className="mt-4 w-full sm:w-auto" onClick={() => setConfirm(true)} disabled={action.to === "aberta" && period.needs.length === 0}>
              {action.label}
            </Button>
          )}
          {period.status === "encerrada" && <p className="mt-3 text-sm text-muted-foreground">Próximo passo: realizar o sorteio na área “Sorteio”.</p>}
        </Panel>

        <h3 className="font-semibold">Necessidades</h3>
        {period.needs.length === 0 && <EmptyState icon={CalendarPlus} title="Sem necessidades" text="Adicione as datas, horários e quantidade de voluntários." />}
        <div className="space-y-2">
          {sortNeeds(period.needs).map((n) => (
            <Panel key={n.id} className="flex flex-wrap items-center gap-3 p-3">
              <DateBadge date={n.date} className="h-12 w-12" />
              <div className="min-w-32 flex-1">
                <div className="font-semibold">{fmtDMY(n.date)}</div>
                <div className="text-xs text-muted-foreground">{fmtWeekday(n.date)} · {fmtTimeRange(n)}</div>
              </div>
              {editable ? (
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => act(repo.updateNeedSlots(period.id, n.id, n.slots - 1))}><Minus /></Button>
                  <span className="w-14 text-center text-sm font-bold">{n.slots} vol.</span>
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => act(repo.updateNeedSlots(period.id, n.id, n.slots + 1))}><Plus /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => act(repo.removeNeed(period.id, n.id), "Turno removido")} aria-label="Remover"><Trash2 /></Button>
                </div>
              ) : (
                <Pill tone="primary">{n.slots} voluntários</Pill>
              )}
              <div className="flex w-full flex-wrap items-center gap-2 border-t pt-2">
                <span className="text-xs font-medium text-muted-foreground">Responsável</span>
                <ResponsavelSelect className="h-9 min-w-48 flex-1" value={n.responsavelId} onChange={(id) => act(repo.setNeedResponsavel(n.id, id), "Responsável atualizado")} />
                {period.needs.filter((x) => x.date === n.date).length > 1 && (
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => act(repo.setDayResponsavel(period.id, n.date, n.responsavelId ?? null), "Aplicado a todos os turnos do dia")}>
                    Usar no dia todo
                  </Button>
                )}
              </div>
            </Panel>
          ))}
        </div>
      </div>

      {editable && (
        <Panel className="h-fit space-y-3">
          <h3 className="font-semibold">Adicionar necessidade</h3>
          <div className="space-y-1.5"><Label className="text-xs">Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl" /></div>
          <TimeRangeFields start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
          <div className="space-y-1.5"><Label className="text-xs">Voluntários necessários</Label><Input type="number" min={1} value={slots} onChange={(e) => setSlots(Math.max(1, Number(e.target.value)))} className="rounded-xl" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Responsável (opcional)</Label><ResponsavelSelect value={responsavelId ?? undefined} onChange={setResponsavelId} /></div>
          <Button className="w-full" onClick={add}><Plus /> Adicionar</Button>
        </Panel>
      )}

      {action && (
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title={`${action.label}?`}
          description={action.confirm}
          confirmLabel={action.label}
          onConfirm={() => { act(repo.setPeriodStatus(period.id, action.to), PERIOD_STATUS[action.to].label); }}
        />
      )}
    </div>
  );
}

function NewPeriodDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Sugere o mês seguinte, com disponibilidade aberta no mês atual.
  const [defaults] = useState(() => {
    const [y, m] = today().split("-").map(Number);
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    const cur = `${y}-${String(m).padStart(2, "0")}`;
    return { month: String(nm), year: String(ny), openDate: today(), deadline: `${cur}-25` < today() ? today() : `${cur}-25` };
  });
  const [month, setMonth] = useState(defaults.month);
  const [year, setYear] = useState(defaults.year);
  const [openDate, setOpenDate] = useState(defaults.openDate);
  const [deadline, setDeadline] = useState(defaults.deadline);
  const create = async () => {
    const r = await repo.createPeriod({ month: Number(month), year: Number(year), openDate, deadline });
    if (!r.ok) { toast.error(r.error); return; }
    toast.success("Período criado como rascunho");
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Novo período mensal</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Mês</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Ano</Label><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="rounded-xl" /></div>
          <div className="space-y-1.5"><Label>Abertura</Label><Input type="date" value={openDate} onChange={(e) => setOpenDate(e.target.value)} className="rounded-xl" /></div>
          <div className="space-y-1.5"><Label>Prazo final</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="rounded-xl" /></div>
        </div>
        <p className="text-xs text-muted-foreground">O período começa como <b>Rascunho</b>. Adicione as necessidades e depois abra a disponibilidade.</p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={create}>Criar período</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
