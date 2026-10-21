import { useState } from "react";
import { Eye } from "lucide-react";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { VISIBILITY_OPTIONS } from "@/data/selectors";
import type { VisibilityPolicy } from "@/data/types";
import { act } from "@/lib/act";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/app/common";

/** A coordenação escolhe UMA política; o banco aplica a regra para todos os voluntários. */
export function VisibilityPolicyCard() {
  const { state } = useStore();
  const current = state.settings.visibilityPolicy;
  const [sel, setSel] = useState<VisibilityPolicy>(current);
  const [busy, setBusy] = useState(false);
  return (
    <Panel className="space-y-3">
      <div>
        <p className="flex items-center gap-1.5 font-semibold">
          <Eye className="h-4 w-4" /> Quem vê a escala
        </p>
        <p className="text-sm text-muted-foreground">
          Escolha uma opção. Vale para todos os voluntários. A coordenação sempre vê tudo, e o
          responsável sempre vê os turnos dele.
        </p>
      </div>
      <div role="radiogroup" className="space-y-2">
        {VISIBILITY_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={sel === o.value}
            onClick={() => setSel(o.value)}
            className={cn(
              "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition",
              sel === o.value ? "border-primary bg-primary-soft" : "hover:bg-secondary",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2",
                sel === o.value ? "border-primary" : "border-muted-foreground/40",
              )}
            >
              {sel === o.value && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
            </span>
            <span>
              <span className="block text-sm font-semibold">
                {o.title}
                {o.value === current && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(em uso)</span>
                )}
              </span>
              <span className="block text-xs text-muted-foreground">{o.text}</span>
            </span>
          </button>
        ))}
      </div>
      <Button
        disabled={busy || sel === current}
        onClick={async () => {
          setBusy(true);
          await act(
            repo.updateSettings({ visibilityPolicy: sel }),
            "Política de visibilidade atualizada",
          );
          setBusy(false);
        }}
      >
        Aplicar
      </Button>
    </Panel>
  );
}
