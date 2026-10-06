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

export const Route = createFileRoute("/supervisor/configuracoes")({
  head: () => ({
    meta: [
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
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Restaurar dados?" description="Todas as alterações feitas nesta demonstração serão perdidas." confirmLabel="Restaurar" onConfirm={() => { repo.resetDemoData(); toast.success("Dados restaurados"); }} />
    </div>
  );
}
