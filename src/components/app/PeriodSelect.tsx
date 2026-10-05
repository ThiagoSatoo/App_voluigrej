import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Period } from "@/data/types";
import { periodLabel } from "@/lib/format";
import { sortPeriods } from "@/data/selectors";

export function PeriodSelect({ periods, value, onChange }: { periods: Period[]; value?: string; onChange: (id: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 w-[200px] rounded-xl bg-card">
        <SelectValue placeholder="Selecione o período" />
      </SelectTrigger>
      <SelectContent>
        {sortPeriods(periods).map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {periodLabel(p)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
