import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/data/store";

/** Client-side guard for the prototype. Replace with real auth later. */
export function useRequireRole(role: "supervisor" | "voluntario") {
  const { state, hydrated } = useStore();
  const navigate = useNavigate();
  const session = state.session;
  const me = role === "voluntario" && session ? state.volunteers.find((v) => v.id === session.userId) : undefined;
  const ok = hydrated && session?.role === role && (role === "supervisor" || (!!me && me.status === "ativo"));

  useEffect(() => {
    if (!hydrated) return;
    if (!ok) navigate({ to: "/" });
    else if (me?.mustChangePassword) navigate({ to: "/trocar-senha" });
  }, [hydrated, ok, me?.mustChangePassword, navigate]);

  return { state, ready: ok && !me?.mustChangePassword, me };
}
