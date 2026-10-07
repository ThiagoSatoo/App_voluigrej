import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, CalendarDays, HandHeart, History, Home, UserRound } from "lucide-react";
import { useRequireRole } from "@/hooks/use-session";
import { LoadingScreen } from "@/components/app/common";

export const Route = createFileRoute("/voluntario")({
  component: VolunteerLayout,
});

const items = [
  { to: "/voluntario", label: "Início", icon: Home, exact: true },
  { to: "/voluntario/disponibilidade", label: "Disponível", icon: CalendarCheck },
  { to: "/voluntario/escala", label: "Escala", icon: CalendarDays },
  { to: "/voluntario/vagas", label: "Vagas", icon: HandHeart },
  { to: "/voluntario/historico", label: "Histórico", icon: History },
  { to: "/voluntario/perfil", label: "Perfil", icon: UserRound },
] as const;

function VolunteerLayout() {
  const { ready } = useRequireRole("voluntario");
  if (!ready) return <LoadingScreen />;
  return (
    <div className="min-h-screen">
      <main className="pb-safe mx-auto max-w-2xl px-4 pt-6 sm:px-6">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-6">
          {items.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              activeOptions={{ exact: "exact" in it }}
              className="group flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-muted-foreground data-[status=active]:text-primary"
            >
              <span className="grid h-8 w-10 place-items-center rounded-full transition-colors group-data-[status=active]:bg-primary-soft">
                <it.icon className="h-5 w-5" />
              </span>
              {it.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
