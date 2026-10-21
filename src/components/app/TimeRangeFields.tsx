import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { oneHourLater } from "@/lib/time";

export function TimeRangeFields({
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={`${id}-start`}>Início</Label>
        <Input
          id={`${id}-start`}
          type="time"
          value={start}
          onChange={(e) => {
            onStartChange(e.target.value);
            onEndChange(oneHourLater(e.target.value));
          }}
          className="h-11 min-w-0 rounded-xl"
        />
      </div>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={`${id}-end`}>Fim</Label>
        <Input
          id={`${id}-end`}
          type="time"
          value={end}
          onChange={(e) => onEndChange(e.target.value)}
          className="h-11 min-w-0 rounded-xl"
        />
      </div>
    </div>
  );
}
