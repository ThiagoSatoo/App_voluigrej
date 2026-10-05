import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, KeyRound, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { Button } from "@/components/ui/button";
import { Panel, Pill } from "@/components/app/common";
import { PhotoPicker, VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { maskCpf } from "@/lib/format";

export const Route = createFileRoute("/voluntario/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — Área do Voluntário" },
      { name: "description", content: "Seus dados, foto e senha." },
      { property: "og:title", content: "Meu perfil — Área do Voluntário" },
      { property: "og:description", content: "Seus dados, foto e senha." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { state } = useStore();
  const navigate = useNavigate();
  const me = state.volunteers.find((v) => v.id === state.session!.userId)!;

  return (
    <div className="space-y-4">
      <Panel className="flex flex-col items-center bg-gradient-warm py-8 text-center">
        <VolunteerAvatar name={me.name} photoUrl={me.photoUrl} size="xl" className="ring-4" />
        <h1 className="mt-4 font-display text-2xl font-semibold">{me.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">CPF {maskCpf(me.cpf)}</p>
        <Pill tone={me.status === "ativo" ? "success" : "muted"} className="mt-3">{me.status === "ativo" ? "Ativo" : "Inativo"}</Pill>
      </Panel>

      <Panel className="space-y-2">
        <PhotoPicker onPick={(url) => { repo.setPhoto(me.id, url); toast.success("Foto atualizada!"); }}>
          {(open) => (
            <Button variant="outline" size="lg" className="w-full justify-start" onClick={open}>
              <Camera /> {me.photoUrl ? "Alterar foto" : "Adicionar foto"}
            </Button>
          )}
        </PhotoPicker>
        {me.photoUrl && (
          <Button variant="ghost" size="lg" className="w-full justify-start text-muted-foreground" onClick={() => { repo.setPhoto(me.id, undefined); toast("Foto removida"); }}>
            <Trash2 /> Remover foto
          </Button>
        )}
        <Button variant="outline" size="lg" className="w-full justify-start" onClick={() => navigate({ to: "/trocar-senha" })}>
          <KeyRound /> Alterar senha
        </Button>
        <p className="px-1 pt-1 text-xs text-muted-foreground">A foto é opcional. Sem foto, exibimos suas iniciais.</p>
      </Panel>

      <Panel className="space-y-1 text-sm">
        <Row label="Telefone" value={me.phone} />
        <Row label="E-mail" value={me.email} />
      </Panel>

      <Button variant="ghost" size="lg" className="w-full text-destructive" onClick={() => { repo.logout(); navigate({ to: "/" }); }}>
        <LogOut /> Sair
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
