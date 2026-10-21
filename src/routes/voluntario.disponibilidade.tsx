import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Repeat } from "lucide-react";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { act } from "@/lib/act";
import {
  fixedDayStatus,
  fixedLabel,
  isFixedMember,
  nextDates,
  personName,
  sortFixed,
} from "@/data/selectors";
import { AvailabilityControl } from "@/components/app/AvailabilityControl";
import type { FixedSchedule } from "@/data/types";
import {
  ConfirmDialog,
  DateBadge,
  EmptyState,
  PageHeader,
  Panel,
  Pill,
} from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { fmtWeekday, today } from "@/lib/format";
import type { Tone } from "@/lib/format";

export const Route = createFileRoute("/voluntario/disponibilidade")({
  head: () => ({
    meta: [
      { title: "Minhas escalas — Área do Voluntário" },
      {
        name: "description",
        content: "Escolha as escalas fixas em que você serve e avise quando não puder.",
      },
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
      <PageHeader
        title="Minhas escalas"
        subtitle="Escolha os horários em que você pode servir toda semana. Se não puder em algum dia, toque em “Indisponível”; se mudar de ideia, toque em “Disponível”."
      />

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Participo
        </h2>
        {mine.length === 0 && (
          <EmptyState
            icon={Repeat}
            title="Você ainda não participa de nenhuma escala fixa"
            text="Escolha abaixo os horários em que você pode servir."
          />
        )}
        {mine.map((f) => (
          <MyFixedCard key={f.id} fixed={f} meId={meId} />
        ))}
      </section>

      {others.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Outros horários
          </h2>
          {others.map((f) => (
            <Panel key={f.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{fixedLabel(f)}</div>
                <div className="text-xs text-muted-foreground">
                  {f.note ? `${f.note} · ` : ""}
                  {f.slots} {f.slots === 1 ? "pessoa" : "pessoas"} por vez
                </div>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  act(repo.joinFixed(f.id, meId), "Pronto! Você entra nos próximos sorteios.")
                }
              >
                <Plus /> Participar
              </Button>
            </Panel>
          ))}
        </section>
      )}
      {active.length === 0 && (
        <EmptyState
          icon={Repeat}
          title="Nenhuma escala fixa criada"
          text="Quando a coordenação criar os horários, eles aparecem aqui."
        />
      )}
    </div>
  );
}

/** Rótulo da situação da pessoa numa data. */
function statusLabel(st: ReturnType<typeof fixedDayStatus>): { label: string; tone: Tone } {
  if (st.picked) return { label: "Escalado", tone: "primary" };
  if (st.off) return { label: "Indisponível", tone: "destructive" };
  if (st.backup) return { label: "Backup", tone: "warning" };
  if (st.published) return { label: "Não escalado", tone: "muted" };
  return { label: "Aguardando sorteio", tone: "info" };
}

function MyFixedCard({ fixed: f, meId }: { fixed: FixedSchedule; meId: string }) {
  const { state } = useStore();
  const [leaving, setLeaving] = useState(false);
  const dates = nextDates(f, today(), UPCOMING);

  return (
    <Panel className="p-4">
      <div className="min-w-0">
        <div className="font-display text-lg font-semibold">{fixedLabel(f)}</div>
        <div className="text-xs text-muted-foreground">
          {f.note ? `${f.note} · ` : ""}
          {f.slots} {f.slots === 1 ? "pessoa" : "pessoas"} por vez
          {f.responsavelId ? ` · Responsável: ${personName(state, f.responsavelId) ?? "—"}` : ""}
        </div>
      </div>
      <div className="mt-3 divide-y">
        {dates.map((d) => {
          const st = fixedDayStatus(state, f.id, meId, d);
          const { label, tone } = statusLabel(st);
          return (
            <div key={d} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <DateBadge date={d} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{fmtWeekday(d)}</div>
                <Pill tone={tone}>{label}</Pill>
              </div>
              <AvailabilityControl fixedId={f.id} date={d} className="w-full sm:w-64" />
            </div>
          );
        })}
      </div>
      <button
        className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => setLeaving(true)}
      >
        Sair desta escala fixa
      </button>

      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title="Sair desta escala fixa?"
        description="Você deixa de entrar nos próximos sorteios deste horário. Datas em que você já está escalado continuam valendo; marque “Indisponível” nelas se não puder ir."
        confirmLabel="Sair"
        onConfirm={() => {
          act(repo.leaveFixed(f.id, meId), "Você saiu da escala fixa");
        }}
      />
    </Panel>
  );
}
