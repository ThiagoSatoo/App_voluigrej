import type { AppState } from "@/data/types";
import { fmtDMY } from "@/lib/format";
import { fmtTimeRange } from "@/lib/time";

export interface ReportRow {
  date: string;
  time: string;
  kind: string;
  note?: string;
  min: number;
  max: number;
  volunteers: string[];
  present: number;
  absent: number;
  substituted: number;
  belowMin: boolean;
  unfilled: number;
}

export interface Report {
  from: string;
  to: string;
  generatedAt: string;
  rows: ReportRow[];
  substitutions: { date: string; out: string; in: string; reason: string }[];
  summary: { needs: number; slots: number; filled: number; unfilled: number; belowMin: number; present: number; absent: number; substitutions: number };
}

/** Builds report data for [from, to] from published scales and confirmed/open opportunities. CPF is never included. */
export function buildReport(s: AppState, from: string, to: string): Report {
  const name = (id: string) => s.volunteers.find((v) => v.id === id)?.name ?? "—";
  const inRange = (d: string) => d >= from && d <= to;
  const att = (needId: string, vid: string) => s.attendance.find((a) => a.needId === needId && a.volunteerId === vid)?.status;
  const rows: ReportRow[] = [];

  s.draws.filter((d) => d.status === "publicado").forEach((d) => {
    const period = s.periods.find((p) => p.id === d.periodId);
    d.slots.forEach((sl) => {
      const n = period?.needs.find((x) => x.id === sl.needId);
      if (!n || !inRange(n.date)) return;
      const ids = sl.picks.map((p) => p.volunteerId);
      const subs = s.attendance.filter((a) => a.needId === n.id && a.status === "substituido").length;
      rows.push({
        date: n.date, time: fmtTimeRange(n), kind: "Escala mensal", min: n.slots, max: n.slots,
        volunteers: ids.map(name),
        present: ids.filter((id) => att(n.id, id) === "presente").length,
        absent: ids.filter((id) => att(n.id, id) === "faltou").length,
        substituted: subs,
        belowMin: ids.length < n.slots,
        unfilled: Math.max(0, n.slots - ids.length),
      });
    });
  });

  s.opportunities.filter((o) => inRange(o.date)).forEach((o) => {
    const status = o.status === "confirmada" ? ["selecionado"] : ["candidatado"];
    const ids = s.applications.filter((a) => a.opportunityId === o.id && status.includes(a.status)).map((a) => a.volunteerId);
    rows.push({
      date: o.date, time: fmtTimeRange(o), kind: o.status === "confirmada" ? "Necessidade (confirmada)" : "Necessidade (aberta)", note: o.note,
      min: o.min, max: o.max, volunteers: ids.map(name),
      present: ids.filter((id) => att(o.id, id) === "presente").length,
      absent: ids.filter((id) => att(o.id, id) === "faltou").length,
      substituted: 0,
      belowMin: ids.length < o.min,
      unfilled: Math.max(0, o.max - ids.length),
    });
  });
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const needDate = (id: string) => s.periods.flatMap((p) => p.needs).find((n) => n.id === id)?.date ?? "";
  const substitutions = s.substitutions
    .filter((x) => inRange(needDate(x.needId)))
    .map((x) => ({ date: needDate(x.needId), out: name(x.outId), in: name(x.inId), reason: x.reason }));

  const sum = (f: (r: ReportRow) => number) => rows.reduce((t, r) => t + f(r), 0);
  return {
    from, to, generatedAt: new Date().toISOString(), rows, substitutions,
    summary: {
      needs: rows.length,
      slots: sum((r) => r.max),
      filled: sum((r) => r.volunteers.length),
      unfilled: sum((r) => r.unfilled),
      belowMin: rows.filter((r) => r.belowMin).length,
      present: sum((r) => r.present),
      absent: sum((r) => r.absent),
      substitutions: substitutions.length,
    },
  };
}

/** Generates and downloads a real PDF file (client-side). */
export async function exportReportPdf(r: Report, title: string, church: string) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  doc.setFontSize(16).setFont("helvetica", "bold").text(title, 40, 50);
  doc.setFontSize(10).setFont("helvetica", "normal");
  doc.text(church, 40, 68);
  doc.text(`Período: ${fmtDMY(r.from)} a ${fmtDMY(r.to)}`, 40, 84);
  doc.text(`Gerado em: ${new Date(r.generatedAt).toLocaleString("pt-BR")}`, W - 40, 84, { align: "right" });

  const s = r.summary;
  autoTable(doc, {
    startY: 100,
    head: [["Necessidades", "Vagas", "Preenchidas", "Não preenchidas", "Abaixo do mín.", "Presenças", "Faltas", "Substituições"]],
    body: [[s.needs, s.slots, s.filled, s.unfilled, s.belowMin, s.present, s.absent, s.substitutions].map(String)],
    styles: { fontSize: 9, halign: "center" },
    headStyles: { fillColor: [44, 95, 93] },
  });

  autoTable(doc, {
    head: [["Data", "Horário", "Tipo", "Mín/Máx", "Voluntários escalados", "Pres.", "Faltas", "Situação"]],
    body: r.rows.map((x) => [
      fmtDMY(x.date), x.time, x.kind + (x.note ? `\n${x.note}` : ""), `${x.min}/${x.max}`,
      x.volunteers.join(", ") || "—", String(x.present), String(x.absent),
      x.belowMin ? `Abaixo do mínimo (${x.unfilled} vaga(s) livre(s))` : x.unfilled ? `${x.unfilled} vaga(s) livre(s)` : "Completa",
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [44, 95, 93] },
    columnStyles: { 4: { cellWidth: 150 } },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 7 && r.rows[d.row.index]?.belowMin) d.cell.styles.textColor = [190, 40, 40];
    },
  });

  const below = r.rows.filter((x) => x.belowMin || x.unfilled);
  autoTable(doc, {
    head: [["Necessidades abaixo do mínimo / vagas não preenchidas", "", ""]],
    body: below.length ? below.map((x) => [`${fmtDMY(x.date)} ${x.time}`, `${x.volunteers.length} de mín. ${x.min} / máx. ${x.max}`, x.belowMin ? "Abaixo do mínimo" : `${x.unfilled} vaga(s)`]) : [["Nenhuma", "", ""]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [190, 40, 40] },
  });

  autoTable(doc, {
    head: [["Substituições", "Saiu", "Entrou", "Motivo"]],
    body: r.substitutions.length ? r.substitutions.map((x) => [fmtDMY(x.date), x.out, x.in, x.reason]) : [["Nenhuma", "", "", ""]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [44, 95, 93] },
  });

  doc.save(`relatorio-${r.from}_${r.to}.pdf`);
}
