import { createFileRoute } from "@tanstack/react-router";
import { AttendanceManager } from "@/components/app/AttendanceManager";

export const Route = createFileRoute("/supervisor/presenca")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Presença — Painel do Supervisor" },
      { name: "description", content: "Registre presenças, faltas e substituições." },
      { property: "og:title", content: "Presença — Painel do Supervisor" },
      { property: "og:description", content: "Registre presenças, faltas e substituições." },
    ],
  }),
  component: () => <AttendanceManager scope="all" />,
});

