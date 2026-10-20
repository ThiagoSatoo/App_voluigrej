import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useStore } from "@/data/store";
import { AttendanceManager } from "@/components/app/AttendanceManager";
import { OpportunityManager } from "@/components/app/OpportunityManager";
import { EmptyState } from "@/components/app/common";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/voluntario/turnos")({
  head: () => ({
    meta: [{ title: "Meus turnos — Responsável" }],
  }),
  component: ResponsavelPage,
});

/** Área do responsável: só os turnos e vagas atribuídos a ele (o banco garante isso). */
function ResponsavelPage() {
  const { state } = useStore();
  if (state.session?.role !== "responsavel")
    return <EmptyState icon={ShieldCheck} title="Acesso restrito" text="Esta área é para responsáveis de turno." />;
  return (
    <div className="pb-4">
      <Tabs defaultValue="escala">
        <TabsList className="mb-4 grid h-11 w-[calc(100%-3rem)] grid-cols-2 rounded-xl">
          <TabsTrigger value="escala" className="rounded-lg">Escala e presença</TabsTrigger>
          <TabsTrigger value="vagas" className="rounded-lg">Vagas</TabsTrigger>
        </TabsList>
        <TabsContent value="escala">
          <AttendanceManager scope="mine" />
        </TabsContent>
        <TabsContent value="vagas">
          <OpportunityManager scope="mine" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
