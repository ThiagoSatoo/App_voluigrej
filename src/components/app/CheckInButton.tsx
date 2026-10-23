import { useEffect, useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { act } from "@/lib/act";
import { attendanceFor } from "@/data/selectors";
import { Button } from "@/components/ui/button";
import { nowHM, today } from "@/lib/format";
import { minusMinutes } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Quantos minutos antes do início o voluntário já pode marcar presença (igual ao banco: check_in). */
const EARLY = 60;

/** Hora atual, atualizada a cada 30 s para o botão aparecer/sumir na hora certa. */
function useNowHM() {
  const [now, setNow] = useState(nowHM);
  useEffect(() => {
    const t = setInterval(() => setNow(nowHM()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/**
 * "Estou presente" do próprio voluntário no turno do dia: libera 1 hora antes do início
 * e vale até o fim. Depois disso, só a coordenação/responsável marca. Só aparece no dia do turno.
 */
export function CheckInButton({
  needId,
  date,
  start,
  end,
  onDark,
  className,
}: {
  needId: string;
  date: string;
  start: string;
  end: string;
  /** Sobre o fundo escuro do destaque "Próximo turno". */
  onDark?: boolean;
  className?: string;
}) {
  const { state } = useStore();
  const now = useNowHM();
  const [busy, setBusy] = useState(false);
  if (date !== today()) return null;
  const rec = attendanceFor(state, needId, state.session!.userId);
  const opens = minusMinutes(start, EARLY);
  const muted = onDark ? "text-primary-foreground/85" : "text-muted-foreground";

  if (rec?.status === "presente")
    return (
      <p
        className={cn(
          "flex items-center gap-1.5 rounded-xl bg-success-soft px-3 py-2 text-sm font-semibold text-success",
          className,
        )}
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" /> Presença confirmada
      </p>
    );
  if (now < opens)
    return (
      <p className={cn("flex items-center gap-1.5 text-xs", muted, className)}>
        <Clock className="h-3.5 w-3.5 shrink-0" /> Você poderá marcar presença a partir das {opens}.
      </p>
    );
  if (now > end)
    return (
      <p className={cn("text-xs", muted, className)}>
        Presença não marcada. Se você foi, peça à coordenação para marcar.
      </p>
    );
  return (
    <Button
      variant="success"
      className={cn("h-11 w-full text-base", className)}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await act(repo.checkIn(needId), "Presença confirmada!");
        setBusy(false);
      }}
    >
      <CheckCircle2 /> Estou presente
    </Button>
  );
}
