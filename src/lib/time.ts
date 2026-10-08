/** Time inputs use zero-padded, 24-hour HH:mm values. */
export function oneHourLater(start: string): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) return "";
  const [hours, minutes] = start.split(":").map(Number);
  return `${String((hours + 1) % 24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export const validTimeRange = (start: string, end: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(start) &&
  /^([01]\d|2[0-3]):[0-5]\d$/.test(end) && end > start;

export const fmtTimeRange = (range: { start: string; end: string }) => `${range.start} – ${range.end}`;