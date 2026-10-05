// Domain types. These mirror the future database tables.
export type Shift = "Manhã" | "Tarde" | "Noite";
export type VolunteerStatus = "ativo" | "inativo";

export interface Volunteer {
  id: string;
  name: string;
  cpf: string; // digits only
  phone: string;
  email: string;
  photoUrl?: string;
  status: VolunteerStatus;
  recent3m: number; // escalas nos últimos 3 meses (simulado)
  last12m: number; // escalas nos últimos 12 meses (simulado)
  lastScaleDate?: string;
  password: string; // PROTÓTIPO: nunca armazenar senha em texto puro em produção
  mustChangePassword: boolean;
  joinedAt: string;
}

export type PeriodStatus = "rascunho" | "aberta" | "encerrada" | "sorteado" | "publicada" | "encerrado";

export interface Need {
  id: string;
  date: string; // YYYY-MM-DD
  shift: Shift;
  slots: number;
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

export interface Session {
  role: "supervisor" | "voluntario";
  userId: string;
}

export interface Settings {
  churchName: string;
  ministryName: string;
  supervisorName: string;
  supervisorPassword: string;
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
}
