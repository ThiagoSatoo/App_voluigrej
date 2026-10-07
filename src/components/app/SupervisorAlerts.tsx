import { Link } from "@tanstack/react-router";
import { BellRing, Check } from "lucide-react";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format";

/** Unread alerts (e.g. a cancellation left a need below its minimum). */
export function SupervisorAlerts() {
  const { state } = useStore();
  const unread = state.notifications.filter((n) => !n.read);
  if (unread.length === 0) return null;
  return (
    <div className="mb-5 space-y-2">
      {unread.map((n) => (
        <div key={n.id} className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive-soft p-4 text-destructive">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">{n.message}</p>
            <p className="mt-0.5 text-xs opacity-80">{fmtDateTime(n.createdAt)}</p>
            <Link to="/supervisor/necessidades" className="mt-1 inline-block text-xs font-bold underline underline-offset-2">Ver necessidades</Link>
          </div>
          <Button size="sm" variant="ghost" onClick={() => repo.markNotificationRead(n.id)} aria-label="Marcar como lida"><Check /></Button>
        </div>
      ))}
    </div>
  );
}
