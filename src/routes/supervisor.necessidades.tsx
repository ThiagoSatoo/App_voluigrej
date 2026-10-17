import { createFileRoute } from "@tanstack/react-router";
import { OpportunityManager } from "@/components/app/OpportunityManager";

export const Route = createFileRoute("/supervisor/necessidades")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Necessidades — Painel do Supervisor" },
      { name: "description", content: "Crie necessidades por data e horário e confirme os voluntários selecionados." },
      { property: "og:title", content: "Necessidades — Painel do Supervisor" },
      { property: "og:description", content: "Crie necessidades e confirme a seleção de voluntários." },
    ],
  }),
  component: () => <OpportunityManager scope="all" />,
});

