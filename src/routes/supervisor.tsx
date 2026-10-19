import { useState } from "react";
import { Link, Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  CalendarRange,
  ClipboardList,
  ClipboardCheck,
  HeartHandshake,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shuffle,
  UserCheck,
  Users,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { NotificationBell } from "@/components/app/NotificationBell";
import { useRequireRole } from "@/hooks/use-session";
import { LoadingScreen } from "@/components/app/common";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { repo } from "@/data/repository";

export const Route = createFileRoute("/supervisor")({
  component: SupervisorLayout,
});

const nav = [
  { to: "/supervisor", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/supervisor/voluntarios", label: "Equipe", icon: Users },
  { to: "/supervisor/periodos", label: "Períodos", icon: CalendarRange },
  { to: "/supervisor/necessidades", label: "Necessidades", icon: ClipboardList },
  { to: "/supervisor/disponibilidades", label: "Disponibilidades", icon: ClipboardCheck },
  { to: "/supervisor/sorteio", label: "Sorteio", icon: Shuffle },
  { to: "/supervisor/escala", label: "Agenda", icon: CalendarDays },
  { to: "/supervisor/presenca", label: "Presença", icon: UserCheck },
  { to: "/supervisor/historico", label: "Histórico", icon: History },
  { to: "/supervisor/relatorios", label: "Relatórios", icon: FileText },
  { to: "/supervisor/supervisores", label: "Supervisores", icon: ShieldCheck, adminOnly: true },
  { to: "/supervisor/configuracoes", label: "Configurações", icon: Settings },
] as const;

function NavList({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground">
          <HeartHandshake className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-lg font-semibold leading-tight">Escala</div>
          <div className="text-xs opacity-70">{isAdmin ? "Painel do administrador" : "Painel do supervisor"}</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {nav.filter((it) => !("adminOnly" in it) || isAdmin).map((it) => (
          <Link
            key={it.to}
            to={it.to}
            onClick={onNavigate}
            activeOptions={{ exact: "exact" in it }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium opacity-80 transition hover:bg-sidebar-accent hover:opacity-100 data-[status=active]:bg-sidebar-accent data-[status=active]:opacity-100 data-[status=active]:text-sidebar-primary"
          >
            <it.icon className="h-4.5 w-4.5" />
            {it.label}
          </Link>
        ))}
      </nav>
      <div className="p-3">
        <button
          onClick={async () => {
            await repo.logout();
            navigate({ to: "/" });
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium opacity-80 hover:bg-sidebar-accent hover:opacity-100"
        >
          <LogOut className="h-4.5 w-4.5" /> Sair
        </button>
      </div>
    </div>
  );
}

function SupervisorLayout() {
  const { ready, isAdmin } = useRequireRole("supervisor");
  const [open, setOpen] = useState(false);
  if (!ready) return <LoadingScreen />;
  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-sidebar text-sidebar-foreground lg:block">
        <NavList isAdmin={isAdmin} />
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-hero text-primary-foreground">
            <HeartHandshake className="h-4 w-4" />
          </div>
          <span className="font-display font-semibold">{isAdmin ? "Administrador" : "Supervisor"}</span>
        </div>
        <div className="flex items-center">
        <NotificationBell />
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </Button>
        </div>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-0 bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <NavList isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="-mt-2 mb-2 hidden justify-end lg:flex"><NotificationBell /></div>
        <Outlet />
      </main>
    </div>
  );
}
