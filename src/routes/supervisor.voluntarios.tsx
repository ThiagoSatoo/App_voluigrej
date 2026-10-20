import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Camera, KeyRound, Pencil, Plus, Search, UserX } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { act } from "@/lib/act";
import { PasswordDialog } from "@/components/app/PasswordDialog";
import { ROLE_LABEL, ROLE_ORDER, canManageMember, teamMembers, type TeamMember, type TeamRole } from "@/data/selectors";
import { EmptyState, PageHeader, Pill } from "@/components/app/common";
import { PhotoPicker, VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDMY, formatCpfInput, validCpf } from "@/lib/format";
import type { Tone } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/supervisor/voluntarios")({
  head: () => ({
    meta: [
      { title: "Equipe — Sistema de escalas" },
      { name: "description", content: "Todos os usuários: voluntários, responsáveis e supervisores." },
    ],
  }),
  component: TeamPage,
});

const ROLE_TONE: Record<TeamMember["role"], Tone> = { admin: "primary", supervisor: "info", responsavel: "accent", voluntario: "muted" };
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function TeamPage() {
  const { state } = useStore();
  const isAdmin = state.session?.role === "admin";
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"todos" | TeamMember["role"]>("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativo" | "inativo">("ativo");
  const [editing, setEditing] = useState<TeamMember | "new" | null>(null);
  const [pwFor, setPwFor] = useState<TeamMember | null>(null);

  const all = useMemo(() => teamMembers(state), [state]);
  const list = useMemo(
    () =>
      all
        .filter((m) => roleFilter === "todos" || m.role === roleFilter)
        .filter((m) => statusFilter === "todos" || m.status === statusFilter)
        .filter((m) => !q || norm(m.name).includes(norm(q)) || m.cpf.includes(q.replace(/\D/g, "") || "§") || m.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "§"))
        .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name)),
    [all, q, roleFilter, statusFilter],
  );
  const active = all.filter((m) => m.status === "ativo").length;
  const waiting = all.filter((m) => m.status === "ativo" && m.mustChangePassword).length;

  return (
    <div>
      <PageHeader
        title="Equipe"
        subtitle={`${active} ativos de ${all.length}${waiting ? ` · ${waiting} aguardando trocar a senha inicial` : ""}`}
        actions={<Button onClick={() => setEditing("new")}><Plus /> Novo usuário</Button>}
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, CPF ou telefone" className="h-10 rounded-xl bg-card pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
          <SelectTrigger className="h-10 rounded-xl bg-card sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os perfis</SelectItem>
            {(["admin", "supervisor", "responsavel", "voluntario"] as const).map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-10 rounded-xl bg-card sm:w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={UserX} title="Ninguém encontrado" text="Tente outro nome ou filtro." />
      ) : (
        // Uma linha por pessoa. Em telas estreitas a tabela rola para o lado em vez de quebrar a linha.
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-secondary px-3 py-2 font-semibold">Nome</th>
                <th className="px-3 py-2 font-semibold">Perfil</th>
                <th className="px-3 py-2 font-semibold">Nascimento</th>
                <th className="px-3 py-2 font-semibold">Telefone</th>
                <th className="px-3 py-2 font-semibold">CPF (login)</th>
                <th className="px-3 py-2 text-center font-semibold">Ativo</th>
                <th className="px-2 py-2 text-right font-semibold"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((m) => {
                const manage = canManageMember(state, m);
                const isMe = m.id === state.session?.userId;
                return (
                  <tr key={m.id} className={cn("whitespace-nowrap", m.status === "inativo" && "opacity-60")}>
                    <td className="sticky left-0 z-10 bg-card px-3 py-1.5 shadow-[1px_0_0_var(--border)]">
                      <div className="flex items-center gap-2">
                        <VolunteerAvatar name={m.name} photoUrl={m.photoUrl} size="xs" />
                        <span className="max-w-36 truncate font-medium sm:max-w-56" title={m.name}>{m.name}</span>
                        {m.status === "ativo" && m.mustChangePassword && <Pill tone="warning" className="text-[10px]">1º acesso</Pill>}
                      </div>
                    </td>
                    <td className="px-3 py-1.5"><Pill tone={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</Pill></td>
                    <td className="px-3 py-1.5 tabular-nums">{m.birthDate ? fmtDMY(m.birthDate) : "—"}</td>
                    <td className="px-3 py-1.5 tabular-nums">
                      {m.phone ? <a href={`tel:${m.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">{m.phone}</a> : "—"}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs">{m.cpf ? formatCpfInput(m.cpf) : m.username ? `usuário: ${m.username}` : "—"}</td>
                    <td className="px-3 py-1.5 text-center">
                      <Switch
                        checked={m.status === "ativo"}
                        disabled={!manage}
                        aria-label={`Acesso de ${m.name}`}
                        onCheckedChange={() => act(repo.toggleVolunteer(m.id), m.status === "ativo" ? "Acesso desativado" : "Acesso ativado")}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" disabled={!manage || !m.cpf} onClick={() => setPwFor(m)} aria-label={`Alterar senha de ${m.name}`} title="Alterar senha"><KeyRound /><span className="hidden 2xl:inline">Senha</span></Button>
                        <Button size="sm" variant="ghost" disabled={!manage && !(isMe && isAdmin)} onClick={() => setEditing(m)} aria-label={`Editar ${m.name}`} title="Editar"><Pencil /><span className="hidden 2xl:inline">Editar</span></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!isAdmin && <p className="mt-2 text-xs text-muted-foreground">Supervisores e o administrador só podem ser alterados pelo administrador.</p>}

      <MemberForm key={editing === "new" ? "new" : editing?.id ?? "none"} editing={editing} onClose={() => setEditing(null)} isAdmin={isAdmin} />
      <PasswordDialog person={pwFor} onClose={() => setPwFor(null)} />
    </div>
  );
}

function MemberForm({ editing, onClose, isAdmin }: { editing: TeamMember | "new" | null; onClose: () => void; isAdmin: boolean }) {
  const { state } = useStore();
  const m = editing && editing !== "new" ? editing : undefined;
  const isMe = m?.id === state.session?.userId;
  const [name, setName] = useState(m?.name ?? "");
  const [cpf, setCpf] = useState(m?.cpf ?? "");
  const [phone, setPhone] = useState(m?.phone ?? "");
  const [email, setEmail] = useState(m?.email ?? "");
  const [birthDate, setBirthDate] = useState(m?.birthDate ?? "");
  const [role, setRole] = useState<TeamMember["role"]>(m?.role ?? "voluntario");
  const [photoUrl, setPhotoUrl] = useState(m?.photoUrl);
  const [photo, setPhoto] = useState<Blob | null | undefined>(undefined); // undefined = sem alteração
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Perfis que o usuário logado pode atribuir. O administrador não muda o próprio perfil.
  const roleOptions: TeamRole[] = isAdmin ? ["voluntario", "responsavel", "supervisor"] : ["voluntario", "responsavel"];
  const roleLocked = m?.role === "admin" || isMe;
  const cpfLocked = !!m && !m.cpf; // contas antigas cadastram o CPF em Configurações

  const save = async () => {
    setBusy(true);
    const r = await repo.saveVolunteer({
      id: m?.id,
      name,
      cpf: cpfLocked ? "" : cpf,
      phone,
      email,
      birthDate,
      photo,
      role: role === "admin" ? undefined : role,
    });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(m ? "Dados atualizados" : "Usuário criado. Login e senha inicial: o CPF (somente números).", { duration: m ? 3000 : 6000 });
    onClose();
  };

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">{m ? "Editar usuário" : "Novo usuário"}</DialogTitle>
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
          {!cpfLocked && (
            <F label="CPF (é o login)">
              <Input inputMode="numeric" autoFocus={!m} placeholder="Somente números" value={formatCpfInput(cpf)} onChange={(e) => setCpf(e.target.value)} className="h-11 rounded-xl" />
              {cpf.replace(/\D/g, "").length === 11 && !validCpf(cpf) && <p className="text-xs font-medium text-destructive">CPF inválido. Confira os números.</p>}
            </F>
          )}
          <F label="Nome completo"><Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" /></F>
          <F label="Perfil">
            <Select value={role} onValueChange={(r) => setRole(r as TeamMember["role"])} disabled={roleLocked}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {role === "admin" && <SelectItem value="admin">{ROLE_LABEL.admin}</SelectItem>}
                {roleOptions.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}{r === "responsavel" ? " de turno" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            {role === "responsavel" && <p className="text-xs text-muted-foreground">Vê a equipe e os contatos dos turnos que você atribuir a ele, marca presença e gerencia as vagas desses turnos.</p>}
            {role === "supervisor" && <p className="text-xs text-muted-foreground">Cuida do app no dia a dia: equipe, períodos, sorteio, escala e relatórios.</p>}
          </F>
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Data de nascimento"><Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="h-11 rounded-xl" /></F>
            <F label="Telefone"><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl" /></F>
          </div>
          <F label="E-mail (opcional)"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" /></F>
          {!m && <p className="rounded-xl bg-accent-soft p-3 text-xs text-accent-foreground">O login e a senha inicial serão o CPF (somente números). No primeiro acesso a pessoa é obrigada a criar uma senha própria.</p>}
          {cpfLocked && <p className="rounded-xl bg-secondary p-3 text-xs">Esta conta ainda entra pelo usuário antigo. O CPF é cadastrado pela própria pessoa em Configurações → Minha conta.</p>}
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : m ? "Salvar" : "Criar usuário"}</Button>
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
