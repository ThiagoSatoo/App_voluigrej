import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import type { Staff } from "@/data/types";
import { act } from "@/lib/act";
import { TempPasswordDialog } from "@/components/app/TempPasswordDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog, EmptyState, PageHeader, Panel, Pill } from "@/components/app/common";
import { VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/supervisor/supervisores")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Supervisores — Administração" },
      { name: "description", content: "O administrador ativa ou desativa o acesso dos supervisores." },
      { property: "og:title", content: "Supervisores — Administração" },
      { property: "og:description", content: "Gestão do acesso dos supervisores." },
    ],
  }),
  component: SupervisorsPage,
});

function SupervisorsPage() {
  const { state } = useStore();
  const [creating, setCreating] = useState(false);
  const [temp, setTemp] = useState<{ name: string; login: string; password: string } | null>(null);
  const [resetting, setResetting] = useState<Staff | null>(null);
  if (state.session?.role !== "admin")
    return <EmptyState icon={ShieldCheck} title="Acesso restrito" text="Somente o administrador pode gerenciar supervisores." />;
  const list = state.supervisors.filter((s) => s.role === "supervisor").sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div>
      <PageHeader
        title="Supervisores"
        subtitle="Supervisores cuidam do app no dia a dia. Só você, como administrador, cria, desativa ou redefine o acesso deles."
        actions={<Button onClick={() => setCreating(true)}><Plus /> Novo supervisor</Button>}
      />
      {list.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Nenhum supervisor" text="Cadastre o primeiro supervisor." />
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
          {list.map((s) => (
            <Panel key={s.id} className="flex items-center gap-3 p-3.5">
              <VolunteerAvatar name={s.name} photoUrl={s.photoUrl} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{s.name}</div>
                <div className="text-xs text-muted-foreground">Usuário: {s.username}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Pill tone={s.status === "ativo" ? "success" : "muted"}>{s.status === "ativo" ? "Acesso ativo" : "Acesso desativado"}</Pill>
                  {s.mustChangePassword && <Pill tone="warning">Aguardando 1º acesso</Pill>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Switch
                  checked={s.status === "ativo"}
                  aria-label={`Acesso de ${s.name}`}
                  onCheckedChange={() => act(repo.toggleSupervisor(s.id), s.status === "ativo" ? "Acesso desativado" : "Acesso reativado")}
                />
                <Button size="sm" variant="ghost" onClick={() => setResetting(s)}><KeyRound /> Senha</Button>
              </div>
            </Panel>
          ))}
        </div>
      )}
      <NewStaffDialog open={creating} onClose={() => setCreating(false)} onCreated={setTemp} />
      <TempPasswordDialog info={temp} onClose={() => setTemp(null)} />
      <ConfirmDialog
        open={!!resetting}
        onOpenChange={(o) => !o && setResetting(null)}
        title="Redefinir senha?"
        description={`Será gerada uma senha provisória para ${resetting?.name ?? ""}.`}
        confirmLabel="Redefinir"
        onConfirm={async () => {
          const s = resetting;
          if (!s) return;
          const r = await act(repo.resetPassword(s.id));
          if (r.ok && r.tempPassword) setTemp({ name: s.name, login: s.username, password: r.tempPassword });
        }}
      />
    </div>
  );
}

function NewStaffDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (t: { name: string; login: string; password: string }) => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const r = await repo.createStaff(name, username);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success("Supervisor criado");
    if (r.tempPassword) onCreated({ name: name.trim(), login: username.trim().toLowerCase(), password: r.tempPassword });
    setName(""); setUsername(""); setError("");
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Novo supervisor</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nome completo</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" /></div>
          <div className="space-y-1.5">
            <Label>Usuário de acesso</Label>
            <Input value={username} autoCapitalize="none" onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="ex.: maria.silva" className="h-11 rounded-xl" />
            <p className="text-xs text-muted-foreground">Letras minúsculas, números, ponto, hífen ou _ (3 a 32 caracteres).</p>
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Criando…" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
