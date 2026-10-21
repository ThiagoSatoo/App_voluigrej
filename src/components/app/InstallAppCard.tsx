import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/lib/pwa";

/** Convite para instalar o app na tela inicial. */
export function InstallAppCard() {
  const { canInstall, showIosHint, install } = useInstallPrompt();
  if (canInstall)
    return (
      <Button variant="outline" size="lg" className="mt-4 w-full" onClick={install}>
        <Download /> Instalar o app no celular
      </Button>
    );
  if (showIosHint)
    return (
      <p className="mt-4 flex items-start gap-2 rounded-2xl border bg-card/70 p-3 text-xs text-muted-foreground">
        <Share className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Para instalar no iPhone: abra no <b>Safari</b>, toque em <b>Compartilhar</b> e depois em{" "}
          <b>Adicionar à Tela de Início</b>.
        </span>
      </p>
    );
  return null;
}
