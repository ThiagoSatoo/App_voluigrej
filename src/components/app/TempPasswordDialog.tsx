import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Mostra a senha provisória uma única vez — ela não fica salva em lugar nenhum. */
export function TempPasswordDialog({ info, onClose }: { info: { name: string; login: string; password: string } | null; onClose: () => void }) {
  const copy = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(`Acesso à Escala de Voluntários\nLogin: ${info.login}\nSenha provisória: ${info.password}\nNo primeiro acesso você criará sua própria senha.`);
      toast.success("Copiado");
    } catch {
      toast.error("Não foi possível copiar. Anote a senha.");
    }
  };
  return (
    <Dialog open={!!info} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2"><KeyRound className="h-5 w-5" /> Senha provisória</DialogTitle>
        </DialogHeader>
        {info && (
          <div className="space-y-3 text-sm">
            <p>Entregue estes dados a <b>{info.name}</b> pessoalmente ou por mensagem privada.</p>
            <div className="space-y-1 rounded-xl bg-secondary p-4 font-mono">
              <div>Login: <b>{info.login}</b></div>
              <div>Senha: <b className="select-all">{info.password}</b></div>
            </div>
            <p className="text-xs text-muted-foreground">Esta senha aparece só agora. No primeiro acesso a pessoa será obrigada a criar uma senha própria.</p>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={copy}><Copy /> Copiar</Button>
          <Button onClick={onClose}>Pronto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
