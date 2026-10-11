import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Eye, FileText } from "lucide-react";
import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { PageHeader, Panel, Pill, StatCard } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEMO_TODAY, fmtDMY, toDate } from "@/lib/format";
import { buildReport, exportReportPdf, type Report } from "@/lib/report";
import { AlertCircle, CheckCircle2, ClipboardList, UserCheck, UserX, Repeat } from "lucide-react";

export const Route = createFileRoute("/supervisor/relatorios")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Relatórios — Painel do Supervisor" },
      { name: "description", content: "Relatórios diários, semanais, mensais e personalizados em PDF." },
      { property: "og:title", content: "Relatórios — Painel do Supervisor" },
      { property: "og:description", content: "Relatórios de escalas, presenças e substituições em PDF." },
    ],
  }),
  component: ReportsPage,
});

type Kind = "diario" | "semanal" | "mensal" | "personalizado";
const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const TITLE: Record<Kind, string> = { diario: "Relatório diário", semanal: "Relatório semanal", mensal: "Relatório mensal", personalizado: "Relatório personalizado" };

function rangeFor(kind: Kind, ref: string, from: string, to: string): [string, string] {
  const d = toDate(ref || DEMO_TODAY);
  if (kind === "diario") return [ymd(d), ymd(d)];
  if (kind === "semanal") return [ymd(startOfWeek(d, { weekStartsOn: 0 })), ymd(endOfWeek(d, { weekStartsOn: 0 }))];
  if (kind === "mensal") return [ymd(startOfMonth(d)), ymd(endOfMonth(d))];
  return [from, to];
}

function ReportsPage() {
  const { state } = useStore();
  const [kind, setKind] = useState<Kind>("mensal");
  const [ref, setRef] = useState(DEMO_TODAY);
  const [from, setFrom] = useState(DEMO_TODAY);
  const [to, setTo] = useState(ymd(addDays(toDate(DEMO_TODAY), 30)));
  const [preview, setPreview] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [start, end] = useMemo(() => rangeFor(kind, ref, from, to), [kind, ref, from, to]);
  const invalid = !start || !end || end < start;

  const build = () => buildReport(state, start, end);
  const exportPdf = async () => {
    if (invalid) { toast.error("Informe um período válido."); return; }
    setBusy(true);
    try {
      await exportReportPdf(preview ?? build(), TITLE[kind], `${state.settings.churchName} · ${state.settings.ministryName}`);
      toast.success("PDF gerado");
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Relatórios" subtitle="Escalas, presenças, faltas e substituições" />
      <Panel className="space-y-4">
        <Tabs value={kind} onValueChange={(v) => { setKind(v as Kind); setPreview(null); }}>
          <TabsList className="grid h-11 w-full grid-cols-4 rounded-xl">
            <TabsTrigger value="diario" className="rounded-lg text-xs sm:text-sm">Diário</TabsTrigger>
            <TabsTrigger value="semanal" className="rounded-lg text-xs sm:text-sm">Semanal</TabsTrigger>
            <TabsTrigger value="mensal" className="rounded-lg text-xs sm:text-sm">Mensal</TabsTrigger>
            <TabsTrigger value="personalizado" className="rounded-lg text-xs sm:text-sm">Período</TabsTrigger>
          </TabsList>
        </Tabs>
        {kind === "personalizado" ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Data inicial</Label><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); }} className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>Data final</Label><Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreview(null); }} className="h-11 rounded-xl" /></div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>{kind === "diario" ? "Dia" : kind === "semanal" ? "Qualquer dia da semana" : "Qualquer dia do mês"}</Label>
            <Input type="date" value={ref} onChange={(e) => { setRef(e.target.value); setPreview(null); }} className="h-11 rounded-xl" />
          </div>
        )}
        <p className="text-sm text-muted-foreground">{invalid ? <span className="font-medium text-destructive">A data final deve ser igual ou posterior à inicial.</span> : <>Período: <b>{fmtDMY(start)}</b> a <b>{fmtDMY(end)}</b></>}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={invalid} onClick={() => setPreview(build())}><Eye /> Visualizar resumo</Button>
          <Button disabled={invalid || busy} onClick={exportPdf}><Download /> {busy ? "Gerando…" : "Exportar PDF"}</Button>
        </div>
      </Panel>

      {preview && <ReportPreview r={preview} />}
    </div>
  );
}

function ReportPreview({ r }: { r: Report }) {
  const s = r.summary;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard icon={ClipboardList} label="Necessidades" value={s.needs} hint={`${s.slots} vagas`} />
        <StatCard icon={CheckCircle2} label="Vagas preenchidas" value={s.filled} tone="success" hint={`${s.unfilled} não preenchidas`} />
        <StatCard icon={AlertCircle} label="Abaixo do mínimo" value={s.belowMin} tone="destructive" />
        <StatCard icon={UserCheck} label="Presenças" value={s.present} tone="success" />
        <StatCard icon={UserX} label="Faltas" value={s.absent} tone="warning" />
        <StatCard icon={Repeat} label="Substituições" value={s.substitutions} tone="accent" />
      </div>
      <Panel className="space-y-2">
        <p className="font-display text-lg font-semibold">Necessidades no período</p>
        {r.rows.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="h-4 w-4" /> Nenhuma necessidade neste período.</p>
        ) : (
          r.rows.map((x, i) => (
            <div key={i} className="rounded-xl border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{fmtDMY(x.date)} · {x.time}</span>
                <Pill tone={x.belowMin ? "destructive" : x.unfilled ? "warning" : "success"}>
                  {x.belowMin ? "Abaixo do mínimo" : x.unfilled ? `${x.unfilled} vaga(s) livre(s)` : "Completa"}
                </Pill>
              </div>
              <p className="text-xs text-muted-foreground">{x.kind}{x.note ? ` · ${x.note}` : ""} · mín {x.min} / máx {x.max}</p>
              <p className="mt-1">{x.volunteers.join(", ") || "Nenhum voluntário escalado"}</p>
              {(x.present > 0 || x.absent > 0 || x.substituted > 0) && (
                <p className="mt-1 text-xs text-muted-foreground">{x.present} presença(s) · {x.absent} falta(s) · {x.substituted} substituição(ões)</p>
              )}
            </div>
          ))
        )}
      </Panel>
      {r.substitutions.length > 0 && (
        <Panel className="space-y-1 text-sm">
          <p className="font-display text-lg font-semibold">Substituições</p>
          {r.substitutions.map((x, i) => <p key={i}>{fmtDMY(x.date)}: {x.out} → {x.in} <span className="text-muted-foreground">({x.reason})</span></p>)}
        </Panel>
      )}
    </div>
  );
}
