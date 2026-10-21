import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CalendarCheck, CalendarPlus, ChevronLeft, ChevronRight, Pencil, Pin, Repeat, Search, Send, Shuffle, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { act } from "@/lib/act";
import {
  WEEKDAYS,
  activeVolunteers,
  fixedDraws,
  fixedLabel,
  fixedMembersOf,
  isUnavailable,
  nextDates,
  personName,
  sortFixed,
  sortNeeds,
} from "@/data/selectors";
import type { FixedSchedule } from "@/data/types";
import { ResponsavelSelect } from "@/components/app/ResponsavelSelect";
import { FixedAvailabilityDialog } from "@/components/app/FixedAvailabilityDialog";
import { OpportunityManager } from "@/components/app/OpportunityManager";
import { TimeRangeFields } from "@/components/app/TimeRangeFields";
import { ConfirmDialog, DateBadge, EmptyState, Notice, PageHeader, Panel, Pill } from "@/components/app/common";
import { VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { firstName, fmtDM, fmtWeekday, today, toDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/supervisor/periodos")({
  head: () => ({
    meta: [
      { title: "Escalas — Painel da Coordenação" },
      { name: "description", content: "Escalas fixas (horários semanais) e vagas avulsas em um só lugar." },
    ],
  }),
  component: () => <SchedulingPage tab="fixas" />,
});

/** Escalas fixas e vagas avulsas juntas, em abas. */
export function SchedulingPage({ tab: initial }: { tab: "fixas" | "vagas" }) {
  const [tab, setTab] = useState(initial);
  return (
    <div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="mb-4 grid h-11 w-full max-w-md grid-cols-2 rounded-xl">
          <TabsTrigger value="fixas" className="rounded-lg">Escalas fixas</TabsTrigger>
          <TabsTrigger value="vagas" className="rounded-lg">Vagas avulsas</TabsTrigger>
        </TabsList>
        <TabsContent value="fixas"><FixedSchedulesPage /></TabsContent>
        <TabsContent value="vagas"><OpportunityManager scope="all" /></TabsContent>
      </Tabs>
    </div>
  );
}

