import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { EyeOff } from "lucide-react";
import { useRequireRole } from "@/hooks/use-session";
import { EmptyState, LoadingScreen } from "@/components/app/common";
import { NotificationBell } from "@/components/app/NotificationBell";
import { routeBlocked, visibleNav } from "@/lib/nav";

export const Route = createFileRoute("/voluntario")({
  component: VolunteerLayout,
});

function VolunteerLayout() {
  const { ready, state } = useRequireRole("voluntario");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!ready) return <LoadingScreen />;
  const items = visibleNav(state, "voluntario");
  const blocked = routeBlocked(state, "voluntario", pathname);
  return (
    <div className="min-h-screen">
      <main className="pb-safe relative mx-auto max-w-2xl px-4 pt-6 sm:px-6">
        <div className="absolute right-3 top-3 z-10">
          <NotificationBell className="bg-card/80 backdrop-blur" />
        </div>
        {blocked ? (
          <EmptyState
            icon={EyeOff}
            title="Tela desativada"
            text="Esta área foi desativada pela coordenação."
          />
        ) : (
          <Outlet />
        )}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div
          className="mx-auto grid max-w-2xl"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((it) => (
            <Link
              key={it.key}
              to={it.to}
              activeOptions={{ exact: !!it.exact }}
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
