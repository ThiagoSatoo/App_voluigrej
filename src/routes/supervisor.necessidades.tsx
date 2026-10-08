import { TimeRangeFields } from "@/components/app/TimeRangeFields";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { activeApplicants, byPriority, fillState, sortOpportunities } from "@/data/selectors";
import type { Opportunity } from "@/data/types";
import { ConfirmDialog, DateBadge, EmptyState, Notice, PageHeader, Panel, Pill } from "@/components/app/common";
import { PersonRow } from "@/components/app/VolunteerAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtLong } from "@/lib/format";

export const Route = createFileRoute("/supervisor/necessidades")({
  head: () => ({
    meta: [
      { title: "Necessidades — Painel do Supervisor" },
      { name: "description", content: "Crie necessidades por data e horário e confirme os voluntários selecionados." },
      { property: "og:title", content: "Necessidades — Painel do Supervisor" },
      { property: "og:description", content: "Crie necessidades e confirme a seleção de voluntários." },
    ],
  }),
  component: NeedsPage,
});

function NeedsPage() {
  const { state } = useStore();
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const list = sortOpportunities(state.opportunities);

  return (
    <div>
      <PageHeader title="Necessidades" subtitle="Crie apenas os dias em que precisa de voluntários." actions={<Button onClick={() => setCreating(true)}><Plus /> Nova necessidade</Button>} />
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Pill tone="destructive">Abaixo do mínimo</Pill>
        <Pill tone="success">Mínimo atingido</Pill>
        <Pill tone="info">Máximo atingido</Pill>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhuma necessidade" text="Crie a primeira necessidade informando data e horário." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((o) => {
            const apps = activeApplicants(state, o.id);
            const fill = fillState(apps.length, o);
            const confirmed = o.status === "confirmada";
            return (
              <Panel key={o.id} className={`border-l-4 p-4 ${fill.tone === "destructive" ? "border-l-destructive" : fill.tone === "info" ? "border-l-info" : "border-l-success"}`}>
                <div className="flex items-start gap-3">
                  <DateBadge date={o.date} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{fmtLong(o.date)}</div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {o.start} – {o.end}</div>
                    {o.note && <div className="mt-0.5 truncate text-xs text-muted-foreground">{o.note}</div>}
                  </div>
                  <Pill tone={fill.tone}>{fill.label}</Pill>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Box label="Mínimo" value={o.min} />
                  <Box label="Máximo" value={o.max} />
                  <Box label={confirmed ? "Selecionados" : "Candidatos"} value={apps.length} />
                </div>
                {confirmed ? (
                  <div className="mt-3 space-y-2">
                    <Notice tone="success" icon={CheckCircle2}>Seleção confirmada.</Notice>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setReviewing(o.id)}><Users /> Ver resultado</Button>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <Button className="flex-1" size="sm" disabled={apps.length === 0} onClick={() => setReviewing(o.id)}><Users /> Revisar seleção</Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRemoving(o.id)} aria-label="Excluir"><Trash2 /></Button>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
      <NewNeedDialog open={creating} onClose={() => setCreating(false)} />
      {reviewing && <SelectionDialog key={reviewing} opportunity={state.opportunities.find((o) => o.id === reviewing)!} onClose={() => setReviewing(null)} />}
      <ConfirmDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} title="Excluir necessidade?" description="As candidaturas desta necessidade também serão removidas." confirmLabel="Excluir" onConfirm={() => { if (removing) repo.removeOpportunity(removing); toast.success("Necessidade excluída"); }} />
    </div>
  );
}

