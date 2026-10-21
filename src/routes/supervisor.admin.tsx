import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Lock, ShieldCheck } from "lucide-react";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { act } from "@/lib/act";
import {
  SUPERVISOR_NAV,
  VOLUNTEER_NAV,
  navEnabled,
  type NavArea,
  type NavConfig,
  type NavItem,
} from "@/lib/nav";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/supervisor/admin")({
  head: () => ({ meta: [{ title: "Admin — Sistema de escalas" }] }),
  component: AdminPage,
});

/** Só o administrador: liga e desliga as abas que cada perfil vê. */
function AdminPage() {
  const { state } = useStore();
  const [draft, setDraft] = useState<NavConfig>(state.navConfig);
  const [busy, setBusy] = useState(false);
  if (state.session?.role !== "admin")
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Acesso restrito"
        text="Somente o administrador acessa esta tela."
      />
    );

  const dirty = JSON.stringify(draft) !== JSON.stringify(state.navConfig);
  const set = (area: NavArea, key: string, on: boolean) =>
    setDraft((d) => ({ ...d, [area]: { ...d[area], [key]: on } }));

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title="Admin"
        subtitle="Escolha quais abas do menu cada perfil vê. Você, como administrador, sempre vê todas."
      />
      <Notice tone="primary" icon={ShieldCheck}>
        Desligar uma aba tira a tela do menu e bloqueia quem tentar abri-la pelo endereço. O que
        cada perfil pode ver e alterar nos dados continua protegido pelas regras do banco.
      </Notice>
      <div className="grid gap-4 md:grid-cols-2">
        <Area
          title="Coordenador"
          area="supervisor"
          items={SUPERVISOR_NAV.filter((i) => !i.adminOnly)}
          draft={draft}
          onToggle={set}
        />
        <Area
          title="Voluntário e responsável"
          area="voluntario"
          items={VOLUNTEER_NAV}
          draft={draft}
          onToggle={set}
        />
      </div>
      <div className="flex gap-2">
        <Button
          disabled={!dirty || busy}
          onClick={async () => {
            setBusy(true);
            await act(repo.setNavConfig(draft), "Abas atualizadas");
            setBusy(false);
          }}
        >
          {busy ? "Salvando…" : "Salvar"}
        </Button>
        <Button
          variant="outline"
          disabled={!dirty || busy}
          onClick={() => setDraft(state.navConfig)}
        >
          Desfazer
        </Button>
      </div>
    </div>
  );
}

function Area({
  title,
  area,
  items,
  draft,
  onToggle,
}: {
  title: string;
  area: NavArea;
  items: NavItem[];
  draft: NavConfig;
  onToggle: (area: NavArea, key: string, on: boolean) => void;
}) {
  const on = items.filter((i) => navEnabled(draft, area, i)).length;
  return (
    <Panel>
      <div className="mb-1 flex items-baseline justify-between">
        <p className="font-display text-lg font-semibold">{title}</p>
        <span className="text-xs text-muted-foreground">
          {on} de {items.length} ligadas
        </span>
      </div>
      <div className="divide-y">
        {items.map((it) => (
          <label key={it.key} className="flex items-center gap-3 py-2.5">
            <it.icon className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{it.label}</span>
              {(it.locked || it.hint) && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {it.locked && <Lock className="h-3 w-3" />}
                  {it.locked ? `Sempre ligada · ${it.locked}` : it.hint}
                </span>
              )}
            </span>
            <Switch
              checked={navEnabled(draft, area, it)}
              disabled={!!it.locked}
              onCheckedChange={(v) => onToggle(area, it.key, v)}
              aria-label={`${title}: ${it.label}`}
            />
          </label>
        ))}
      </div>
    </Panel>
  );
}
