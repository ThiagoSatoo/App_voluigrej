import { useStore } from "@/data/store";
import { repo } from "@/data/repository";
import { NOTIF_DESCRIPTION, NOTIF_LABEL, REMINDERS, prefEnabled } from "@/data/notifications";
import type { NotifType } from "@/data/types";
import { Switch } from "@/components/ui/switch";

/** Independent toggle per category for the signed-in user. */
export function NotifPrefsList({ categories, showReminders = true }: { categories: NotifType[]; showReminders?: boolean }) {
  const { state } = useStore();
  const userId = state.session?.userId ?? "";
  const row = (t: NotifType, label: string, desc?: string) => (
    <label key={t} className="flex items-center justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {desc && <span className="block text-xs text-muted-foreground">{desc}</span>}
      </span>
      <Switch checked={prefEnabled(state, userId, t)} onCheckedChange={(v) => repo.setNotifPref(userId, t, v)} aria-label={label} />
    </label>
  );
  return (
    <div className="divide-y">
      {categories.map((t) => row(t, NOTIF_LABEL[t], NOTIF_DESCRIPTION[t]))}
      {showReminders && (
        <div className="pt-3">
          <p className="text-sm font-semibold">Lembretes de escala confirmada</p>
          <p className="text-xs text-muted-foreground">Ative cada antecedência separadamente. Compromissos cancelados não geram lembrete.</p>
          <div className="divide-y">{REMINDERS.map((r) => row(r.type, NOTIF_DESCRIPTION[r.type]))}</div>
        </div>
      )}
    </div>
  );
}
