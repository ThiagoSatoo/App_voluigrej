import { fmtTimeRange } from "@/lib/time";
import { useState } from "react";
import { Mail, Phone, Repeat, UserCheck } from "lucide-react";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { act } from "@/lib/act";
import {
  activeVolunteers,
  attendanceFor,
  availabilityOf,
  backupsOf,
  byPriority,
  fixedCandidates,
  personName,
  publishedSlotFor,
  sortNeeds,
  sortPeriods,
} from "@/data/selectors";
import type { AttendanceStatus } from "@/data/types";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/app/common";
import { PersonRow, VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ATTENDANCE_STATUS,
  today,
  fmtDM,
  fmtDateTime,
  fmtWeekday,
  periodLabel,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export function AttendanceManager({ scope = "all" }: { scope?: "all" | "mine" }) {
  const { state } = useStore();
  const options = sortPeriods(state.periods)
    .reverse()
    .flatMap((p) => sortNeeds(p.needs).map((n) => ({ p, n })))
    .filter((o) => publishedSlotFor(state, o.n.id))
    .filter((o) => scope === "all" || o.n.responsavelId === state.session?.userId);
  // Padrão: o turno de hoje (ou o próximo); se não houver, o mais recente.
  const def = options.find((o) => o.n.date >= today()) ?? options[options.length - 1];
  const [key, setKey] = useState(def?.n.id);
  const sel = options.find((o) => o.n.id === key);

  if (!sel)
    return (
      <>
        <PageHeader title="Presença" />
        <EmptyState
          icon={UserCheck}
          title="Nenhuma escala publicada"
          text={
            scope === "mine"
              ? "Quando a coordenação publicar uma escala com turnos sob sua responsabilidade, eles aparecerão aqui."
              : undefined
          }
        />
      </>
    );
  const { p, n } = sel;
  const resp = personName(state, n.responsavelId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Presença"
        subtitle={resp ? `Responsável pelo turno: ${resp}` : "Selecione a data/horário e registre."}
      />
      <Select value={key} onValueChange={setKey}>
        <SelectTrigger className="h-12 rounded-xl bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.n.id} value={o.n.id}>
              {fmtDM(o.n.date)} · {fmtWeekday(o.n.date)} · {fmtTimeRange(o.n)} ({periodLabel(o.p)})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ShiftAttendance periodId={p.id} needId={n.id} />
    </div>
  );
}

/**
 * Presença de um turno publicado: Presente / Faltou / Substituir para cada escalado.
 * Usado na Agenda da coordenação, na lista acima e na aba Turnos do responsável.
 * Quem pode gravar é decidido pelo banco (RLS e a função substitute).
 */
export function ShiftAttendance({
  periodId,
  needId,
  compact,
  substituteOnly,
}: {
  periodId: string;
  needId: string;
  compact?: boolean;
  substituteOnly?: boolean;
}) {
  const { state } = useStore();
  const [subOut, setSubOut] = useState<string | null>(null);
  const slot = publishedSlotFor(state, needId)?.slot;
  const picks = slot?.picks ?? [];
  const outs = state.substitutions.filter((s) => s.needId === needId);
  const mark = (vid: string, st: AttendanceStatus) =>
    act(
      repo.setAttendance(periodId, needId, vid, st),
      `Marcado como ${ATTENDANCE_STATUS[st].label.toLowerCase()}`,
    );

  if (picks.length === 0)
    return <p className="py-1 text-sm text-muted-foreground">Ninguém escalado neste turno.</p>;

  return (
    <div className="space-y-2">
      {picks.map((pk) => {
        const v = state.volunteers.find((x) => x.id === pk.volunteerId);
        if (!v) return null;
        const rec = attendanceFor(state, needId, v.id);
        if (substituteOnly && rec?.status === "substituido") return null;
        return (
          <div
            key={v.id}
            className={cn(
              "min-w-0",
              compact ? "rounded-xl border p-3" : "rounded-2xl border bg-card p-4 shadow-soft",
            )}
          >
            <div className="flex items-center gap-3">
              <VolunteerAvatar name={v.name} photoUrl={v.photoUrl} size={compact ? "sm" : "md"} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{v.name}</div>
                <div className="text-xs text-muted-foreground">
                  {rec ? `${rec.supervisor} · ${fmtDateTime(rec.recordedAt)}` : "Escalado"}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {v.phone && (
                    <a
                      href={`tel:${v.phone.replace(/[^\d+]/g, "")}`}
                      className="inline-flex items-center gap-1 font-medium text-primary"
                    >
                      <Phone className="h-3 w-3" />
                      {v.phone}
                    </a>
                  )}
                  {v.email && (
                    <a
                      href={`mailto:${v.email}`}
                      className="inline-flex min-w-0 items-center gap-1 break-all font-medium text-primary"
                    >
                      <Mail className="h-3 w-3 shrink-0" />
                      {v.email}
                    </a>
                  )}
                </div>
              </div>
              {rec && (
                <Pill tone={ATTENDANCE_STATUS[rec.status].tone}>
                  {ATTENDANCE_STATUS[rec.status].label}
                </Pill>
              )}
            </div>
            {substituteOnly ? (
              // Turno futuro: só a troca (a presença é marcada no dia).
              <Button
                size="sm"
                variant={rec?.status === "cancelado" ? "default" : "outline"}
                className="mt-3 w-full"
                onClick={() => setSubOut(v.id)}
              >
                <Repeat /> {rec?.status === "cancelado" ? "Escolher substituto" : "Substituir"}
              </Button>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant={rec?.status === "presente" ? "success" : "outline"}
                    onClick={() => mark(v.id, "presente")}
                  >
                    Presente
                  </Button>
                  <Button
                    size="sm"
                    variant={rec?.status === "faltou" ? "destructive" : "outline"}
                    onClick={() => mark(v.id, "faltou")}
                  >
                    Faltou
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="px-2"
                    onClick={() => setSubOut(v.id)}
                  >
                    <Repeat /> Substituir
                  </Button>
                </div>
                <button
                  className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => mark(v.id, "cancelado")}
                >
                  Marcar como cancelado
                </button>
              </>
            )}
          </div>
        );
      })}

      {outs.length > 0 && (
        <Panel className={compact ? "p-3" : undefined}>
          <h3 className="mb-2 font-semibold">Substituições nesta data</h3>
          {outs.map((s) => (
            <p key={s.id} className="text-sm text-muted-foreground">
              <b className="text-foreground">
                {state.volunteers.find((v) => v.id === s.outId)?.name}
              </b>{" "}
              →{" "}
              <b className="text-foreground">
                {state.volunteers.find((v) => v.id === s.inId)?.name}
              </b>{" "}
              · {s.reason} · {fmtDateTime(s.at)} · {s.supervisor}
            </p>
          ))}
        </Panel>
      )}

      <SubstituteDialog
        key={subOut ?? ""}
        outId={subOut}
        periodId={periodId}
        needId={needId}
        assigned={picks.map((x) => x.volunteerId)}
        onClose={() => setSubOut(null)}
      />
    </div>
  );
}

