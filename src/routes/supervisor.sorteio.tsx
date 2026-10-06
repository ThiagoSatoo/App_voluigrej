import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Info, Send, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { activeVolunteers, availabilityOf, drawsOf, hasResponded, latestDraw, sortNeeds } from "@/data/selectors";
import { ConfirmDialog, Notice, PageHeader, Panel, Pill } from "@/components/app/common";
import { PersonRow } from "@/components/app/VolunteerAvatar";
import { PeriodSelect } from "@/components/app/PeriodSelect";
import { Button } from "@/components/ui/button";
import { DRAW_STATUS, PERIOD_STATUS, fmtDM, fmtDateTime, periodLabel } from "@/lib/format";

export const Route = createFileRoute("/supervisor/sorteio")({
  head: () => ({
    meta: [
      { title: "Sorteio da Escala — Painel do Supervisor" },
      { name: "description", content: "Gere, revise e publique a escala com prioridade para quem serviu menos." },
      { property: "og:title", content: "Sorteio da Escala — Painel do Supervisor" },
      { property: "og:description", content: "Gere, revise e publique a escala do mês." },
    ],
  }),
  component: DrawPage,
});

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Panel>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary font-display font-semibold text-primary-foreground">{n}</span>
        <h2 className="font-display text-lg font-semibold">Etapa {n} — {title}</h2>
      </div>
      {children}
    </Panel>
  );
}

