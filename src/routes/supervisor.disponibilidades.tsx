import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereço antigo: o sorteio agora é feito por escala fixa, na tela Escalas.
export const Route = createFileRoute("/supervisor/disponibilidades")({
  beforeLoad: () => {
    throw redirect({ to: "/supervisor/periodos", replace: true });
  },
});
