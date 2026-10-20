import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, CalendarX2, Plus, Repeat } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { act } from "@/lib/act";
import { backupsOf, fixedLabel, fixedNeed, isFixedMember, isUnavailable, nextDates, personName, publishedSlotFor, sortFixed } from "@/data/selectors";
import type { FixedSchedule } from "@/data/types";
import { ConfirmDialog, DateBadge, EmptyState, PageHeader, Panel, Pill } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { fmtWeekday, today } from "@/lib/format";
import type { Tone } from "@/lib/format";

export const Route = createFileRoute("/voluntario/disponibilidade")({
  head: () => ({
    meta: [
      { title: "Minhas escalas — Área do Voluntário" },
      { name: "description", content: "Escolha as escalas fixas em que você serve e avise quando não puder." },
    ],
  }),
  component: MyFixedSchedules,
});

/** Quantas datas futuras mostrar por escala fixa. */
const UPCOMING = 6;

/**
 * Escalas fixas do voluntário: em quais horários ele serve toda semana e, em cada data,
 * o botão "Indisponível". As regras (quem pode, substituto automático, avisos) ficam no banco.
 */
function MyFixedSchedules() {
  const { state } = useStore();
  const meId = state.session!.userId;
  const active = sortFixed(state.fixedSchedules.filter((f) => f.active));
  const mine = active.filter((f) => isFixedMember(state, f.id, meId));
  const others = active.filter((f) => !isFixedMember(state, f.id, meId));

  return (
    <div className="space-y-5">
      <PageHeader title="Minhas escalas" subtitle="Escolha os horários em que você pode servir toda semana. Se não puder em algum dia, toque em “Indisponível”; se mudar de ideia, toque em “Disponível”." />

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Participo</h2>
        {mine.length === 0 && <EmptyState icon={Repeat} title="Você ainda não participa de nenhuma escala fixa" text="Escolha abaixo os horários em que você pode servir." />}
        {mine.map((f) => <MyFixedCard key={f.id} fixed={f} meId={meId} />)}
      </section>

      {others.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Outros horários</h2>
          {others.map((f) => (
            <Panel key={f.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{fixedLabel(f)}</div>
                <div className="text-xs text-muted-foreground">{f.note ? `${f.note} · ` : ""}{f.slots} {f.slots === 1 ? "pessoa" : "pessoas"} por vez</div>
              </div>
              <Button size="sm" onClick={() => act(repo.joinFixed(f.id, meId), "Pronto! Você entra nos próximos sorteios.")}><Plus /> Participar</Button>
            </Panel>
          ))}
        </section>
      )}
      {active.length === 0 && <EmptyState icon={Repeat} title="Nenhuma escala fixa criada" text="Quando a coordenação criar os horários, eles aparecem aqui." />}
    </div>
  );
}

type DateState = { label: string; tone: Tone; picked: boolean; off: boolean; removed: boolean };

function dateState(s: ReturnType<typeof useStore>["state"], f: FixedSchedule, meId: string, date: string): DateState {
  const off = isUnavailable(s, f.id, meId, date);
  const need = fixedNeed(s, f.id, date)?.n;
  const slot = need ? publishedSlotFor(s, need.id)?.slot : undefined;
  const removed = !!need && s.attendance.some((a) => a.needId === need.id && a.volunteerId === meId && (a.status === "cancelado" || a.status === "substituido"));
  const picked = !!slot?.picks.some((p) => p.volunteerId === meId) && !removed;
  if (picked) return { label: "Escalado", tone: "primary", picked, off, removed };
  if (off) return { label: "Indisponível", tone: "destructive", picked, off, removed };
  if (need && backupsOf(s, need.id).includes(meId)) return { label: "Backup", tone: "warning", picked, off, removed };
  if (slot) return { label: "Não escalado", tone: "muted", picked, off, removed };
  return { label: "Aguardando sorteio", tone: "info", picked, off, removed };
}

function MyFixedCard({ fixed: f, meId }: { fixed: FixedSchedule; meId: string }) {
  const { state } = useStore();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const dates = nextDates(f, today(), UPCOMING);
  const confirmState = confirm ? dateState(state, f, meId, confirm) : undefined;

  const unavailable = async (date: string) => {
    setBusy(date);
    const r = await repo.markUnavailable(f.id, date);
    setBusy(null);
    if (!r.ok) { toast.error(r.error); return; }
    const o = r.outcome ?? "";
    if (o.startsWith("substituido:")) toast.success(`Você saiu deste dia. ${o.slice("substituido:".length)} foi escalado(a) no seu lugar.`);
    else if (o === "sem_substituto") toast.warning("Você saiu deste dia. Não havia substituto livre; a coordenação foi avisada.");
    else if (o === "removido") toast.success("Você saiu deste dia. O turno continua completo.");
    else toast.success("Pronto! A coordenação foi avisada.");
  };

  const available = async (date: string) => {
    setBusy(date);
    const r = await repo.markAvailable(f.id, date);
    setBusy(null);
    if (!r.ok) { toast.error(r.error); return; }
    if (r.outcome === "voltou") toast.success("Você voltou para a escala deste dia.");
    else if (r.outcome === "backup") toast.success("Pronto! Você ficou de backup neste dia.");
    else toast.success("Pronto! Você está disponível neste dia.");
  };

  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display text-lg font-semibold">{fixedLabel(f)}</div>
          <div className="text-xs text-muted-foreground">
            {f.note ? `${f.note} · ` : ""}{f.slots} {f.slots === 1 ? "pessoa" : "pessoas"} por vez{f.responsavelId ? ` · Responsável: ${personName(state, f.responsavelId) ?? "—"}` : ""}
          </div>
        </div>
      </div>
      <div className="mt-3 divide-y">
        {dates.map((d) => {
          const st = dateState(state, f, meId, d);
          return (
            <div key={d} className="flex items-center gap-3 py-2">
              <DateBadge date={d} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{fmtWeekday(d)}</div>
                <Pill tone={st.tone}>{st.label}</Pill>
              </div>
              {st.off && !st.picked ? (
                <Button size="sm" variant="outline" className="text-success" disabled={busy === d} onClick={() => available(d)}><CalendarCheck /> Disponível</Button>
              ) : (
                <Button size="sm" variant="outline" className="text-destructive" disabled={busy === d} onClick={() => setConfirm(d)}><CalendarX2 /> Indisponível</Button>
              )}
            </div>
          );
        })}
      </div>
      <button className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setLeaving(true)}>Sair desta escala fixa</button>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Você não pode neste dia?"
        description={
          confirmState?.picked
            ? "Você está escalado(a). Ao confirmar, você sai deste dia e o sistema chama um substituto automaticamente. A coordenação recebe um aviso."
            : "A coordenação recebe um aviso e o sorteio não vai escalar você neste dia."
        }
        confirmLabel="Estou indisponível"
        onConfirm={() => { if (confirm) void unavailable(confirm); setConfirm(null); }}
      />
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title="Sair desta escala fixa?"
        description="Você deixa de entrar nos próximos sorteios deste horário. Datas em que você já está escalado continuam valendo; use “Indisponível” nelas se não puder ir."
        confirmLabel="Sair"
        onConfirm={() => { act(repo.leaveFixed(f.id, meId), "Você saiu da escala fixa"); }}
      />
    </Panel>
  );
}
