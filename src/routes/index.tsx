import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HeartHandshake, KeyRound, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { repo } from "@/data/repository";
import { useStore } from "@/data/store";
import { formatCpfInput } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Entrar — Escala de Voluntários" },
      { name: "description", content: "Acesse a escala de voluntários: disponibilidade, sorteio, escala e presença." },
      { property: "og:title", content: "Entrar — Escala de Voluntários" },
      { property: "og:description", content: "Acesse a escala de voluntários da igreja." },
    ],
  }),
  component: Login,
});

function Login() {
  const { state, hydrated } = useStore();
  const navigate = useNavigate();
  const [cpf, setCpf] = useState("");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hydrated || !state.session) return;
    navigate({ to: state.session.role !== "voluntario" ? "/supervisor" : "/voluntario" });
  }, [hydrated, state.session, navigate]);

  const loginVol = (e: React.FormEvent) => {
    e.preventDefault();
    const r = repo.loginVolunteer(cpf, pass);
    if (!r.ok) return setError(r.error);
    toast.success("Bem-vindo(a)!");
    navigate({ to: r.mustChange ? "/trocar-senha" : "/voluntario" });
  };
  const loginSup = (e: React.FormEvent) => {
    e.preventDefault();
    const r = repo.loginSupervisor(user, pass);
    if (!r.ok) return setError(r.error);
    navigate({ to: "/supervisor" });
  };

  return (
    <div className="min-h-screen bg-gradient-warm">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-hero text-primary-foreground shadow-elegant">
            <HeartHandshake className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl font-semibold">Escala de Voluntários</h1>
          <p className="mt-2 text-sm text-muted-foreground">{state.settings.churchName}</p>
        </div>

        <div className="rounded-3xl border bg-card p-5 shadow-soft">
          <Tabs defaultValue="vol" onValueChange={() => { setError(""); setPass(""); }}>
            <TabsList className="mb-5 grid h-11 w-full grid-cols-2 rounded-xl">
              <TabsTrigger value="vol" className="rounded-lg"><User className="mr-1.5 h-4 w-4" />Voluntário</TabsTrigger>
              <TabsTrigger value="sup" className="rounded-lg"><ShieldCheck className="mr-1.5 h-4 w-4" />Supervisor</TabsTrigger>
            </TabsList>
            <TabsContent value="vol">
              <form onSubmit={loginVol} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input id="cpf" inputMode="numeric" placeholder="000.000.000-00" className="h-12 rounded-xl" value={formatCpfInput(cpf)} onChange={(e) => setCpf(e.target.value)} />
                </div>
                <PasswordField value={pass} onChange={setPass} />
                {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                <Button type="submit" size="lg" className="w-full">Entrar</Button>
              </form>
            </TabsContent>
            <TabsContent value="sup">
              <form onSubmit={loginSup} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="user">Usuário</Label>
                  <Input id="user" autoCapitalize="none" className="h-12 rounded-xl" value={user} onChange={(e) => setUser(e.target.value)} />
                </div>
                <PasswordField value={pass} onChange={setPass} />
                {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                <Button type="submit" size="lg" className="w-full">Entrar como supervisor</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed bg-card/70 p-4 text-xs text-muted-foreground">
          <p className="mb-2 flex items-center gap-1.5 font-semibold text-foreground"><KeyRound className="h-3.5 w-3.5" />Acessos de demonstração</p>
          <ul className="space-y-1">
            <li>Administrador: <b>admin</b> / <b>123456</b></li>
            <li>Supervisor: <b>supervisor</b> (ou <b>marta</b>) / <b>123456</b></li>
            <li>Voluntário: CPF <b>111.111.111-11</b> / <b>123456</b></li>
            <li>Primeiro acesso (troca de senha): CPF <b>222.222.222-22</b> / <b>123456</b></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="pass">Senha</Label>
      <Input id="pass" type="password" className="h-12 rounded-xl" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
