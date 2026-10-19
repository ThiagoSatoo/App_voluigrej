import {
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  FileText,
  HandHeart,
  History,
  Home,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Shuffle,
  SlidersHorizontal,
  UserCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AppState } from "@/data/types";

export type NavArea = "supervisor" | "voluntario";

export interface NavItem {
  key: string;
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Não pode ser desligada (sem ela a pessoa fica sem saída ou sem conta). */
  locked?: string;
  /** Só aparece para responsáveis de turno. */
  responsavelOnly?: boolean;
  /** Só o administrador vê. */
  adminOnly?: boolean;
  hint?: string;
}

export const SUPERVISOR_NAV: NavItem[] = [
  { key: "dashboard", to: "/supervisor", label: "Dashboard", icon: LayoutDashboard, exact: true, locked: "Tela inicial" },
  { key: "equipe", to: "/supervisor/voluntarios", label: "Equipe", icon: Users },
  { key: "periodos", to: "/supervisor/periodos", label: "Períodos e necessidades", icon: CalendarRange },
  { key: "disponibilidades", to: "/supervisor/disponibilidades", label: "Disponibilidades", icon: ClipboardCheck },
  { key: "sorteio", to: "/supervisor/sorteio", label: "Sorteio", icon: Shuffle },
  { key: "agenda", to: "/supervisor/escala", label: "Agenda", icon: CalendarDays },
  { key: "presenca", to: "/supervisor/presenca", label: "Presença", icon: UserCheck },
  { key: "historico", to: "/supervisor/historico", label: "Histórico", icon: History },
  { key: "relatorios", to: "/supervisor/relatorios", label: "Relatórios", icon: FileText },
  { key: "configuracoes", to: "/supervisor/configuracoes", label: "Configurações", icon: Settings, locked: "Tem a troca de senha e a foto da conta" },
  { key: "admin", to: "/supervisor/admin", label: "Admin", icon: SlidersHorizontal, adminOnly: true, locked: "Só o administrador vê" },
];

export const VOLUNTEER_NAV: NavItem[] = [
  { key: "inicio", to: "/voluntario", label: "Início", icon: Home, exact: true, locked: "Tela inicial" },
  { key: "disponibilidade", to: "/voluntario/disponibilidade", label: "Disponível", icon: CalendarCheck, hint: "Disponibilidade para a escala mensal" },
  { key: "escala", to: "/voluntario/escala", label: "Escala", icon: CalendarDays },
  { key: "vagas", to: "/voluntario/vagas", label: "Vagas", icon: HandHeart, hint: "Candidatura às vagas avulsas" },
  { key: "turnos", to: "/voluntario/turnos", label: "Turnos", icon: ShieldCheck, responsavelOnly: true, hint: "Só para responsáveis de turno" },
  { key: "historico", to: "/voluntario/historico", label: "Histórico", icon: History },
  { key: "perfil", to: "/voluntario/perfil", label: "Perfil", icon: UserRound, locked: "Tem a senha e o botão Sair" },
];

export type NavConfig = Partial<Record<NavArea, Record<string, boolean>>>;

/** Aba ligada? Ausente = ligada. Abas travadas estão sempre ligadas. */
export const navEnabled = (config: NavConfig, area: NavArea, item: NavItem) => !!item.locked || config[area]?.[item.key] !== false;

/** Abas que a pessoa logada vê no menu. O administrador vê tudo. */
export function visibleNav(s: AppState, area: NavArea): NavItem[] {
  const role = s.session?.role;
  const items = area === "supervisor" ? SUPERVISOR_NAV : VOLUNTEER_NAV;
  return items.filter((it) => {
    if (it.adminOnly) return role === "admin";
    if (it.responsavelOnly && role !== "responsavel") return false;
    if (role === "admin") return true;
    return navEnabled(s.navConfig, area, it);
  });
}

/** A rota atual está desligada para esta pessoa? (bloqueia também quem digita o endereço direto) */
export function routeBlocked(s: AppState, area: NavArea, pathname: string): boolean {
  const items = area === "supervisor" ? SUPERVISOR_NAV : VOLUNTEER_NAV;
  const extra = area === "supervisor" ? [{ key: "periodos", to: "/supervisor/necessidades" }] : [];
  const match = [...items, ...extra]
    .filter((it) => pathname === it.to || (!("exact" in it && it.exact) && pathname.startsWith(it.to + "/")))
    .sort((a, b) => b.to.length - a.to.length)[0];
  if (!match) return false;
  const item = items.find((it) => it.key === match.key)!;
  return !visibleNav(s, area).some((it) => it.key === item.key);
}
