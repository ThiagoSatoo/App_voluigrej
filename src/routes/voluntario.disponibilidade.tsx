import { fmtTimeRange } from "@/lib/time";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarX2, Check, Clock, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { availabilityOf, availabilityPeriod, sortNeeds } from "@/data/selectors";
import { repo } from "@/data/repository";
import { DateBadge, EmptyState, Notice, PageHeader, Panel, Pill } from "@/components/app/common";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { fmtDM, fmtWeekday, periodLabel } from "@/lib/format";

export const Route = createFileRoute("/voluntario/disponibilidade")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Disponibilidade — Área do Voluntário" },
      { name: "description", content: "Informe em quais datas e horários você pode servir." },
      { property: "og:title", content: "Disponibilidade — Área do Voluntário" },
      { property: "og:description", content: "Informe em quais datas e horários você pode servir." },
    ],
  }),
  component: AvailabilityPage,
});

function AvailabilityPage() {
  const { state } = useStore();
  const meId = state.session!.userId;
  const period = availabilityPeriod(state);

  if (!period) {
    return (
      <>
        <PageHeader title="Disponibilidade" />
        <EmptyState icon={CalendarX2} title="Nenhum período aberto" text="Quando o supervisor abrir um novo período, você poderá informar sua disponibilidade aqui." />
      </>
    );
  }

  const open = period.status === "aberta";
  const needs = sortNeeds(period.needs);
  const answered = needs.filter((n) => availabilityOf(state, period.id, meId, n.id)).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Disponibilidade" subtitle={periodLabel(period)} />
      {open ? (
        <Notice tone="success" icon={Clock}>Disponibilidade aberta até {fmtDM(period.deadline)}.</Notice>
      ) : (
        <Notice tone="muted" icon={Lock}>Período encerrado. Sua disponibilidade não pode mais ser alterada.</Notice>
      )}
      <Panel className="py-3">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-semibold">Seu progresso</span>
          <span className="text-muted-foreground">{answered} de {needs.length}</span>
        </div>
        <Progress value={(answered / Math.max(1, needs.length)) * 100} className="h-2" />
      </Panel>

      <div className="space-y-3">
        {needs.map((n) => {
          const val = availabilityOf(state, period.id, meId, n.id);
          const set = async (v: "disponivel" | "indisponivel") => {
            const r = await repo.setAvailability(period.id, meId, n.id, v);
            if (!r.ok) toast.error(r.error);
            else toast.success("Resposta salva", { duration: 1200 });
          };
          return (
            <Panel key={n.id} className="p-4">
              <div className="flex items-center gap-3">
                <DateBadge date={n.date} />
                <div className="flex-1">
                  <div className="font-semibold">{fmtWeekday(n.date)}</div>
                  <div className="text-sm text-muted-foreground">{fmtTimeRange(n)}</div>
                </div>
                {val === "disponivel" && <Pill tone="success">Disponível</Pill>}
                {val === "indisponivel" && <Pill tone="destructive">Indisponível</Pill>}
                {!val && <Pill tone="warning">Ainda não informado</Pill>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  disabled={!open}
                  onClick={() => set("disponivel")}
                  className={cn(
                    "flex h-12 items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold transition disabled:opacity-60",
                    val === "disponivel" ? "border-success bg-success text-success-foreground" : "border-border bg-card hover:border-success",
                  )}
                >
                  <Check className="h-4 w-4" /> Disponível
                </button>
                <button
                  disabled={!open}
                  onClick={() => set("indisponivel")}
                  className={cn(
                    "flex h-12 items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold transition disabled:opacity-60",
                    val === "indisponivel" ? "border-destructive bg-destructive text-destructive-foreground" : "border-border bg-card hover:border-destructive",
                  )}
                >
                  <X className="h-4 w-4" /> Indisponível
                </button>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
