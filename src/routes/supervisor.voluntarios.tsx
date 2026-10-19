import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Camera, KeyRound, Pencil, Plus, Search, ShieldCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { act } from "@/lib/act";
import { PasswordDialog } from "@/components/app/PasswordDialog";
import type { Volunteer } from "@/data/types";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/app/common";
import { PhotoPicker, VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fmtDMY, formatCpfInput, validCpf } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/supervisor/voluntarios")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Equipe — Painel do Supervisor" },
      { name: "description", content: "Cadastro de usuários, perfis e senhas da equipe." },
      { property: "og:title", content: "Equipe — Painel do Supervisor" },
      { property: "og:description", content: "Cadastro de usuários, perfis e senhas da equipe." },
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
  const [pwFor, setPwFor] = useState<Volunteer | null>(null);

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
        title="Equipe"
        subtitle={`${state.volunteers.filter((v) => v.status === "ativo").length} ativos de ${state.volunteers.length}`}
        actions={<Button onClick={() => setEditing("new")}><Plus /> Novo usuário</Button>}
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
                    {v.role === "responsavel" && <Pill tone="primary">Responsável</Pill>}
                    <Pill tone="accent">{v.recent3m} recentes</Pill>
                  </div>
                </div>
              </button>
              <div className="flex flex-col items-end gap-2">
                <Switch title="Ativar/desativar (os dados e o histórico são preservados)" checked={v.status === "ativo"} onCheckedChange={() => { act(repo.toggleVolunteer(v.id), v.status === "ativo" ? "Voluntário desativado" : "Voluntário ativado"); }} aria-label="Ativo" />
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setPwFor(v)} aria-label={`Alterar senha de ${v.name}`}><KeyRound /> Senha</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(v)}><Pencil /> Editar</Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <VolunteerForm key={editing === "new" ? "new" : editing?.id ?? "none"} editing={editing} onClose={() => setEditing(null)} />
      <PasswordDialog person={pwFor} onClose={() => setPwFor(null)} />

      <Sheet open={!!viewed} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {viewed && <VolunteerProfile v={viewed} onEdit={() => { setViewing(null); setEditing(viewed); }} onPassword={() => { setViewing(null); setPwFor(viewed); }} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function VolunteerProfile({ v, onEdit, onPassword }: { v: Volunteer; onEdit: () => void; onPassword: () => void }) {
  const { state } = useStore();
  const att = state.attendance.filter((a) => a.volunteerId === v.id);
  return (
    <>
      <SheetHeader>
        <SheetTitle className="font-display">Perfil do voluntário</SheetTitle>
      </SheetHeader>
      <div className="mt-6 flex flex-col items-center text-center">
        <VolunteerAvatar name={v.name} photoUrl={v.photoUrl} size="xl" />
        <h2 className="mt-3 font-display text-xl font-semibold">{v.name}</h2>
        <div className="mt-2 flex gap-1.5">
          <Pill tone={v.status === "ativo" ? "success" : "muted"}>{v.status === "ativo" ? "Ativo" : "Inativo"}</Pill>
          {v.role === "responsavel" && <Pill tone="primary">Responsável</Pill>}
        </div>
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
        <Row label="Login (CPF)" value={v.cpf} />
        <Row label="Acesso" value={v.mustChangePassword ? "Aguardando troca da senha inicial" : "Senha própria definida"} />
      </div>
      <label className="mt-4 flex items-center justify-between gap-3 rounded-2xl border p-4">
        <span>
          <span className="flex items-center gap-1.5 text-sm font-semibold"><ShieldCheck className="h-4 w-4" /> Responsável de turno</span>
          <span className="block text-xs text-muted-foreground">Pode ver a equipe e os contatos dos turnos e vagas que você atribuir, registrar presença, substituir e gerenciar vagas desses turnos.</span>
        </span>
        <Switch
          checked={v.role === "responsavel"}
          onCheckedChange={(c) => act(repo.setVolunteerRole(v.id, c ? "responsavel" : "voluntario"), c ? "Agora é responsável" : "Voltou a ser voluntário")}
          aria-label="Responsável de turno"
        />
      </label>
      <div className="mt-5 grid gap-2">
        <Button variant="outline" onClick={onEdit}><Pencil /> Editar dados</Button>
        <Button variant="outline" onClick={onPassword}><KeyRound /> Alterar senha</Button>
      </div>
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
  const [role, setRole] = useState<"voluntario" | "responsavel">(v?.role ?? "voluntario");
  const [photoUrl, setPhotoUrl] = useState(v?.photoUrl);
  const [photo, setPhoto] = useState<Blob | null | undefined>(undefined); // undefined = sem alteração
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const r = await repo.saveVolunteer({ id: v?.id, name, cpf, phone, email, birthDate, photo, role });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(v ? "Dados atualizados" : "Usuário criado. Login e senha inicial: o CPF (somente números).", { duration: v ? 3000 : 6000 });
    onClose();
  };

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">{v ? "Editar usuário" : "Novo usuário"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <VolunteerAvatar name={name || "?"} photoUrl={photoUrl} size="lg" />
            <div className="flex flex-col gap-1.5">
              <PhotoPicker onPick={(blob, preview) => { setPhoto(blob); setPhotoUrl(preview); }}>
                {(open) => <Button type="button" variant="outline" size="sm" onClick={open}><Camera /> {photoUrl ? "Trocar foto" : "Adicionar foto"}</Button>}
              </PhotoPicker>
              {photoUrl && <Button type="button" variant="ghost" size="sm" onClick={() => { setPhoto(null); setPhotoUrl(undefined); }}>Remover</Button>}
              <span className="text-xs text-muted-foreground">Opcional</span>
            </div>
          </div>
          <F label="CPF (é o login)"><Input inputMode="numeric" autoFocus={!v} placeholder="Somente números" value={formatCpfInput(cpf)} onChange={(e) => setCpf(e.target.value)} className="h-11 rounded-xl" /></F>
          {cpf.replace(/\D/g, "").length === 11 && !validCpf(cpf) && <p className="-mt-2 text-xs font-medium text-destructive">CPF inválido. Confira os números.</p>}
          <F label="Nome completo"><Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" /></F>
          <F label="Perfil">
            <Select value={role} onValueChange={(r) => setRole(r as typeof role)}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="voluntario">Voluntário</SelectItem>
                <SelectItem value="responsavel">Responsável de turno</SelectItem>
              </SelectContent>
            </Select>
          </F>
          <F label="Data de nascimento (para avisos de aniversário)"><Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="h-11 rounded-xl" /></F>
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Telefone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl" /></F>
            <F label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" /></F>
          </div>
          {!v && <p className="rounded-xl bg-accent-soft p-3 text-xs text-accent-foreground">O login e a senha inicial serão o CPF (somente números). No primeiro acesso a pessoa é obrigada a criar uma senha própria.</p>}
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : v ? "Salvar" : "Cadastrar"}</Button>
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
