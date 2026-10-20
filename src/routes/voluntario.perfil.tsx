import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, KeyRound, LogOut, Trash2 } from "lucide-react";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { act } from "@/lib/act";
import { Button } from "@/components/ui/button";
import { Panel, Pill } from "@/components/app/common";
import { PhotoPicker, VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { fmtDMY } from "@/lib/format";
import { NotifPrefsList } from "@/components/app/NotifPrefsList";

export const Route = createFileRoute("/voluntario/perfil")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
        <div className="mt-3 flex gap-1.5">
          <Pill tone={me.status === "ativo" ? "success" : "muted"}>{me.status === "ativo" ? "Ativo" : "Inativo"}</Pill>
          {me.role === "responsavel" && <Pill tone="primary">Responsável</Pill>}
        </div>
      </Panel>

      <Panel className="space-y-2">
        <PhotoPicker onPick={(photo) => { act(repo.setPhoto(me.id, photo), "Foto atualizada!"); }}>
          {(open) => (
            <Button variant="outline" size="lg" className="w-full justify-start" onClick={open}>
              <Camera /> {me.photoUrl ? "Alterar foto" : "Adicionar foto"}
            </Button>
          )}
        </PhotoPicker>
        {me.photoUrl && (
          <Button variant="ghost" size="lg" className="w-full justify-start text-muted-foreground" onClick={() => { act(repo.setPhoto(me.id, null), "Foto removida"); }}>
            <Trash2 /> Remover foto
          </Button>
        )}
        <Button variant="outline" size="lg" className="w-full justify-start" onClick={() => navigate({ to: "/trocar-senha" })}>
          <KeyRound /> Alterar senha
        </Button>
        <p className="px-1 pt-1 text-xs text-muted-foreground">A foto é opcional e só aparece para a coordenação e para quem serve no mesmo turno que você. Sem foto, exibimos suas iniciais.</p>
      </Panel>

      <Panel className="space-y-1 text-sm">
        <Row label="Telefone" value={me.phone} />
        <Row label="E-mail" value={me.email} />
        <Row label="Nascimento" value={me.birthDate ? fmtDMY(me.birthDate) : "—"} />
        <p className="pt-2 text-xs text-muted-foreground">Para corrigir seus dados, fale com a coordenação.</p>
      </Panel>

      <Panel>
        <p className="font-display text-lg font-semibold">Notificações</p>
        <NotifPrefsList categories={me.role === "responsavel" ? ["substituto_escalado", "indisponivel"] : ["substituto_escalado"]} />
      </Panel>

      <Button variant="ghost" size="lg" className="w-full text-destructive" onClick={async () => { await repo.logout(); navigate({ to: "/" }); }}>
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
