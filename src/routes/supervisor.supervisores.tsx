import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/app/common";
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
  if (state.session?.role !== "admin")
    return <EmptyState icon={ShieldCheck} title="Acesso restrito" text="Somente o administrador pode gerenciar supervisores." />;
  const list = state.supervisors.filter((s) => s.role === "supervisor");
  return (
    <div>
      <PageHeader title="Supervisores" subtitle="Somente o administrador pode desativar ou cancelar o acesso de supervisores." />
      <div className="grid gap-2.5 md:grid-cols-2">
        {list.map((s) => (
          <Panel key={s.id} className="flex items-center gap-3 p-3.5">
            <VolunteerAvatar name={s.name} size="md" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{s.name}</div>
              <div className="text-xs text-muted-foreground">Usuário: {s.username}</div>
              <Pill tone={s.status === "ativo" ? "success" : "muted"} className="mt-1">{s.status === "ativo" ? "Acesso ativo" : "Acesso desativado"}</Pill>
            </div>
            <Switch
              checked={s.status === "ativo"}
              aria-label={`Acesso de ${s.name}`}
              onCheckedChange={() => {
                const r = repo.toggleSupervisor(s.id);
                if (!r.ok) toast.error(r.error);
                else toast.success(s.status === "ativo" ? "Acesso desativado" : "Acesso reativado");
              }}
            />
          </Panel>
        ))}
      </div>
    </div>
  );
}
