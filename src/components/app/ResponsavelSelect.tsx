import { useStore } from "@/data/store";
import { responsavelOptions } from "@/data/selectors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NONE = "__none__";

/** Escolhe quem cuida de um turno/vaga: supervisores, admin ou voluntários marcados como responsáveis. */
export function ResponsavelSelect({
  value,
  onChange,
  noneLabel = "Sem responsável (equipe)",
  className,
}: {
  value?: string;
  onChange: (id: string | null) => void;
  noneLabel?: string;
  className?: string;
}) {
  const { state } = useStore();
  const options = responsavelOptions(state);
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger className={cn("h-10 rounded-xl bg-card", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name} · {o.kind}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
