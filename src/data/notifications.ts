import type { AppNotification, AppState, NotifType } from "./types";

export const NOTIF_LABEL: Record<NotifType, string> = {
  nova_candidatura: "Nova candidatura",
  candidatura_cancelada: "Candidatura cancelada",
  minimo_atingido: "Mínimo atingido",
  escala_completa: "Escala completa",
  abaixo_minimo_24h: "Abaixo do mínimo (24h)",
  aniversario_7d: "Aniversário em 7 dias",
  aniversario_dia: "Aniversário hoje",
  lembrete_24h: "Lembrete 24h",
  lembrete_12h: "Lembrete 12h",
  lembrete_6h: "Lembrete 6h",
  lembrete_3h: "Lembrete 3h",
  lembrete_1h: "Lembrete 1h",
};

export const NOTIF_DESCRIPTION: Record<NotifType, string> = {
  nova_candidatura: "Avisar o responsável quando alguém se candidatar.",
  candidatura_cancelada: "Avisar o responsável quando alguém cancelar.",
  minimo_atingido: "Quando a necessidade alcançar a quantidade mínima.",
  escala_completa: "Quando a necessidade alcançar a quantidade máxima.",
  abaixo_minimo_24h: "Alerta se faltar 24h para o início e ainda estiver abaixo do mínimo.",
  aniversario_7d: "Aviso 7 dias antes do aniversário de um voluntário.",
  aniversario_dia: "Aviso no dia do aniversário.",
  lembrete_24h: "24 horas antes",
  lembrete_12h: "12 horas antes",
  lembrete_6h: "6 horas antes",
  lembrete_3h: "3 horas antes",
  lembrete_1h: "1 hora antes",
};

export const REMINDERS = [
  { type: "lembrete_24h", hours: 24 },
  { type: "lembrete_12h", hours: 12 },
  { type: "lembrete_6h", hours: 6 },
  { type: "lembrete_3h", hours: 3 },
  { type: "lembrete_1h", hours: 1 },
] as const satisfies { type: NotifType; hours: number }[];

export const STAFF_CATEGORIES: NotifType[] = [
  "nova_candidatura",
  "candidatura_cancelada",
  "minimo_atingido",
  "escala_completa",
  "abaixo_minimo_24h",
  "aniversario_7d",
  "aniversario_dia",
];

export const prefEnabled = (s: AppState, userId: string, type: NotifType) => s.notifPrefs[userId]?.[type] !== false;

/** Current user id for notifications (staff id or volunteer id). */
export const currentUserId = (s: AppState) => s.session?.userId ?? "";

export const notificationsOf = (s: AppState, userId: string): AppNotification[] =>
  s.notifications.filter((n) => n.recipientId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
