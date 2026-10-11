import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Camera, KeyRound, Pencil, Plus, Search, UserX } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import type { Volunteer } from "@/data/types";
import { ConfirmDialog, EmptyState, PageHeader, Panel, Pill } from "@/components/app/common";
import { PhotoPicker, VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fmtDMY, formatCpfInput } from "@/lib/format";

export const Route = createFileRoute("/supervisor/voluntarios")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Voluntários — Painel do Supervisor" },
      { name: "description", content: "Cadastro e gestão dos voluntários." },
      { property: "og:title", content: "Voluntários — Painel do Supervisor" },
      { property: "og:description", content: "Cadastro e gestão dos voluntários." },
    ],
  }),
  component: VolunteersPage,
});

function VolunteersPage() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"todos" | "ativo" | "inativo">("todos");
  const [editing, setEditing] = useState<Volunteer | "new" | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const list = useMemo(
    () =>
      state.volunteers
        .filter((v) => filter === "todos" || v.status === filter)
        .filter((v) => v.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.volunteers, q, filter],
  );
  const viewed = state.volunteers.find((v) => v.id === viewing);

  return (
    <div>
      <PageHeader
        title="Voluntários"
        subtitle={`${state.volunteers.filter((v) => v.status === "ativo").length} ativos de ${state.volunteers.length}`}
        actions={<Button onClick={() => setEditing("new")}><Plus /> Novo voluntário</Button>}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome" className="h-11 rounded-xl bg-card pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="h-11 rounded-xl">
            <TabsTrigger value="todos" className="rounded-lg">Todos</TabsTrigger>
            <TabsTrigger value="ativo" className="rounded-lg">Ativos</TabsTrigger>
            <TabsTrigger value="inativo" className="rounded-lg">Inativos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={UserX} title="Nenhum voluntário encontrado" text="Tente outro nome ou filtro." />
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
          {list.map((v) => (
            <Panel key={v.id} className="flex items-center gap-3 p-3.5">
              <button onClick={() => setViewing(v.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <VolunteerAvatar name={v.name} photoUrl={v.photoUrl} size="md" />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{v.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Pill tone={v.status === "ativo" ? "success" : "muted"}>{v.status === "ativo" ? "Ativo" : "Inativo"}</Pill>
                    <Pill tone="accent">{v.recent3m} recentes</Pill>
                  </div>
                </div>
              </button>
              <div className="flex flex-col items-end gap-2">
                <Switch title="Ativar/desativar (os dados e o histórico são preservados)" checked={v.status === "ativo"} onCheckedChange={() => { repo.toggleVolunteer(v.id); toast.success(v.status === "ativo" ? "Voluntário desativado" : "Voluntário ativado"); }} aria-label="Ativo" />
                <Button size="sm" variant="ghost" onClick={() => setEditing(v)}><Pencil /> Editar</Button>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <VolunteerForm key={editing === "new" ? "new" : editing?.id ?? "none"} editing={editing} onClose={() => setEditing(null)} />

      <Sheet open={!!viewed} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {viewed && <VolunteerProfile v={viewed} onEdit={() => { setViewing(null); setEditing(viewed); }} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function VolunteerProfile({ v, onEdit }: { v: Volunteer; onEdit: () => void }) {
  const { state } = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const att = state.attendance.filter((a) => a.volunteerId === v.id);
  return (
    <>
      <SheetHeader>
        <SheetTitle className="font-display">Perfil do voluntário</SheetTitle>
      </SheetHeader>
      <div className="mt-6 flex flex-col items-center text-center">
        <VolunteerAvatar name={v.name} photoUrl={v.photoUrl} size="xl" />
        <h2 className="mt-3 font-display text-xl font-semibold">{v.name}</h2>
        <Pill tone={v.status === "ativo" ? "success" : "muted"} className="mt-2">{v.status === "ativo" ? "Ativo" : "Inativo"}</Pill>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-2 text-center">
        <Mini label="Últ. 3 meses" value={v.recent3m} />
        <Mini label="Últ. 12 meses" value={v.last12m} />
        <Mini label="Presenças" value={att.filter((a) => a.status === "presente").length} />
      </div>
      <div className="mt-5 space-y-2 rounded-2xl bg-secondary p-4 text-sm">
        <Row label="Telefone" value={v.phone} />
        <Row label="E-mail" value={v.email} />
        <Row label="Nascimento" value={v.birthDate ? fmtDMY(v.birthDate) : "—"} />
        <Row label="Última escala" value={v.lastScaleDate ? fmtDMY(v.lastScaleDate) : "—"} />
        <Row label="Desde" value={fmtDMY(v.joinedAt)} />
        <Row label="Acesso" value={v.mustChangePassword ? "Aguardando 1º acesso" : "Senha definida"} />
      </div>
      <div className="mt-5 grid gap-2">
        <Button variant="outline" onClick={onEdit}><Pencil /> Editar dados</Button>
        <Button variant="outline" onClick={() => setConfirmReset(true)}><KeyRound /> Redefinir senha</Button>
      </div>
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Redefinir senha?"
        description={`A senha de ${v.name} voltará para a senha inicial (123456) e será exigida a troca no próximo acesso.`}
        confirmLabel="Redefinir"
        onConfirm={() => { repo.resetPassword(v.id); toast.success("Senha redefinida"); }}
      />
    </>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-primary-soft p-3">
      <div className="font-display text-xl font-semibold text-primary">{value}</div>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function VolunteerForm({ editing, onClose }: { editing: Volunteer | "new" | null; onClose: () => void }) {
  const v = editing && editing !== "new" ? editing : undefined;
  const [name, setName] = useState(v?.name ?? "");
  const [cpf, setCpf] = useState(v?.cpf ?? "");
  const [phone, setPhone] = useState(v?.phone ?? "");
  const [email, setEmail] = useState(v?.email ?? "");
  const [birthDate, setBirthDate] = useState(v?.birthDate ?? "");
  const [photoUrl, setPhotoUrl] = useState(v?.photoUrl);
  const [error, setError] = useState("");

  const save = () => {
    const r = repo.saveVolunteer({ id: v?.id, name, cpf, phone, email, birthDate, photoUrl });
    if (!r.ok) return setError(r.error);
    toast.success(v ? "Dados atualizados" : "Voluntário cadastrado. Senha inicial: 123456");
    onClose();
  };

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">{v ? "Editar voluntário" : "Novo voluntário"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <VolunteerAvatar name={name || "?"} photoUrl={photoUrl} size="lg" />
            <div className="flex flex-col gap-1.5">
              <PhotoPicker onPick={setPhotoUrl}>
                {(open) => <Button type="button" variant="outline" size="sm" onClick={open}><Camera /> {photoUrl ? "Trocar foto" : "Adicionar foto"}</Button>}
              </PhotoPicker>
              {photoUrl && <Button type="button" variant="ghost" size="sm" onClick={() => setPhotoUrl(undefined)}>Remover</Button>}
              <span className="text-xs text-muted-foreground">Opcional</span>
            </div>
          </div>
          <F label="Nome completo"><Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" /></F>
          <F label="Data de nascimento *"><Input type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="h-11 rounded-xl" /></F>
          <F label="CPF (login — visível somente aqui)"><Input inputMode="numeric" value={formatCpfInput(cpf)} onChange={(e) => setCpf(e.target.value)} className="h-11 rounded-xl" /></F>
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Telefone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl" /></F>
            <F label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" /></F>
          </div>
          {!v && <p className="rounded-xl bg-accent-soft p-3 text-xs text-accent-foreground">O voluntário receberá a senha inicial <b>123456</b> e deverá alterá-la no primeiro acesso.</p>}
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>{v ? "Salvar" : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
