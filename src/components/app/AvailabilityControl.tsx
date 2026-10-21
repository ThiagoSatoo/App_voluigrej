import { useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { firstName } from "@/lib/format";
import { fixedDayStatus, personName } from "@/data/selectors";
import { ConfirmDialog } from "@/components/app/common";
import { cn } from "@/lib/utils";

/**
 * Botão de dois lados: Disponível (verde) | Indisponível (vermelho). O lado preenchido é a situação atual;
 * tocar no outro lado muda. Usado pelo voluntário (para si) e pela coordenação/responsável (por alguém).
 * As regras (avisos, saída do turno, backup) ficam no banco: mark_unavailable / mark_available.
 */
export function AvailabilityControl({
  fixedId,
  date,
  volunteerId,
  className,
}: {
  fixedId: string;
  date: string;
  /** Ausente = a própria pessoa logada. */
  volunteerId?: string;
  className?: string;
}) {
  const { state } = useStore();
  const meId = state.session!.userId;
  const vid = volunteerId ?? meId;
  const self = vid === meId;
  const name = firstName(personName(state, vid) ?? "");
  const st = fixedDayStatus(state, fixedId, vid, date);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const setOff = async () => {
    setBusy(true);
    const r = await repo.markUnavailable(fixedId, date, self ? undefined : vid);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    const msg: Record<string, string> = self
      ? {
          registrado: "Pronto! A coordenação foi avisada.",
          removido: "Você saiu deste dia. O turno continua completo.",
          aguardando: "Você saiu deste dia. A coordenação foi avisada para escolher um substituto.",
        }
      : {
          registrado: `${name} ficou indisponível neste dia.`,
          removido: `${name} saiu do turno. O turno continua completo.`,
          aguardando: `${name} saiu do turno. Escolha um substituto em Agenda → Substituir (há uma sugestão nos avisos).`,
        };
    toast.success(msg[r.outcome ?? ""] ?? msg["registrado"]);
  };

  const setOn = async () => {
    setBusy(true);
    const r = await repo.markAvailable(fixedId, date, self ? undefined : vid);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    const msg: Record<string, string> = self
      ? {
          voltou: "Você voltou para a escala deste dia.",
          backup: "Pronto! Você ficou de backup neste dia.",
          disponivel: "Pronto! Você está disponível neste dia.",
        }
      : {
          voltou: `${name} voltou para a escala deste dia.`,
          backup: `${name} ficou de backup neste dia.`,
          disponivel: `${name} está disponível neste dia.`,
        };
    toast.success(msg[r.outcome ?? ""] ?? msg["disponivel"]);
  };

  const choose = (off: boolean) => {
    if (busy || off === st.off) return;
    if (!off) return void setOn();
    if (st.picked) setConfirm(true);
    else void setOff();
  };

  return (
    <>
      <div
        role="group"
        aria-label={self ? "Sua disponibilidade neste dia" : `Disponibilidade de ${name} neste dia`}
        className={cn(
          "grid h-9 grid-cols-2 overflow-hidden rounded-full border bg-card text-xs font-semibold",
          (busy || st.closed) && "opacity-60",
          className,
        )}
      >
        <button
          type="button"
          disabled={busy || st.closed}
          aria-pressed={!st.off}
          onClick={() => choose(false)}
          className={cn(
            "flex items-center justify-center gap-1 px-2 transition",
            !st.off
              ? "bg-success-soft text-success"
              : "text-muted-foreground hover:bg-success-soft",
          )}
        >
          <Check className="h-3.5 w-3.5 shrink-0" /> Disponível
        </button>
        <button
          type="button"
          disabled={busy || st.closed}
          aria-pressed={st.off}
          onClick={() => choose(true)}
          className={cn(
            "flex items-center justify-center gap-1 border-l px-2 transition",
            st.off
              ? "bg-destructive text-destructive-foreground"
              : "text-muted-foreground hover:bg-destructive-soft",
          )}
        >
          <X className="h-3.5 w-3.5 shrink-0" /> Indisponível
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={self ? "Você não pode neste dia?" : `${name} não pode neste dia?`}
        description={
          self
            ? "Você está escalado(a). Ao confirmar, você sai deste dia e a coordenação é avisada para escolher um substituto."
            : `${name} está escalado(a). Ao confirmar, sai do turno e você precisa escolher um substituto em Agenda → Substituir.`
        }
        confirmLabel="Marcar indisponível"
        onConfirm={() => void setOff()}
      />
    </>
  );
}
