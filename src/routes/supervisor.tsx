import { useState } from "react";
import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { EyeOff, HeartHandshake, LogOut, Menu } from "lucide-react";
import { NotificationBell } from "@/components/app/NotificationBell";
import { useRequireRole } from "@/hooks/use-session";
import { EmptyState, LoadingScreen } from "@/components/app/common";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { repo } from "@/data/repository";
import { useStore } from "@/data/store";
import { routeBlocked, visibleNav } from "@/lib/nav";
import { APP_TITLE } from "@/lib/format";

export const Route = createFileRoute("/supervisor")({
  component: SupervisorLayout,
});

function NavList({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin: boolean }) {
  const navigate = useNavigate();
  const { state } = useStore();
  const items = visibleNav(state, "supervisor");
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground">
          <HeartHandshake className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-display text-lg font-semibold leading-tight">{APP_TITLE}</div>
          <div className="truncate text-xs opacity-70">{state.settings.churchName || (isAdmin ? "Administrador" : "Supervisor")}</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {items.map((it) => (
          <Link
            key={it.key}
            to={it.to}
            onClick={onNavigate}
            activeOptions={{ exact: !!it.exact }}
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
  const { ready, isAdmin, state } = useRequireRole("supervisor");
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!ready) return <LoadingScreen />;
  const blocked = routeBlocked(state, "supervisor", pathname);
  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-sidebar text-sidebar-foreground lg:block">
        <NavList isAdmin={isAdmin} />
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-hero text-primary-foreground">
            <HeartHandshake className="h-4 w-4" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="font-display font-semibold">{APP_TITLE}</div>
            {state.settings.churchName && <div className="truncate text-[11px] text-muted-foreground">{state.settings.churchName}</div>}
          </div>
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
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="-mt-2 mb-2 hidden justify-end lg:flex"><NotificationBell /></div>
        {blocked ? <EmptyState icon={EyeOff} title="Tela desativada" text="Esta área foi desativada pelo administrador." /> : <Outlet />}
      </main>
    </div>
  );
}
