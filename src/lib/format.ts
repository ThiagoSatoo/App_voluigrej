import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AttendanceStatus, DrawStatus, PeriodStatus } from "@/data/types";

/** Fixed "today" for the demo so mock scales stay meaningful. Replace with new Date() in production. */
export const DEMO_TODAY = "2026-10-05";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const toDate = (d: string) => new Date(`${d}T12:00:00`);
export const fmtLong = (d: string) => cap(format(toDate(d), "EEEE, d 'de' MMMM", { locale: ptBR }));
export const fmtDM = (d: string) => format(toDate(d), "dd/MM");
export const fmtDMY = (d: string) => format(toDate(d), "dd/MM/yyyy");
export const fmtWeekday = (d: string) => cap(format(toDate(d), "EEEE", { locale: ptBR }));
export const fmtDay = (d: string) => format(toDate(d), "dd");
export const fmtMonShort = (d: string) => format(toDate(d), "MMM", { locale: ptBR }).replace(".", "").toUpperCase();
export const fmtDateTime = (iso: string) => format(new Date(iso), "dd/MM/yyyy 'às' HH:mm");

export const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const periodLabel = (p: { month: number; year: number }) => `${MONTHS[p.month - 1]} ${p.year}`;

export const maskCpf = (c: string) => (c.length === 11 ? `${c.slice(0, 3)}.***.***-${c.slice(9)}` : c);
export const formatCpfInput = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};
export const firstName = (n: string) => n.split(" ")[0];

export const PERIOD_STATUS: Record<PeriodStatus, { label: string; tone: Tone }> = {
  rascunho: { label: "Rascunho", tone: "muted" },
  aberta: { label: "Disponibilidade aberta", tone: "success" },
  encerrada: { label: "Disponibilidade encerrada", tone: "warning" },
  sorteado: { label: "Sorteio realizado", tone: "accent" },
  publicada: { label: "Escala publicada", tone: "primary" },
  encerrado: { label: "Encerrado", tone: "muted" },
};

export const DRAW_STATUS: Record<DrawStatus, { label: string; tone: Tone }> = {
  rascunho: { label: "Rascunho", tone: "warning" },
  publicado: { label: "Publicado", tone: "primary" },
  substituido: { label: "Substituído por versão posterior", tone: "muted" },
};

export const ATTENDANCE_STATUS: Record<AttendanceStatus, { label: string; tone: Tone }> = {
  presente: { label: "Presente", tone: "success" },
  faltou: { label: "Faltou", tone: "destructive" },
  substituido: { label: "Substituído", tone: "warning" },
  cancelado: { label: "Cancelado", tone: "muted" },
};

export type Tone = "muted" | "success" | "warning" | "accent" | "primary" | "destructive";
