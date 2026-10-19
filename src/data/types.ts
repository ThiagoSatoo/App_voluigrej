// Domain types. These mirror the future database tables.
export type VolunteerStatus = "ativo" | "inativo";

export interface Volunteer {
  id: string;
  name: string;
  cpf: string; // digits only
  phone: string;
  email: string;
  birthDate: string; // YYYY-MM-DD
  photoUrl?: string; // URL assinada temporária (bucket privado)
  photoPath?: string; // caminho no armazenamento
  status: VolunteerStatus;
  role: "voluntario" | "responsavel";
  recent3m: number; // escalas nos últimos 3 meses
  last12m: number; // escalas nos últimos 12 meses
  lastScaleDate?: string;
  mustChangePassword: boolean;
  joinedAt: string;
}

export type PeriodStatus = "rascunho" | "aberta" | "encerrada" | "sorteado" | "publicada" | "encerrado";

export interface Need {
  id: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string; // HH:mm
  slots: number;
  responsavelId?: string; // quem cuida deste turno
}

export interface Period {
  id: string;
  month: number;
  year: number;
  openDate: string;
  deadline: string;
  status: PeriodStatus;
  needs: Need[];
}

export type AvailabilityValue = "disponivel" | "indisponivel";

export interface Availability {
  periodId: string;
  volunteerId: string;
  needId: string;
  value: AvailabilityValue;
  updatedAt: string;
}

export interface DrawPick {
  volunteerId: string;
  recent3m: number;
  last12m: number;
  priority: number;
  tiebreak: string;
}

export interface DrawSlot {
  needId: string;
  eligible: number;
  picks: DrawPick[];
}

export type DrawStatus = "rascunho" | "publicado" | "substituido";

export interface Draw {
  id: string;
  periodId: string;
  number: number;
  createdAt: string;
  createdBy: string;
  status: DrawStatus;
  slots: DrawSlot[];
}

export type AttendanceStatus = "presente" | "faltou" | "substituido" | "cancelado";

export interface Attendance {
  id: string;
  periodId: string;
  needId: string;
  volunteerId: string;
  status: AttendanceStatus;
  recordedAt: string;
  supervisor: string;
}

export interface Substitution {
  id: string;
  periodId: string;
  needId: string;
  outId: string;
  inId: string;
  at: string;
  supervisor: string;
  reason: string;
}

export type Role = "admin" | "supervisor" | "responsavel" | "voluntario";

export interface Session {
  role: Role;
  userId: string;
  name: string;
  mustChangePassword: boolean;
}

export interface Settings {
  churchName: string;
  ministryName: string;
}

export interface AppState {
  volunteers: Volunteer[];
  periods: Period[];
  availabilities: Availability[];
  draws: Draw[];
  attendance: Attendance[];
  substitutions: Substitution[];
  session: Session | null;
  settings: Settings;
  opportunities: Opportunity[];
  dayAvailability: DayAvailability[];
  applications: Application[];
  notifications: AppNotification[];
  supervisors: Staff[];
  notifPrefs: Record<string, NotifPrefs>;
  /** Candidaturas ativas por vaga (contagem segura vinda do servidor). */
  oppCounts: Record<string, number>;
}

/** Admin ou supervisor. */
export interface Staff {
  id: string;
  name: string;
  username: string; // contas antigas; o login atual é o CPF
  cpf: string;
  role: "admin" | "supervisor";
  status: "ativo" | "inativo";
  photoUrl?: string;
  photoPath?: string;
  mustChangePassword: boolean;
}

export type NotifType =
  | "nova_candidatura"
  | "candidatura_cancelada"
  | "minimo_atingido"
  | "escala_completa"
  | "abaixo_minimo_24h"
  | "aniversario_7d"
  | "aniversario_dia"
  | "lembrete_24h"
  | "lembrete_12h"
  | "lembrete_6h"
  | "lembrete_3h"
  | "lembrete_1h";

/** Preferências por usuário: categoria → ativada. Ausente = ativada. */
export type NotifPrefs = Partial<Record<NotifType, boolean>>;

// ---------- Necessidades avulsas e candidaturas ----------
export interface Opportunity {
  id: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string; // HH:mm
  min: number;
  max: number;
  note?: string;
  status: "aberta" | "confirmada";
  createdAt: string;
  responsavelId?: string; // quem cuida desta vaga (supervisor, admin ou responsável)
}

/** Dia em que o voluntário marcou estar disponível (não é candidatura). */
export interface DayAvailability {
  volunteerId: string;
  date: string;
}

export type ApplicationStatus = "candidatado" | "cancelado" | "selecionado" | "nao_selecionado";

export interface Application {
  id: string;
  opportunityId: string;
  volunteerId: string;
  status: ApplicationStatus;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  type: NotifType;
  recipientId: string; // id do supervisor/admin ou do voluntário
  key?: string; // evita duplicadas
  opportunityId?: string;
  message: string;
  createdAt: string;
  read: boolean;
}
