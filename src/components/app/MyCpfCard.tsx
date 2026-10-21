import { useState } from "react";
import { IdCard } from "lucide-react";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { act } from "@/lib/act";
import { formatCpfInput, validCpf } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/app/common";

/** Contas antigas da coordenação (criadas com "usuário") cadastram o CPF e passam a entrar por ele. */
export function MyCpfCard() {
  const { state } = useStore();
  const me = state.supervisors.find((x) => x.id === state.session?.userId);
  const [cpf, setCpf] = useState("");
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  if (me.cpf)
    return (
      <p className="text-sm text-muted-foreground">
        Seu login é o CPF <b className="font-mono text-foreground">{me.cpf}</b>.
      </p>
    );
  return (
    <div className="space-y-2">
      <Notice tone="warning" icon={IdCard}>
        Cadastre seu CPF. Depois disso, você passa a entrar com o CPF em vez do usuário “
        {me.username}”. Sua senha atual continua a mesma.
      </Notice>
      <div className="flex gap-2">
        <Input
          inputMode="numeric"
          placeholder="Seu CPF"
          value={formatCpfInput(cpf)}
          onChange={(e) => setCpf(e.target.value)}
          className="h-11 rounded-xl"
        />
        <Button
          disabled={busy || !validCpf(cpf)}
          onClick={async () => {
            setBusy(true);
            await act(repo.setMyCpf(cpf), "CPF cadastrado. A partir de agora, entre com ele.");
            setBusy(false);
          }}
        >
          Salvar
        </Button>
      </div>
      {cpf.replace(/\D/g, "").length === 11 && !validCpf(cpf) && (
        <p className="text-xs font-medium text-destructive">CPF inválido. Confira os números.</p>
      )}
    </div>
  );
}