function DrawPage() {
  const { state } = useStore();
  const candidates = state.periods.filter((p) => p.status !== "rascunho" && p.status !== "encerrado");
  const [pid, setPid] = useState(candidates.find((p) => p.status !== "publicada")?.id ?? candidates[0]?.id);
  const [confirmGen, setConfirmGen] = useState(false);
  const [confirmPub, setConfirmPub] = useState(false);
  const period = state.periods.find((p) => p.id === pid);
  if (!period) return <PageHeader title="Sorteio da Escala" subtitle="Nenhum período disponível." />;

  const active = activeVolunteers(state);
  const needs = sortNeeds(period.needs);
  const totalSlots = needs.reduce((s, n) => s + n.slots, 0);
  const eligible = active.filter((v) => needs.some((n) => availabilityOf(state, period.id, v.id, n.id) === "disponivel"));
  const pending = active.filter((v) => !hasResponded(state, period.id, v.id));
  const draw = latestDraw(state, period.id);
  const versions = drawsOf(state, period.id);
  const canDraw = period.status !== "aberta";

  return (
    <div className="space-y-4">
      <PageHeader title="Sorteio da Escala" subtitle={<Pill tone={PERIOD_STATUS[period.status].tone}>{PERIOD_STATUS[period.status].label}</Pill>} actions={<PeriodSelect periods={candidates} value={pid} onChange={setPid} />} />

      <Step n={1} title="Conferência">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Box label="Período" value={periodLabel(period)} />
          <Box label="Necessidades" value={needs.length} />
          <Box label="Vagas" value={totalSlots} />
          <Box label="Elegíveis" value={eligible.length} />
        </div>
        {pending.length > 0 && <div className="mt-3"><Notice icon={AlertTriangle}>{pending.length} voluntário(s) ativos não responderam e não participarão do sorteio.</Notice></div>}
        {!canDraw && (
          <div className="mt-3 space-y-2">
            <Notice tone="accent" icon={Info}>A disponibilidade ainda está aberta. Encerre-a para realizar o sorteio.</Notice>
            <Button variant="outline" onClick={() => { repo.setPeriodStatus(period.id, "encerrada"); toast.success("Disponibilidade encerrada"); }}>Encerrar disponibilidade agora</Button>
          </div>
        )}
      </Step>

      <Step n={2} title="Critério">
        <p className="rounded-xl bg-primary-soft p-3 font-semibold text-primary">Prioridade: voluntários com menor número de escalas recentes.</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Menor quantidade de escalas nos últimos 3 meses.</li>
          <li>Em caso de empate, menor quantidade nos últimos 12 meses.</li>
          <li>Persistindo empate, desempate aleatório.</li>
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">Nesta versão, as contagens são simuladas. Somente quem marcou “Disponível” é considerado.</p>
      </Step>

      <Step n={3} title="Gerar sorteio">
        <Button variant="hero" size="xl" className="w-full" disabled={!canDraw} onClick={() => setConfirmGen(true)}>
          <Shuffle className="!h-5 !w-5" /> {draw ? "Gerar novo sorteio" : "Gerar sorteio"}
        </Button>
      </Step>

      {draw && (
        <Step n={4} title="Resultado">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">Sorteio #{draw.number} · {fmtDateTime(draw.createdAt)}</div>
            <Pill tone={DRAW_STATUS[draw.status].tone}>{DRAW_STATUS[draw.status].label}</Pill>
          </div>
          <div className="space-y-3">
            {draw.slots.map((slot) => {
              const n = period.needs.find((x) => x.id === slot.needId);
              if (!n) return null;
              const missing = n.slots - slot.picks.length;
              return (
                <div key={slot.needId} className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold">{fmtDM(n.date)} — {n.shift}</h3>
                    <Pill tone={missing > 0 ? "destructive" : "success"}>{slot.picks.length}/{n.slots} preenchidas</Pill>
                  </div>
                  {missing > 0 && (
                    <div className="mt-3"><Notice tone="destructive" icon={AlertTriangle}>
                      Não existem voluntários elegíveis suficientes para preencher todas as vagas.
                      <div className="mt-1 text-xs font-normal">{n.slots} vagas necessárias · {slot.eligible} voluntários elegíveis · {missing} vaga(s) sem preenchimento</div>
                    </Notice></div>
                  )}
                  <div className="mt-2 divide-y">
                    {slot.picks.map((p) => {
                      const v = state.volunteers.find((x) => x.id === p.volunteerId)!;
                      return <PersonRow key={p.volunteerId} name={v.name} photoUrl={v.photoUrl} sub={`${p.recent3m} recentes · ${p.last12m} em 12m · Desempate: ${p.tiebreak}`} right={<Pill tone="accent">#{p.priority}</Pill>} />;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {draw.status === "rascunho" ? (
            <Button size="xl" className="mt-4 w-full" onClick={() => setConfirmPub(true)}><Send /> Publicar escala</Button>
          ) : draw.status === "publicado" ? (
            <div className="mt-4"><Notice tone="success" icon={CheckCircle2}>Escala publicada. Os voluntários já podem visualizá-la.</Notice></div>
          ) : null}
        </Step>
      )}

      {versions.length > 0 && (
        <Panel>
          <h2 className="mb-3 font-display text-lg font-semibold">Histórico do sorteio · {periodLabel(period)}</h2>
          <div className="space-y-2">
            {versions.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3 text-sm">
                <div><b>Sorteio #{d.number}</b><div className="text-xs text-muted-foreground">{fmtDateTime(d.createdAt)} · {d.createdBy}</div></div>
                <Pill tone={DRAW_STATUS[d.status].tone}>{DRAW_STATUS[d.status].label}</Pill>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <ConfirmDialog open={confirmGen} onOpenChange={setConfirmGen} title="Gerar sorteio?" description="Você está prestes a gerar uma nova proposta de escala. O resultado poderá ser revisado antes da publicação." confirmLabel="Gerar sorteio" onConfirm={() => { const d = repo.runDraw(period.id); toast.success(`Sorteio #${d.number} gerado como rascunho`); }} />
      <ConfirmDialog open={confirmPub} onOpenChange={setConfirmPub} title="Publicar escala?" description="Tem certeza que deseja publicar esta escala? Após a publicação, ela ficará disponível para os voluntários." confirmLabel="Publicar" onConfirm={() => { if (draw) repo.publishDraw(draw.id); toast.success("Escala publicada"); }} />
    </div>
  );
}

function Box({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-lg font-semibold">{value}</div>
    </div>
  );
}
