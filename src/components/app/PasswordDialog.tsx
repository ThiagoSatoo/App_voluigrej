import { useState } from "react";
import { KeyRound, RotateCcw } from "lucide-react";
import { repo } from "@/data/repository";
import { act } from "@/lib/act";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Alterar a senha de alguém da equipe: voltar para o CPF ou definir uma senha nova. */
export function PasswordDialog({
  person,
  onClose,
}: {
  person: { id: string; name: string; cpf: string } | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"cpf" | "nova">("cpf");
  const [pass, setPass] = useState("");
  const [conf, setConf] = useState("");
  const [mustChange, setMustChange] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setMode("cpf");
    setPass("");
    setConf("");
    setMustChange(true);
    setError("");
    onClose();
  };

  const save = async () => {
    if (!person) return;
    setError("");
    if (mode === "nova") {
      if (pass.length < 8) return setError("A senha deve ter pelo menos 8 caracteres.");
      if (pass !== conf) return setError("A confirmação não confere.");
    }
    setBusy(true);
    const r =
      mode === "cpf"
        ? await act(repo.resetPassword(person.id), "Senha voltou a ser o CPF")
        : await act(repo.setPassword(person.id, pass, mustChange), "Senha alterada");
    setBusy(false);
    if (r.ok) close();
  };

  return (
    <Dialog open={!!person} onOpenChange={(o) => !o && close()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Alterar senha de {person?.name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={mode === "cpf" ? "default" : "outline"}
            onClick={() => setMode("cpf")}
          >
            <RotateCcw /> Voltar para o CPF
          </Button>
          <Button
            type="button"
            variant={mode === "nova" ? "default" : "outline"}
            onClick={() => setMode("nova")}
          >
            <KeyRound /> Definir nova
          </Button>
        </div>
        {mode === "cpf" ? (
          <p className="rounded-xl bg-secondary p-3 text-sm">
            A senha passa a ser o CPF (somente números)
            {person?.cpf ? (
              <>
                {" "}
                — <b className="font-mono">{person.cpf}</b>
              </>
            ) : null}
            . No próximo acesso, a pessoa será obrigada a criar uma senha nova.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="np">Nova senha (mín. 8 caracteres)</Label>
              <Input
                id="np"
                type="password"
                autoComplete="new-password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc">Confirmar nova senha</Label>
              <Input
                id="nc"
                type="password"
                autoComplete="new-password"
                value={conf}
                onChange={(e) => setConf(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={mustChange} onCheckedChange={(c) => setMustChange(c === true)} />
              Pedir para a pessoa trocar no próximo acesso
            </label>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