function FixedSchedulesPage() {
  const { state } = useStore();
  const [month, setMonth] = useState(() => startOfMonth(toDate(today())));
  const [editing, setEditing] = useState<FixedSchedule | "new" | null>(null);
  const list = sortFixed(state.fixedSchedules);
  const thisMonth = startOfMonth(toDate(today()));
  const y = month.getFullYear();
  const m = month.getMonth() + 1;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Escalas fixas"
        subtitle="Horários que se repetem toda semana. Cada voluntário escolhe de quais participa; o sorteio do mês decide quem vai em cada data."
        actions={<Button onClick={() => setEditing("new")}><CalendarPlus /> Nova escala fixa</Button>}
      />

      <div className="flex items-center gap-1">
        <Button size="icon" variant="outline" disabled={month <= thisMonth} onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior"><ChevronLeft /></Button>
        <span className="min-w-36 text-center font-display text-lg font-semibold capitalize">{format(month, "MMMM yyyy", { locale: ptBR })}</span>
        <Button size="icon" variant="outline" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês"><ChevronRight /></Button>
        <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">Mês do sorteio</span>
      </div>

      {list.length === 0 && (
        <EmptyState icon={Repeat} title="Nenhuma escala fixa" text="Crie os horários que se repetem toda semana, por exemplo: Domingo 09:00–11:00, 4 pessoas." />
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((f) => <FixedCard key={f.id} fixed={f} year={y} month={m} onEdit={() => setEditing(f)} />)}
      </div>

      <FixedDialog key={editing === "new" ? "new" : (editing?.id ?? "none")} fixed={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function FixedCard({ fixed: f, year, month, onEdit }: { fixed: FixedSchedule; year: number; month: number; onEdit: () => void }) {
  const { state } = useStore();
  const [members, setMembers] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [availability, setAvailability] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const memberIds = fixedMembersOf(state, f.id);
  const { period, draws } = fixedDraws(state, f.id, year, month);
  const latest = draws.find((d) => d.status !== "substituido");
  const published = draws.find((d) => d.status === "publicado");
  const draft = latest?.status === "rascunho" ? latest : undefined;
  const shown = draft ?? published;
  const needs = sortNeeds((period?.needs ?? []).filter((n) => n.fixedId === f.id));
  const name = (id: string) => personName(state, id) ?? "—";
  const dates = monthDates(f, year, month);
  const pins = state.fixedPins.filter((p) => p.fixedId === f.id && dates.includes(p.date) && p.volunteerIds.length > 0);

  // Equilíbrio do mês: quantas vezes cada participante foi escalado.
  const times = memberIds.map((id) => shown?.slots.reduce((t, sl) => t + (sl.picks.some((p) => p.volunteerId === id) ? 1 : 0), 0) ?? 0);
  const spread = times.length ? Math.max(...times) - Math.min(...times) : 0;
  const short = shown ? shown.slots.filter((sl) => sl.picks.length < (needs.find((n) => n.id === sl.needId)?.slots ?? 0)).length : 0;

  const draw = async () => {
    setBusy(true);
    const r = await act(repo.drawFixed(f.id, year, month), "Sorteio feito. Confira e publique.");
    setBusy(false);
    if (r.ok) setOpen(true);
  };

  return (
    <Panel className={cn("p-4", !f.active && "opacity-70")}>
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-center text-xs font-bold uppercase text-primary">
          {WEEKDAYS[f.weekday].slice(0, 3)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{fixedLabel(f)}</div>
          {f.note && <div className="truncate text-sm text-muted-foreground">{f.note}</div>}
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Pill tone="primary">{f.slots} {f.slots === 1 ? "pessoa" : "pessoas"}</Pill>
            <Pill tone="muted">{memberIds.length} participantes</Pill>
            {!f.active && <Pill tone="warning">Desativada</Pill>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Responsável: {f.responsavelId ? name(f.responsavelId) : "equipe"}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={onEdit} aria-label={`Editar ${fixedLabel(f)}`}><Pencil /></Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <span className="text-xs font-semibold text-muted-foreground">Este mês:</span>
        {draft ? <Pill tone="warning">Rascunho #{draft.number}</Pill> : published ? <Pill tone="success">Publicada</Pill> : <Pill tone="muted">Sem sorteio</Pill>}
        {draft && published && <span className="text-xs text-muted-foreground">(há uma versão publicada)</span>}
      </div>
      {pins.length > 0 && (
        <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
          <Pin className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Fixados:{" "}
            {pins.length === dates.length && pins.every((p) => p.volunteerIds.join() === pins[0].volunteerIds.join())
              ? `${pins[0].volunteerIds.map((id) => firstName(name(id))).join(", ")} (mês inteiro)`
              : pins.map((p) => `${fmtDM(p.date)}: ${p.volunteerIds.map((id) => firstName(name(id))).join(", ")}`).join(" · ")}
          </span>
        </p>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={() => setMembers(true)}><Users /> Participantes</Button>
        <Button size="sm" variant="outline" disabled={!f.active || dates.length === 0} onClick={() => setPinning(true)}><Pin /> Fixar</Button>
        <Button size="sm" variant="outline" disabled={!f.active} onClick={() => setAvailability(true)}><CalendarCheck /> Disponibilidade</Button>
        <Button size="sm" variant={shown ? "outline" : "default"} disabled={!f.active || busy || memberIds.length === 0} onClick={draw}>
          <Shuffle /> {busy ? "Sorteando…" : shown ? "Sortear de novo" : "Sortear"}
        </Button>
        {shown && <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>{open ? "Esconder datas" : "Ver datas"}</Button>}
        {draft && <Button size="sm" onClick={() => setConfirmPublish(true)}><Send /> Publicar</Button>}
      </div>
      {memberIds.length === 0 && f.active && <p className="mt-2 text-xs text-muted-foreground">Inscreva participantes (ou peça aos voluntários) antes de sortear.</p>}

      {open && shown && (
        <div className="mt-3 space-y-2">
          {spread > 3 && (
            <Notice tone="warning" icon={AlertTriangle}>Diferença de {spread} dias entre quem mais e quem menos serve neste mês (o ideal é no máximo 3). Verifique as indisponibilidades e sorteie de novo.</Notice>
          )}
          {short > 0 && <Notice tone="warning" icon={AlertTriangle}>{short} {short === 1 ? "data ficou" : "datas ficaram"} com menos gente que o necessário.</Notice>}
          {needs.map((n) => {
            const slot = shown.slots.find((s) => s.needId === n.id);
            const picks = slot?.picks ?? [];
            return (
              <div key={n.id} className="min-w-0 rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <DateBadge date={n.date} className="h-10 w-10" />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="font-semibold">{fmtWeekday(n.date)}</div>
                    <div className="text-xs text-muted-foreground">{picks.length}/{n.slots} · {slot?.eligible ?? 0} disponíveis</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {picks.length === 0 && <span className="text-xs text-muted-foreground">Ninguém disponível.</span>}
                  {picks.map((p) => {
                    const off = isUnavailable(state, f.id, p.volunteerId, n.date);
                    return (
                      <span key={p.volunteerId} className={cn("inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium", off && "bg-destructive-soft text-destructive")}>
                        {p.tiebreak === "Fixado pela coordenação" && <Pin className="h-3 w-3 shrink-0" aria-label="Fixado" />}
                        <span className="truncate">{firstName(name(p.volunteerId))}</span>
                        {off && <span>(indisponível)</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {memberIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Vezes no mês por participante: {memberIds.map((id, i) => `${firstName(name(id))} ${times[i]}`).join(" · ")}
            </p>
          )}
        </div>
      )}

      <MembersDialog fixed={f} open={members} onClose={() => setMembers(false)} />
      {availability && <FixedAvailabilityDialog fixed={f} dates={nextDates(f, today(), 8)} onClose={() => setAvailability(false)} />}
      {pinning && <PinDialog fixed={f} year={year} month={month} dates={dates} onClose={() => setPinning(false)} />}
      {draft && (
        <ConfirmDialog
          open={confirmPublish}
          onOpenChange={setConfirmPublish}
          title="Publicar a escala do mês?"
          description="Os voluntários passam a ver as datas em que foram escalados. Se já havia uma versão publicada desta escala neste mês, ela é trocada por esta."
          confirmLabel="Publicar"
          onConfirm={() => { act(repo.publishDraw(draft.id), "Escala publicada"); }}
        />
      )}
    </Panel>
  );
}

/** Datas da escala fixa no mês, de hoje em diante. */
function monthDates(f: FixedSchedule, year: number, month: number) {
  const mk = `${year}-${String(month).padStart(2, "0")}`;
  const from = `${mk}-01` > today() ? `${mk}-01` : today();
  return nextDates(f, from, 6).filter((d) => d.startsWith(mk));
}

/**
 * Fixar pessoas: elas entram garantidas no sorteio desta escala fixa, numa data ou no mês inteiro.
 * Vale só para o mês escolhido; no mês seguinte a coordenação fixa de novo.
 */
function PinDialog({ fixed: f, year, month, dates, onClose }: { fixed: FixedSchedule; year: number; month: number; dates: string[]; onClose: () => void }) {
  const { state } = useStore();
  const pinsOf = (d: string) => state.fixedPins.find((p) => p.fixedId === f.id && p.date === d)?.volunteerIds ?? [];
  const [scope, setScope] = useState<"mes" | "data">("mes");
  const [date, setDate] = useState(dates[0] ?? "");
  const [selected, setSelected] = useState<string[]>(() => pinsOf(dates[0] ?? ""));
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const memberIds = fixedMembersOf(state, f.id);
  const people = activeVolunteers(state)
    .filter((v) => !q.trim() || v.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(selected.includes(b.id)) - Number(selected.includes(a.id)) || Number(memberIds.includes(b.id)) - Number(memberIds.includes(a.id)) || a.name.localeCompare(b.name));
  const full = selected.length >= f.slots;

  const save = async (ids: string[]) => {
    setBusy(true);
    const r = await act(
      repo.setFixedPins(f.id, scope === "mes" ? dates : [date], ids, year, month),
      ids.length ? "Fixado! O sorteio do mês foi refeito; confira e publique." : "Fixação removida. O sorteio do mês foi refeito.",
    );
    setBusy(false);
    if (r.ok) onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Fixar pessoas · {fixedLabel(f)}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Quem for fixado entra garantido no sorteio. As outras vagas continuam sendo sorteadas. Vale só para este mês.</p>
        <div className="space-y-1.5">
          <Label>Fixar para</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={scope === "mes" ? "default" : "outline"} onClick={() => setScope("mes")}>O mês inteiro</Button>
            <Button type="button" variant={scope === "data" ? "default" : "outline"} onClick={() => setScope("data")}>Só uma data</Button>
          </div>
        </div>
        {scope === "data" && (
          <Select value={date} onValueChange={(d) => { setDate(d); setSelected(pinsOf(d)); }}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{dates.map((d) => <SelectItem key={d} value={d}>{fmtDM(d)} · {fmtWeekday(d)}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <p className="text-xs text-muted-foreground">
          {selected.length} de {f.slots} vagas fixadas{scope === "mes" ? ` em ${dates.length} ${dates.length === 1 ? "data" : "datas"}` : ""}.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pelo nome" className="rounded-xl pl-9" />
        </div>
        <div className="max-h-[40vh] divide-y overflow-y-auto">
          {people.map((v) => {
            const on = selected.includes(v.id);
            return (
              <label key={v.id} className="flex items-center gap-3 py-2">
                <VolunteerAvatar name={v.name} photoUrl={v.photoUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{v.name}</span>
                  {!memberIds.includes(v.id) && <span className="text-xs text-muted-foreground">Não participa desta escala</span>}
                </span>
                <Switch
                  checked={on}
                  disabled={busy || (!on && full)}
                  onCheckedChange={(c) => setSelected((s) => (c ? [...s, v.id] : s.filter((x) => x !== v.id)))}
                  aria-label={`Fixar ${v.name}`}
                />
              </label>
            );
          })}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" className="sm:mr-auto" disabled={busy} onClick={() => save([])}>Remover fixação</Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={busy || selected.length === 0} onClick={() => save(selected)}><Pin /> {busy ? "Salvando…" : "Fixar e sortear"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Coordenação inscreve ou remove participantes de uma escala fixa. */
function MembersDialog({ fixed: f, open, onClose }: { fixed: FixedSchedule; open: boolean; onClose: () => void }) {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const memberIds = fixedMembersOf(state, f.id);
  const people = useMemo(
    () =>
      activeVolunteers(state)
        .filter((v) => !q.trim() || v.name.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => Number(memberIds.includes(b.id)) - Number(memberIds.includes(a.id)) || a.name.localeCompare(b.name)),
    [state, q, memberIds],
  );
  const toggle = async (id: string, on: boolean) => {
    setBusy(id);
    await act(on ? repo.joinFixed(f.id, id) : repo.leaveFixed(f.id, id), on ? "Participante incluído" : "Participante removido");
    setBusy(null);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Participantes · {fixedLabel(f)}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{memberIds.length} participantes. Marque quem serve sempre neste horário.</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pelo nome" className="rounded-xl pl-9" />
        </div>
        <div className="max-h-[50vh] divide-y overflow-y-auto">
          {people.map((v) => {
            const on = memberIds.includes(v.id);
            return (
              <label key={v.id} className="flex items-center gap-3 py-2">
                <VolunteerAvatar name={v.name} photoUrl={v.photoUrl} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{v.name}</span>
                <Switch checked={on} disabled={busy === v.id} onCheckedChange={(c) => toggle(v.id, c)} aria-label={`${v.name} participa`} />
              </label>
            );
          })}
          {people.length === 0 && <p className="py-3 text-sm text-muted-foreground">Ninguém encontrado.</p>}
        </div>
        <DialogFooter><Button onClick={onClose}>Pronto</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FixedDialog({ fixed, onClose }: { fixed: FixedSchedule | "new" | null; onClose: () => void }) {
  const { state } = useStore();
  const f = fixed && fixed !== "new" ? fixed : undefined;
  const [weekday, setWeekday] = useState(String(f?.weekday ?? 0));
  const [start, setStart] = useState(f?.start ?? "09:00");
  const [end, setEnd] = useState(f?.end ?? "11:00");
  const [slots, setSlots] = useState(f?.slots ?? 4);
  const [responsavelId, setResponsavelId] = useState<string | null>(f?.responsavelId ?? null);
  const [note, setNote] = useState(f?.note ?? "");
  const [active, setActive] = useState(f?.active ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const used = !!f && state.periods.some((p) => p.needs.some((n) => n.fixedId === f.id));

  const save = async () => {
    const r = await repo.saveFixed(f?.id ?? null, { weekday: Number(weekday), start, end, slots, responsavelId, note, active });
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(f ? "Escala fixa atualizada" : "Escala fixa criada");
    onClose();
  };

  return (
    <Dialog open={!!fixed} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">{f ? "Editar escala fixa" : "Nova escala fixa"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Dia da semana</Label>
            <Select value={weekday} onValueChange={setWeekday} disabled={used}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{WEEKDAYS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}</SelectContent>
            </Select>
            {used && <p className="text-xs text-muted-foreground">O dia não muda depois do primeiro sorteio. Para outro dia, crie uma nova escala fixa.</p>}
          </div>
          <TimeRangeFields start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
          <div className="space-y-1.5"><Label>Pessoas necessárias</Label><Input type="number" min={1} value={slots} onChange={(e) => setSlots(Math.max(1, Number(e.target.value)))} className="rounded-xl" /></div>
          <div className="space-y-1.5"><Label>Responsável (opcional)</Label><ResponsavelSelect value={responsavelId ?? undefined} onChange={setResponsavelId} /></div>
          <div className="space-y-1.5"><Label>Observação (opcional)</Label><Input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: Culto da manhã" className="rounded-xl" /></div>
          <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <span className="text-sm"><b className="block">Ativa</b><span className="text-xs text-muted-foreground">Desativada: não aparece para os voluntários e não pode ser sorteada.</span></span>
            <Switch checked={active} onCheckedChange={setActive} aria-label="Ativa" />
          </label>
          {f && <p className="text-xs text-muted-foreground">Mudanças de horário e de quantidade valem a partir do próximo sorteio.</p>}
        </div>
        <DialogFooter className="gap-2">
          {f && !used && <Button variant="ghost" className="text-destructive sm:mr-auto" onClick={() => setConfirmDelete(true)}><Trash2 /> Excluir</Button>}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
        {f && (
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title="Excluir esta escala fixa?"
            description="Os participantes inscritos também saem dela."
            confirmLabel="Excluir"
            onConfirm={async () => { const r = await act(repo.removeFixed(f.id), "Escala fixa excluída"); if (r.ok) onClose(); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
