import type { AppState, Need } from "./types";
import { oneHourLater } from "@/lib/time";

/** Upgrade saved prototype shifts without changing IDs or scheduling history. */
export function migrateScheduleTimes(state: AppState): AppState {
  return {
    ...state,
    periods: state.periods.map((period) => ({
      ...period,
      needs: period.needs.map((need: Need & { shift?: string }) => {
        const { shift, ...rest } = need;
        const start = need.start || (shift === "Tarde" ? "14:00" : shift === "Noite" ? "19:00" : "09:00");
        return { ...rest, start, end: need.end || oneHourLater(start) };
      }),
    })),
  };
}