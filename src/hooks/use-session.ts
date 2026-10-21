import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/data/store";

/**
 * Protege as áreas do app na interface. A proteção real dos dados está no banco (RLS):
 * mesmo que alguém burle esta tela, o servidor não entrega o que o perfil não pode ver.
 * "supervisor" admite admin e supervisor; "voluntario" admite voluntário e responsável.
 */
export function useRequireRole(area: "supervisor" | "voluntario") {
  const { state, hydrated } = useStore();
  const navigate = useNavigate();
  const session = state.session;
  const role = session?.role;
  const ok =
    hydrated &&
    !!session &&
    (area === "supervisor"
      ? role === "admin" || role === "supervisor"
      : role === "voluntario" || role === "responsavel");
  const me =
    area === "voluntario" && session
      ? state.volunteers.find((v) => v.id === session.userId)
      : undefined;
  const staff =
    area === "supervisor" && session
      ? state.supervisors.find((x) => x.id === session.userId)
      : undefined;

  useEffect(() => {
    if (!hydrated) return;
    if (!ok) navigate({ to: "/" });
    else if (session?.mustChangePassword) navigate({ to: "/trocar-senha" });
  }, [hydrated, ok, session?.mustChangePassword, navigate]);

  return {
    state,
    ready: ok && !session?.mustChangePassword && (area === "supervisor" ? !!staff : !!me),
    me,
    staff,
    isAdmin: role === "admin",
    isResponsavel: role === "responsavel",
  };
}
