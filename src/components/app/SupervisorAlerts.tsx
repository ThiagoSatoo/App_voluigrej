import { Link } from "@tanstack/react-router";
import { BellRing, Check } from "lucide-react";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { act } from "@/lib/act";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format";

/** Alertas não lidos (ex.: cancelamento deixou a vaga abaixo do mínimo, ou faltou substituto numa escala fixa). */
export function SupervisorAlerts() {
  const { state } = useStore();
  const unread = state.notifications.filter(
    (n) =>
      !n.read &&
      n.recipientId === state.session?.userId &&
      (n.type === "candidatura_cancelada" ||
        n.type === "abaixo_minimo_24h" ||
        (n.type === "indisponivel" && n.message.startsWith("Atenção"))),
  );
  if (unread.length === 0) return null;
  return (
    <div className="mb-5 space-y-2">
      {unread.map((n) => (
        <div
          key={n.id}
          className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive-soft p-4 text-destructive"
        >
          <BellRing className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">{n.message}</p>
            <p className="mt-0.5 text-xs opacity-80">{fmtDateTime(n.createdAt)}</p>
            {n.type === "indisponivel" ? (
              <Link
                to="/supervisor/escala"
                className="mt-1 inline-block text-xs font-bold underline underline-offset-2"
              >
                Escolher substituto na Agenda
              </Link>
            ) : (
              <Link
                to="/supervisor/necessidades"
                className="mt-1 inline-block text-xs font-bold underline underline-offset-2"
              >
                Ver vagas
              </Link>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => act(repo.markNotificationRead(n.id))}
            aria-label="Marcar como lida"
          >
            <Check />
          </Button>
        </div>
      ))}
    </div>
  );
}
