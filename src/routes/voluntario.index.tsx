import { createFileRoute, redirect } from "@tanstack/react-router";

// A antiga tela "Início" deixou de existir: a primeira tela é a agenda.
export const Route = createFileRoute("/voluntario/")({
  beforeLoad: () => {
    throw redirect({ to: "/voluntario/escala", replace: true });
  },
});
