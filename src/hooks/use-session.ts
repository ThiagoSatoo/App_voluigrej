import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/data/store";

/** Client-side guard for the prototype. Replace with real auth later. */
/** "supervisor" also admits the admin (full access); staff must still be active. */
export function useRequireRole(role: "supervisor" | "voluntario") {
  const { state, hydrated } = useStore();
  const navigate = useNavigate();
  const session = state.session;
  const me = role === "voluntario" && session ? state.volunteers.find((v) => v.id === session.userId) : undefined;
  const staff = role === "supervisor" && session ? state.supervisors.find((x) => x.id === session.userId) : undefined;
  const ok =
    hydrated &&
    (role === "supervisor"
      ? (session?.role === "supervisor" || session?.role === "admin") && staff?.status === "ativo"
      : session?.role === "voluntario" && !!me && me.status === "ativo");

  useEffect(() => {
    if (!hydrated) return;
    if (!ok) navigate({ to: "/" });
    else if (me?.mustChangePassword) navigate({ to: "/trocar-senha" });
  }, [hydrated, ok, me?.mustChangePassword, navigate]);

  return { state, ready: ok && !me?.mustChangePassword, me, staff, isAdmin: session?.role === "admin" };
}
