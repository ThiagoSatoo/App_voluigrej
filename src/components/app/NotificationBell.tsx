import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { NOTIF_LABEL, notificationsOf } from "@/data/notifications";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, Pill } from "@/components/app/common";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Runs the simulated time-based checks while the app is open (no real push notifications). */
export function useScheduledChecks() {
  useEffect(() => {
    repo.runScheduledChecks();
    const t = setInterval(() => repo.runScheduledChecks(), 60_000);
    return () => clearInterval(t);
  }, []);
}

export function NotificationBell({ className }: { className?: string }) {
  const { state } = useStore();
  const userId = state.session?.userId ?? "";
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"nao_lidas" | "todas">("nao_lidas");
  const all = notificationsOf(state, userId);
  const unread = all.filter((n) => !n.read);
  const list = tab === "nao_lidas" ? unread : all;

  return (
    <>
      <Button variant="ghost" size="icon" className={cn("relative", className)} onClick={() => setOpen(true)} aria-label={`Notificações (${unread.length} não lidas)`}>
        <Bell className="h-5 w-5" />
        {unread.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread.length > 99 ? "99+" : unread.length}
          </span>
        )}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display">Notificações</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="rounded-xl">
                <TabsTrigger value="nao_lidas" className="rounded-lg">Não lidas ({unread.length})</TabsTrigger>
                <TabsTrigger value="todas" className="rounded-lg">Todas</TabsTrigger>
              </TabsList>
            </Tabs>
            {unread.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => repo.markAllNotificationsRead(userId)}><CheckCheck /> Ler todas</Button>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {list.length === 0 ? (
              <EmptyState icon={Bell} title={tab === "nao_lidas" ? "Tudo em dia" : "Nenhuma notificação"} text="Novos avisos aparecem aqui enquanto o app está aberto." />
            ) : (
              list.map((n) => (
                <div key={n.id} className={cn("rounded-2xl border p-3.5 text-sm", !n.read && "border-primary/30 bg-primary-soft/40")}>
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <Pill tone="primary">{NOTIF_LABEL[n.type] ?? n.type}</Pill>
                    <Pill tone={n.read ? "muted" : "warning"}>{n.read ? "Lida" : "Não lida"}</Pill>
                  </div>
                  <p className="font-medium">{n.message}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{fmtDateTime(n.createdAt)}</span>
                    {!n.read && (
                      <Button size="sm" variant="ghost" onClick={() => repo.markNotificationRead(n.id)}><Check /> Marcar como lida</Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">Nesta versão as notificações são simuladas e aparecem somente com o aplicativo aberto.</p>
        </SheetContent>
      </Sheet>
    </>
  );
}
