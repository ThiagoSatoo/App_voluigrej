import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Database, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { ConfirmDialog, Notice, PageHeader, Panel } from "@/components/app/common";
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
  const [confirm, setConfirm] = useState(false);
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
        {([["churchName", "Nome da igreja"], ["ministryName", "Ministério"], ["supervisorName", "Nome do supervisor"]] as const).map(([k, l]) => (
          <div key={k} className="space-y-1.5">
            <Label>{l}</Label>
            <Input value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} className="h-11 rounded-xl" />
          </div>
        ))}
        <Button onClick={() => { repo.updateSettings(s); toast.success("Configurações salvas"); }}>Salvar</Button>
      </Panel>
      <Panel className="space-y-3">
        <Notice tone="primary" icon={Database}>Esta versão usa dados de demonstração salvos apenas neste aparelho. Nenhum banco de dados está conectado.</Notice>
        <Button variant="outline" onClick={() => setConfirm(true)}><RotateCcw /> Restaurar dados de demonstração</Button>
      </Panel>
        </TabsContent>
      </Tabs>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Restaurar dados?" description="Todas as alterações feitas nesta demonstração serão perdidas." confirmLabel="Restaurar" onConfirm={() => { repo.resetDemoData(); toast.success("Dados restaurados"); }} />
    </div>
  );
}