function SubstituteDialog({
  outId,
  periodId,
  needId,
  assigned,
  onClose,
}: {
  outId: string | null;
  periodId: string;
  needId: string;
  assigned: string[];
  onClose: () => void;
}) {
  const { state } = useStore();
  const [inId, setInId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const out = state.volunteers.find((v) => v.id === outId);
  const all = activeVolunteers(state).filter((v) => !assigned.includes(v.id));
  const need = state.periods.flatMap((p) => p.needs).find((n) => n.id === needId);
  // Escala fixa: primeiro os participantes disponíveis nesta data; se não houver, todos.
  const fixedIds = need?.fixedId ? fixedCandidates(state, need.fixedId, need.date) : [];
  const hasData = state.availabilities.some((a) => a.periodId === periodId);
  const filtered = need?.fixedId
    ? all.filter((v) => fixedIds.includes(v.id))
    : hasData
      ? all.filter((v) => availabilityOf(state, periodId, v.id, needId) === "disponivel")
      : all;
  // Backups deste turno aparecem primeiro (eles já tinham saído e voltaram a ficar disponíveis).
  const backups = backupsOf(state, needId);
  const backupPeople = activeVolunteers(state).filter(
    (v) => backups.includes(v.id) && v.id !== outId,
  );
  const eligible = [
    ...backupPeople,
    ...(filtered.length ? filtered : all).filter((v) => !backups.includes(v.id)).sort(byPriority),
  ];

  return (
    <Dialog open={!!outId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Substituir {out?.name}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {need?.fixedId && filtered.length === 0
            ? "Nenhum participante da escala fixa está livre; mostrando todos. "
            : ""}
          Ordenado pela prioridade do sorteio (menos escalas recentes primeiro).
        </p>
        <div className="max-h-64 divide-y overflow-y-auto">
          {eligible.length === 0 && (
            <p className="py-3 text-sm text-muted-foreground">
              Nenhum voluntário elegível disponível.
            </p>
          )}
          {eligible.map((v, idx) => (
            <button
              key={v.id}
              onClick={() => setInId(v.id)}
              className={cn("w-full rounded-xl px-2 text-left", inId === v.id && "bg-primary-soft")}
            >
              <PersonRow
                name={v.name}
                photoUrl={v.photoUrl}
                sub={`${idx === 0 ? "Sugerido · " : ""}${backups.includes(v.id) ? "Backup · " : ""}${v.recent3m} recentes · ${v.last12m} em 12 meses`}
              />
            </button>
          ))}
        </div>
        <Textarea
          placeholder="Motivo da substituição"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="rounded-xl"
        />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!inId || !reason.trim()}
            onClick={async () => {
              const r = await act(
                repo.substitute(periodId, needId, outId!, inId!, reason.trim()),
                "Substituição registrada",
              );
              if (r.ok) onClose();
            }}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
