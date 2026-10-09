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
      { title: "Alterar senha — Escala de Voluntários" },
      { name: "description", content: "Defina uma nova senha de acesso." },
      { property: "og:title", content: "Alterar senha — Escala de Voluntários" },
      { property: "og:description", content: "Defina uma nova senha de acesso." },
    ],
  }),
  component: ChangePassword,
});

function ChangePassword() {
  const { state, hydrated } = useStore();
  const navigate = useNavigate();
  const me = state.session?.role === "voluntario" ? state.volunteers.find((v) => v.id === state.session!.userId) : undefined;
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [conf, setConf] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (hydrated && !me) navigate({ to: "/" });
  }, [hydrated, me, navigate]);
  if (!me) return <LoadingScreen />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== conf) return setError("A confirmação não confere com a nova senha.");
    const r = repo.changePassword(me.id, cur, next);
    if (!r.ok) return setError(r.error);
    toast.success("Senha alterada com sucesso!");
    navigate({ to: "/voluntario" });
  };

  return (
    <div className="min-h-screen bg-gradient-warm px-5 py-8">
      <div className="mx-auto max-w-md">
        {!me.mustChangePassword && (
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate({ to: "/voluntario/perfil" })}>
            <ArrowLeft /> Voltar
          </Button>
        )}
        <div className="rounded-3xl border bg-card p-6 shadow-soft">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-semibold">{me.mustChangePassword ? "Crie sua nova senha" : "Alterar senha"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {me.mustChangePassword
              ? "Este é seu primeiro acesso. Por segurança, defina uma senha pessoal para continuar."
              : "Informe sua senha atual e escolha uma nova."}
          </p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field id="cur" label={me.mustChangePassword ? "Senha inicial" : "Senha atual"} value={cur} onChange={setCur} />
            <Field id="new" label="Nova senha (mín. 6 caracteres)" value={next} onChange={setNext} />
            <Field id="conf" label="Confirmar nova senha" value={conf} onChange={setConf} />
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" size="lg" className="w-full">Salvar nova senha</Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="password" className="h-12 rounded-xl" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
