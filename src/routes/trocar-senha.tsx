import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { repo } from "@/data/repository";
import { useStore } from "@/data/store";
import { LoadingScreen } from "@/components/app/common";

export const Route = createFileRoute("/trocar-senha")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Alterar senha — Sistema de escalas" },
      { name: "description", content: "Defina uma nova senha de acesso." },
      { property: "og:title", content: "Alterar senha — Sistema de escalas" },
      { property: "og:description", content: "Defina uma nova senha de acesso." },
    ],
  }),
  component: ChangePassword,
});

function ChangePassword() {
  const { state, hydrated } = useStore();
  const navigate = useNavigate();
  const session = state.session;
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [conf, setConf] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hydrated && !session) navigate({ to: "/" });
  }, [hydrated, session, navigate]);
  if (!session) return <LoadingScreen />;
  const isStaff = session.role === "admin" || session.role === "supervisor";
  const home = isStaff ? "/supervisor" : "/voluntario/escala";
  const back = isStaff ? "/supervisor/configuracoes" : "/voluntario/perfil";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== conf) return setError("A confirmação não confere com a nova senha.");
    setBusy(true);
    const r = await repo.changePassword(cur, next);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success("Senha alterada com sucesso!");
    navigate({ to: home });
  };

  return (
    <div className="min-h-screen bg-gradient-warm px-5 py-8">
      <div className="mx-auto max-w-md">
        {!session.mustChangePassword && (
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate({ to: back })}>
            <ArrowLeft /> Voltar
          </Button>
        )}
        <div className="rounded-3xl border bg-card p-6 shadow-soft">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-semibold">
            {session.mustChangePassword ? "Crie sua nova senha" : "Alterar senha"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {session.mustChangePassword
              ? "Você entrou com a senha inicial (seu CPF). Por segurança, crie uma senha pessoal para continuar."
              : "Informe sua senha atual e escolha uma nova."}
          </p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field
              id="cur"
              auto="current-password"
              label={
                session.mustChangePassword
                  ? "Senha atual (seu CPF, se for o primeiro acesso)"
                  : "Senha atual"
              }
              value={cur}
              onChange={setCur}
            />
            <Field
              id="new"
              auto="new-password"
              label="Nova senha (mín. 8 caracteres, com letras e números)"
              value={next}
              onChange={setNext}
            />
            <Field
              id="conf"
              auto="new-password"
              label="Confirmar nova senha"
              value={conf}
              onChange={setConf}
            />
            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "Salvando…" : "Salvar nova senha"}
            </Button>
          </form>
          {session.mustChangePassword && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full text-muted-foreground"
              onClick={() => repo.logout()}
            >
              Sair
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  auto,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  auto: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        autoComplete={auto}
        className="h-12 rounded-xl"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
