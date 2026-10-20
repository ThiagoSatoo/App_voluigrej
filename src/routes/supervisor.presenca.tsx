import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereço antigo: a presença agora é marcada direto na Agenda.
export const Route = createFileRoute("/supervisor/presenca")({
  beforeLoad: () => {
    throw redirect({ to: "/supervisor/escala", replace: true });
  },
});
