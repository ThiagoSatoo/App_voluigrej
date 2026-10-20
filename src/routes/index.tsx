import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HeartHandshake, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { repo } from "@/data/repository";
import { useStore } from "@/data/store";
import { APP_TITLE, formatCpfInput } from "@/lib/format";
import { supabaseConfigured } from "@/lib/supabase";
import { InstallAppCard } from "@/components/app/InstallAppCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Entrar — Sistema de escalas" },
      { name: "description", content: "Acesse a escala de voluntários: disponibilidade, sorteio, escala e presença." },
      { property: "og:title", content: "Entrar — Sistema de escalas" },
      { property: "og:description", content: "Acesse a escala de voluntários da igreja." },
    ],
  }),
  component: Login,
});

function Login() {
  const { state, hydrated } = useStore();
  const navigate = useNavigate();
  const [cpf, setCpf] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [org, setOrg] = useState("");
  useEffect(() => {
    void repo.publicAppName().then(setOrg);
  }, []);

  useEffect(() => {
    if (!hydrated || !state.session) return;
    if (state.session.mustChangePassword) navigate({ to: "/trocar-senha" });
    else navigate({ to: state.session.role === "admin" || state.session.role === "supervisor" ? "/supervisor" : "/voluntario/escala" });
  }, [hydrated, state.session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const r = await repo.login(cpf, pass);
    setBusy(false);
    setPass("");
    if (!r.ok) return setError(r.error);
    toast.success("Bem-vindo(a)!");
  };

  return (
    <div className="min-h-screen bg-gradient-warm">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-hero text-primary-foreground shadow-elegant">
            <HeartHandshake className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl font-semibold">{APP_TITLE}</h1>
          {org ? <p className="mt-1 text-base font-medium text-foreground/80">{org}</p> : null}
          <p className="mt-2 text-sm text-muted-foreground">Entre com o acesso fornecido pela coordenação.</p>
        </div>

        {!supabaseConfigured && (
          <p className="mb-4 rounded-2xl bg-destructive-soft p-4 text-sm text-destructive">
            O app ainda não está configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.
          </p>
        )}

        <div className="rounded-3xl border bg-card p-5 shadow-soft">
          <form onSubmit={submit} className="space-y-4" autoComplete="on">
            <div className="space-y-1.5">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                name="username"
                autoComplete="username"
                inputMode="numeric"
                placeholder="Somente números"
                className="h-12 rounded-xl"
                value={/[a-z]/i.test(cpf) ? cpf : formatCpfInput(cpf)}
                onChange={(e) => setCpf(e.target.value)}
              />
            </div>
            <PasswordField value={pass} onChange={setPass} />
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</Button>
            <p className="text-center text-xs text-muted-foreground">No primeiro acesso, a senha é o seu CPF (somente números).</p>
          </form>
        </div>

        <InstallAppCard />

        <p className="mt-6 flex items-start gap-2 px-1 text-xs text-muted-foreground">
          <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Esqueceu a senha? Peça à coordenação para redefini-la. Ela volta a ser o seu CPF e você cria uma nova no próximo acesso.
        </p>
      </div>
    </div>
  );
}

function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="pass">Senha</Label>
      <Input id="pass" name="password" autoComplete="current-password" type="password" className="h-12 rounded-xl" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
