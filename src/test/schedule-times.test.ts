import { describe, expect, it } from "vitest";
import { oneHourLater, validTimeRange, fmtTimeRange } from "@/lib/time";
import { sortNeeds } from "@/data/selectors";

describe("Scheduling times", () => {
  it("suggests one hour later, preserving minutes", () => {
    expect(oneHourLater("09:00")).toBe("10:00");
    expect(oneHourLater("14:30")).toBe("15:30");
    expect(oneHourLater("23:15")).toBe("00:15");
    expect(oneHourLater("")).toBe("");
  });

  it("requires a valid same-day end after start", () => {
    expect(validTimeRange("09:00", "10:00")).toBe(true);
    expect(validTimeRange("09:00", "09:00")).toBe(false);
    expect(validTimeRange("23:00", "00:00")).toBe(false);
    expect(validTimeRange("25:00", "26:00")).toBe(false);
    expect(fmtTimeRange({ start: "09:00", end: "10:00" })).toBe("09:00 – 10:00");
  });

  it("orders needs by date then start time", () => {
    const needs = [
      { id: "late", date: "2026-11-01", start: "14:00", end: "15:00", slots: 2 },
      { id: "early", date: "2026-11-01", start: "09:00", end: "10:00", slots: 2 },
    ];
    expect(sortNeeds(needs).map((n) => n.id)).toEqual(["early", "late"]);
  });
});