import { fmtTimeRange } from "@/lib/time";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Repeat, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { activeVolunteers, attendanceFor, availabilityOf, byPriority, publishedDraw, sortNeeds, sortPeriods } from "@/data/selectors";
import type { AttendanceStatus } from "@/data/types";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/app/common";
import { PersonRow, VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ATTENDANCE_STATUS, DEMO_TODAY, fmtDM, fmtDateTime, fmtWeekday, periodLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/supervisor/presenca")({
  head: () => ({
    meta: [
      { title: "Presença — Painel do Supervisor" },
      { name: "description", content: "Registre presenças, faltas e substituições." },
      { property: "og:title", content: "Presença — Painel do Supervisor" },
      { property: "og:description", content: "Registre presenças, faltas e substituições." },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const { state } = useStore();
  const options = sortPeriods(state.periods)
    .filter((p) => publishedDraw(state, p.id))
    .flatMap((p) => sortNeeds(p.needs).map((n) => ({ p, n })));
  const def = [...options].reverse().find((o) => o.n.date <= DEMO_TODAY) ?? options[0];
  const [key, setKey] = useState(def?.n.id);
  const [subOut, setSubOut] = useState<string | null>(null);
  const sel = options.find((o) => o.n.id === key);

  if (!sel) return <><PageHeader title="Presença" /><EmptyState icon={UserCheck} title="Nenhuma escala publicada" /></>;
  const { p, n } = sel;
  const slot = publishedDraw(state, p.id)!.slots.find((s) => s.needId === n.id);
  const picks = slot?.picks ?? [];
  const outs = state.substitutions.filter((s) => s.needId === n.id);

  const mark = (vid: string, st: AttendanceStatus) => { repo.setAttendance(p.id, n.id, vid, st); toast.success(`Marcado como ${ATTENDANCE_STATUS[st].label.toLowerCase()}`); };

  return (
    <div className="space-y-4">
      <PageHeader title="Presença" subtitle="Selecione a data/horário e registre." />
      <Select value={key} onValueChange={setKey}>
        <SelectTrigger className="h-12 rounded-xl bg-card"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.n.id} value={o.n.id}>{fmtDM(o.n.date)} · {fmtWeekday(o.n.date)} · {fmtTimeRange(o.n)} ({periodLabel(o.p)})</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="space-y-2">
        {picks.map((pk) => {
          const v = state.volunteers.find((x) => x.id === pk.volunteerId)!;
          const rec = attendanceFor(state, n.id, v.id);
          return (
            <Panel key={v.id} className="p-4">
              <div className="flex items-center gap-3">
                <VolunteerAvatar name={v.name} photoUrl={v.photoUrl} size="md" />
                <div className="flex-1">
                  <div className="font-semibold">{v.name}</div>
                  <div className="text-xs text-muted-foreground">{rec ? `${rec.supervisor} · ${fmtDateTime(rec.recordedAt)}` : "Escalado"}</div>
                </div>
                {rec && <Pill tone={ATTENDANCE_STATUS[rec.status].tone}>{ATTENDANCE_STATUS[rec.status].label}</Pill>}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button size="sm" variant={rec?.status === "presente" ? "success" : "outline"} onClick={() => mark(v.id, "presente")}>Presente</Button>
                <Button size="sm" variant={rec?.status === "faltou" ? "destructive" : "outline"} onClick={() => mark(v.id, "faltou")}>Faltou</Button>
                <Button size="sm" variant="outline" onClick={() => setSubOut(v.id)}><Repeat /> Substituir</Button>
              </div>
              <button className={cn("mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline")} onClick={() => mark(v.id, "cancelado")}>Marcar como cancelado</button>
            </Panel>
          );
        })}
      </div>

      {outs.length > 0 && (
        <Panel>
          <h3 className="mb-2 font-semibold">Substituições nesta data</h3>
          {outs.map((s) => (
            <p key={s.id} className="text-sm text-muted-foreground">
              <b className="text-foreground">{state.volunteers.find((v) => v.id === s.outId)?.name}</b> → <b className="text-foreground">{state.volunteers.find((v) => v.id === s.inId)?.name}</b> · {s.reason} · {fmtDateTime(s.at)} · {s.supervisor}
            </p>
          ))}
        </Panel>
      )}

      <SubstituteDialog key={subOut ?? ""} outId={subOut} periodId={p.id} needId={n.id} assigned={picks.map((x) => x.volunteerId)} onClose={() => setSubOut(null)} />
    </div>
  );
}

function SubstituteDialog({ outId, periodId, needId, assigned, onClose }: { outId: string | null; periodId: string; needId: string; assigned: string[]; onClose: () => void }) {
  const { state } = useStore();
  const [inId, setInId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const out = state.volunteers.find((v) => v.id === outId);
  const all = activeVolunteers(state).filter((v) => !assigned.includes(v.id));
  const hasData = state.availabilities.some((a) => a.periodId === periodId);
  const eligible = (hasData ? all.filter((v) => availabilityOf(state, periodId, v.id, needId) === "disponivel") : all).sort(byPriority);

  return (
    <Dialog open={!!outId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Substituir {out?.name}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Ordenado pela prioridade do sorteio (menos escalas recentes primeiro).</p>
        <div className="max-h-64 divide-y overflow-y-auto">
          {eligible.length === 0 && <p className="py-3 text-sm text-muted-foreground">Nenhum voluntário elegível disponível.</p>}
          {eligible.map((v) => (
            <button key={v.id} onClick={() => setInId(v.id)} className={cn("w-full rounded-xl px-2 text-left", inId === v.id && "bg-primary-soft")}>
              <PersonRow name={v.name} photoUrl={v.photoUrl} sub={`${v.recent3m} recentes · ${v.last12m} em 12 meses`} />
            </button>
          ))}
        </div>
        <Textarea placeholder="Motivo da substituição" value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl" />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!inId || !reason.trim()} onClick={() => { repo.substitute(periodId, needId, outId!, inId!, reason.trim()); toast.success("Substituição registrada"); onClose(); }}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