function Box({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-secondary px-2 py-2">
      <div className="font-display text-lg font-semibold">{value}</div>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

function NewNeedDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [date, setDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [min, setMin] = useState(2);
  const [max, setMax] = useState(4);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const save = () => {
    const r = repo.createOpportunity({ date, start, end, min, max, note });
    if (!r.ok) { setError(r.error); return; }
    toast.success("Necessidade criada");
    setDate(""); setNote(""); setError("");
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Nova necessidade</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl" /></div>
          <TimeRangeFields start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Mínimo</Label><Input type="number" min={1} value={min} onChange={(e) => setMin(Number(e.target.value))} className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>Máximo</Label><Input type="number" min={1} value={max} onChange={(e) => setMax(Number(e.target.value))} className="h-11 rounded-xl" /></div>
          </div>
          <div className="space-y-1.5"><Label>Observação (opcional)</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} className="rounded-xl" placeholder="Ex.: Culto de domingo" /></div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Criar necessidade</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SelectionDialog({ opportunity: o, onClose }: { opportunity: Opportunity; onClose: () => void }) {
  const { state } = useStore();
  const confirmed = o.status === "confirmada";
  // Priority: fewer in 3 months, then 12 months, then random (fixed once per review)
  const [ranked] = useState(() =>
    state.applications
      .filter((a) => a.opportunityId === o.id && (confirmed ? a.status === "selecionado" || a.status === "nao_selecionado" : a.status === "candidatado"))
      .map((a) => ({ a, v: state.volunteers.find((x) => x.id === a.volunteerId)!, rand: Math.random() }))
      .filter((x) => x.v)
      .sort((x, y) => byPriority(x.v, y.v) || x.rand - y.rand),
  );
  const [selected, setSelected] = useState<string[]>(() => ranked.slice(0, o.max).map((r) => r.v.id));
  const [ask, setAsk] = useState(false);
  const over = ranked.length > o.max;

  const tiebreak = (i: number) => {
    const cur = ranked[i].v;
    const others = ranked.filter((r, j) => j !== i && r.v.recent3m === cur.recent3m);
    if (others.length === 0) return "Escalas recentes";
    return others.some((r) => r.v.last12m === cur.last12m) ? "Aleatório" : "Últimos 12 meses";
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto overflow-x-hidden rounded-2xl [&>*]:min-w-0">
        <DialogHeader><DialogTitle className="font-display">{confirmed ? "Resultado da seleção" : "Revisar seleção"}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{fmtLong(o.date)} · {o.start}–{o.end} · mín. {o.min} / máx. {o.max}</p>
        {!confirmed && over && (
          <Notice tone="accent" icon={AlertTriangle}>
            Há {ranked.length} candidatos para {o.max} vagas. Sugerimos os {o.max} com menos escalas recentes (empate: 12 meses; depois aleatório).
          </Notice>
        )}
        <div className="divide-y">
          {ranked.map((r, i) => {
            const isSel = confirmed ? r.a.status === "selecionado" : selected.includes(r.v.id);
            return (
              <label key={r.v.id} className="flex cursor-pointer items-center gap-3">
                {!confirmed && (
                  <Checkbox
                    checked={isSel}
                    onCheckedChange={(c) => setSelected((s) => (c ? [...s, r.v.id] : s.filter((x) => x !== r.v.id)))}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <PersonRow
                    name={r.v.name}
                    photoUrl={r.v.photoUrl}
                    sub={`#${i + 1} · ${r.v.recent3m} em 3m · ${r.v.last12m} em 12m · ${tiebreak(i)}`}
                    right={<Pill tone={isSel ? "success" : "muted"}>{isSel ? "Selecionado" : "Não selecionado"}</Pill>}
                  />
                </div>
              </label>
            );
          })}
        </div>
        {!confirmed && (
          <>
            <p className={`text-sm font-semibold ${selected.length < o.min || selected.length > o.max ? "text-destructive" : "text-success"}`}>
              {selected.length} selecionado(s) · mínimo {o.min}, máximo {o.max}
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button disabled={selected.length === 0 || selected.length > o.max} onClick={() => setAsk(true)}>Confirmar seleção</Button>
            </DialogFooter>
          </>
        )}
        <ConfirmDialog
          open={ask}
          onOpenChange={setAsk}
          title="Confirmar seleção?"
          description={`${selected.length} voluntário(s) serão marcados como "Selecionado" e os demais como "Não selecionado".${selected.length < o.min ? " Atenção: abaixo do mínimo." : ""}`}
          confirmLabel="Confirmar"
          onConfirm={() => { repo.confirmSelection(o.id, selected); toast.success("Seleção confirmada"); onClose(); }}
        />
      </DialogContent>
    </Dialog>
  );
}
