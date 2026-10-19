import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, KeyRound, Trash2 } from "lucide-react";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { act } from "@/lib/act";
import { MyCpfCard } from "@/components/app/MyCpfCard";
import { VisibilityPolicyCard } from "@/components/app/VisibilityPolicyCard";
import { PhotoPicker, VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { PageHeader, Panel } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotifPrefsList } from "@/components/app/NotifPrefsList";
import { STAFF_CATEGORIES } from "@/data/notifications";

export const Route = createFileRoute("/supervisor/configuracoes")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Configurações — Painel do Supervisor" },
      { name: "description", content: "Dados da igreja e opções do aplicativo." },
      { property: "og:title", content: "Configurações — Painel do Supervisor" },
      { property: "og:description", content: "Dados da igreja e opções do aplicativo." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { state } = useStore();
  const [s, setS] = useState(state.settings);
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Configurações" />
      <Tabs defaultValue="geral">
        <TabsList className="mb-4 h-11 rounded-xl">
          <TabsTrigger value="geral" className="rounded-lg">Geral</TabsTrigger>
          <TabsTrigger value="notificacoes" className="rounded-lg">Notificações</TabsTrigger>
        </TabsList>
        <TabsContent value="notificacoes">
          <Panel>
            <p className="mb-1 text-sm text-muted-foreground">Preferências do seu usuário. Cada categoria pode ser ativada ou desativada separadamente.</p>
            <NotifPrefsList categories={STAFF_CATEGORIES} />
          </Panel>
        </TabsContent>
        <TabsContent value="geral" className="space-y-4">
      <Panel className="space-y-3">
        {([["churchName", "Nome da instituição (aparece abaixo de “Sistema de escalas”)"]] as const).map(([k, l]) => (
          <div key={k} className="space-y-1.5">
            <Label>{l}</Label>
            <Input value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} className="h-11 rounded-xl" />
          </div>
        ))}
        <Button onClick={() => act(repo.updateSettings({ churchName: s.churchName }), "Configurações salvas")}>Salvar</Button>
      </Panel>
      <VisibilityPolicyCard />
      <Panel className="space-y-3">
        <p className="font-semibold">Minha conta</p>
        <MyCpfCard />
        <MyPhoto />
        <Button variant="outline" onClick={() => navigate({ to: "/trocar-senha" })}><KeyRound /> Alterar minha senha</Button>
      </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MyPhoto() {
  const { state } = useStore();
  const me = state.supervisors.find((x) => x.id === state.session?.userId);
  if (!me) return null;
  return (
    <div className="flex items-center gap-4">
      <VolunteerAvatar name={me.name} photoUrl={me.photoUrl} size="lg" />
      <div className="flex flex-col gap-1.5">
        <PhotoPicker onPick={(photo) => act(repo.setPhoto(me.id, photo), "Foto atualizada")}>
          {(open) => <Button variant="outline" size="sm" onClick={open}><Camera /> {me.photoUrl ? "Trocar foto" : "Adicionar foto"}</Button>}
        </PhotoPicker>
        {me.photoUrl && <Button variant="ghost" size="sm" onClick={() => act(repo.setPhoto(me.id, null), "Foto removida")}><Trash2 /> Remover</Button>}
      </div>
    </div>
  );
}
