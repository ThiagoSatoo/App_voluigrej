import { createFileRoute } from "@tanstack/react-router";
import { SchedulingPage } from "./supervisor.periodos";

// Endereço antigo: abre a mesma página, já na aba de vagas avulsas.
export const Route = createFileRoute("/supervisor/necessidades")({
  head: () => ({ meta: [{ title: "Períodos e necessidades — Painel da Coordenação" }] }),
  component: () => <SchedulingPage tab="vagas" />,
});
