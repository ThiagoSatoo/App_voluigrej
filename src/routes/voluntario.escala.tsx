import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Lock } from "lucide-react";
import { useStore } from "@/data/store";
import { myScheduleItems, personName, scheduleItems, type ScheduleItem } from "@/data/selectors";
import { DateBadge, EmptyState, PageHeader, Panel, Pill } from "@/components/app/common";
import { VolunteerAvatar } from "@/components/app/VolunteerAvatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtWeekday, today } from "@/lib/format";

export const Route = createFileRoute("/voluntario/escala")({
  head: () => ({
    meta: [
      { title: "Minha escala — Área do Voluntário" },
      { name: "description", content: "Suas datas escaladas publicadas." },
    ],
  }),
  component: MySchedule,
});

/**
 * O que aparece aqui depende da política de visibilidade escolhida pela coordenação.
 * O banco só entrega as pessoas permitidas; esta tela apenas organiza o que chegou.
 * Em nenhuma política existe uma tela com a agenda individual de outra pessoa.
 */
function MySchedule() {
  const { state } = useStore();
  const meId = state.session!.userId;
  const policy = state.settings.visibilityPolicy;
  const mine = myScheduleItems(state, meId);
  const upcoming = mine.filter((a) => a.date >= today());
  const past = mine.filter((a) => a.date < today()).reverse();
  const [tab, setTab] = useState("minha");

  const subtitle =
    policy === "privado"
      ? "Somente as suas escalas publicadas."
      : policy === "mesmo_turno"
        ? "Suas escalas e quem vai servir com você em cada turno."
        : "Suas escalas e a escala geral de todos os turnos.";

  const myList = (
    <div className="space-y-3">
      {upcoming.length === 0 && <EmptyState icon={CalendarDays} title="Sem escalas futuras" text="Você ainda não possui uma escala publicada." />}
      {upcoming.map((a) => <ShiftCard key={a.key} item={a} meId={meId} showPeople={policy !== "privado"} />)}
      {past.length > 0 && (
        <section className="pt-2">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Anteriores</h2>
          <div className="space-y-2">
            {past.map((a) => (
              <Panel key={a.key} className="flex items-center gap-3 p-3 opacity-80">
                <DateBadge date={a.date} className="h-11 w-11" />
                <div className="flex-1 text-sm">
                  <div className="font-semibold">{fmtWeekday(a.date)}</div>
                  <div className="text-muted-foreground">{a.start} – {a.end}</div>
                </div>
              </Panel>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Escala" subtitle={subtitle} />
      {policy === "escala_geral" ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 grid h-11 w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="minha" className="rounded-lg">Minha escala</TabsTrigger>
            <TabsTrigger value="geral" className="rounded-lg">Escala geral</TabsTrigger>
          </TabsList>
          <TabsContent value="minha">{myList}</TabsContent>
          <TabsContent value="geral"><GeneralSchedule meId={meId} /></TabsContent>
        </Tabs>
      ) : (
        myList
      )}
      {policy === "privado" && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Por decisão da coordenação, os nomes dos colegas de turno não são exibidos.</p>
      )}
    </div>
  );
}

function ShiftCard({ item: a, meId, showPeople }: { item: ScheduleItem; meId: string; showPeople: boolean }) {
  const { state } = useStore();
  const others = a.people.filter((id) => id !== meId);
  return (
    <Panel className="p-4">
      <div className="flex items-center gap-3">
        <DateBadge date={a.date} />
        <div className="flex-1">
          <div className="font-semibold">{fmtWeekday(a.date)}</div>
          <div className="text-sm text-muted-foreground">{a.start} – {a.end}{a.note ? ` · ${a.note}` : ""}</div>
        </div>
        <Pill tone={a.kind === "vaga" ? "accent" : "primary"}>{a.kind === "vaga" ? "Vaga" : "Escalado"}</Pill>
      </div>
      {showPeople && others.length > 0 && <People ids={others} title="Com você" />}
      {a.responsavelId && a.responsavelId !== meId && (
        <p className="mt-2 text-xs text-muted-foreground">Responsável: {personName(state, a.responsavelId) ?? "—"}</p>
      )}
    </Panel>
  );
}

/** Todos os turnos com os nomes. Os nomes não são clicáveis: não há agenda individual de ninguém. */
function GeneralSchedule({ meId }: { meId: string }) {
  const { state } = useStore();
  const items = scheduleItems(state).filter((i) => i.date >= today());
  if (items.length === 0) return <EmptyState icon={CalendarDays} title="Nenhuma escala publicada" />;
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <Panel key={i.key} className={i.people.includes(meId) ? "border-primary p-4" : "p-4"}>
          <div className="flex items-center gap-3">
            <DateBadge date={i.date} />
            <div className="flex-1">
              <div className="font-semibold">{fmtWeekday(i.date)}</div>
              <div className="text-sm text-muted-foreground">{i.start} – {i.end}{i.note ? ` · ${i.note}` : ""}</div>
            </div>
            {i.people.includes(meId) && <Pill tone="primary">Você</Pill>}
          </div>
          <People ids={i.people} />
        </Panel>
      ))}
    </div>
  );
}

function People({ ids, title }: { ids: string[]; title?: string }) {
  const { state } = useStore();
  return (
    <div className="mt-3">
      {title && <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>}
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => {
          const v = state.volunteers.find((x) => x.id === id);
          const nm = personName(state, id) ?? "Voluntário";
          return (
            <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-secondary py-1 pl-1 pr-3 text-xs font-medium">
              <VolunteerAvatar name={nm} photoUrl={v?.photoUrl} size="xs" />
              {nm}
            </span>
          );
        })}
      </div>
    </div>
  );
}
