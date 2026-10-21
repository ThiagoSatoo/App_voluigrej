import { useState } from "react";
import { Search } from "lucide-react";
import { useStore } from "@/data/store";
import { fixedDayStatus, fixedLabel, fixedMembersOf, fixedNeed, publishedSlotFor } from "@/data/selectors";
import type { FixedSchedule } from "@/data/types";
import { AvailabilityControl } from "@/components/app/AvailabilityControl";
import { Pill } from "@/components/app/common";
import { VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtDM, fmtWeekday } from "@/lib/format";

/**
 * Coordenação (ou o responsável da escala) marca Disponível/Indisponível por alguém numa data.
 * Mostra os participantes da escala fixa e quem estiver escalado, de backup ou indisponível nesse dia.
 */
export function FixedAvailabilityDialog({ fixed: f, dates, onClose }: { fixed: FixedSchedule; dates: string[]; onClose: () => void }) {
  const { state } = useStore();
  const [date, setDate] = useState(dates[0] ?? "");
  const [q, setQ] = useState("");
  const need = fixedNeed(state, f.id, date)?.n;
  const picked = need ? (publishedSlotFor(state, need.id)?.slot.picks.map((p) => p.volunteerId) ?? []) : [];
  const off = state.fixedExceptions.filter((e) => e.fixedId === f.id && e.date === date).map((e) => e.volunteerId);
  const ids = [...new Set([...fixedMembersOf(state, f.id), ...picked, ...off])];
  const people = state.volunteers
    .filter((v) => v.status === "ativo" && ids.includes(v.id))
    .filter((v) => !q.trim() || v.name.toLowerCase().includes(q.trim().toLowerCase()))
    .map((v) => ({ v, st: fixedDayStatus(state, f.id, v.id, date) }))
    // Escalados primeiro, depois backups, disponíveis e, por último, indisponíveis.
    .sort((a, b) => rank(a.st) - rank(b.st) || a.v.name.localeCompare(b.v.name));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Disponibilidade · {fixedLabel(f)}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Marque quem não pode ir neste dia. Se a pessoa estiver escalada, ela sai do turno e você escolhe o substituto em Agenda → Substituir.
        </p>
        {dates.length > 1 && (
          <Select value={date} onValueChange={setDate}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{dates.map((d) => <SelectItem key={d} value={d}>{fmtDM(d)} · {fmtWeekday(d)}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pelo nome" className="rounded-xl pl-9" />
        </div>
        <div className="divide-y">
          {people.length === 0 && <p className="py-3 text-sm text-muted-foreground">Ninguém participa desta escala fixa ainda.</p>}
          {people.map(({ v, st }) => (
            <div key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <VolunteerAvatar name={v.name} photoUrl={v.photoUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{v.name}</div>
                <StatusPill st={st} />
              </div>
              <AvailabilityControl fixedId={f.id} date={date} volunteerId={v.id} className="w-full sm:w-64" />
            </div>
          ))}
        </div>
        <DialogFooter><Button onClick={onClose}>Pronto</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Status = ReturnType<typeof fixedDayStatus>;

const rank = (st: Status) => (st.picked ? 0 : st.backup ? 1 : st.off ? 3 : 2);

function StatusPill({ st }: { st: Status }) {
  if (st.picked) return <Pill tone="primary">Escalado</Pill>;
  if (st.backup) return <Pill tone="warning">Backup</Pill>;
  if (st.off) return <Pill tone="destructive">Indisponível</Pill>;
  return <Pill tone="muted">{st.published ? "Não escalado" : "Aguardando sorteio"}</Pill>;
}
