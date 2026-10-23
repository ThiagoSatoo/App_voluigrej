/** Time inputs use zero-padded, 24-hour HH:mm values. */
export function oneHourLater(start: string): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) return "";
  const [hours, minutes] = start.split(":").map(Number);
  return `${String((hours + 1) % 24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** "HH:mm" menos alguns minutos, sem passar de 00:00. */
export function minusMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const t = Math.max(0, (h ?? 0) * 60 + (m ?? 0) - minutes);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export const validTimeRange = (start: string, end: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(start) && /^([01]\d|2[0-3]):[0-5]\d$/.test(end) && end > start;

export const fmtTimeRange = (range: { start: string; end: string }) =>
  `${range.start} – ${range.end}`;
