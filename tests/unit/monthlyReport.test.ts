import { describe, expect, it } from "vitest";
import { getMonth, getPreviousMonth } from "@/services/monthlyReport";

describe("getMonth", () => {
  it("returns bounds, French label and key", () => {
    expect(getMonth(2026, 10)).toEqual({
      start: "2026-10-01",
      end: "2026-10-31",
      label: "octobre 2026",
      key: "2026-10",
    });
  });

  it("handles leap years", () => {
    expect(getMonth(2028, 2).end).toBe("2028-02-29");
    expect(getMonth(2027, 2).end).toBe("2027-02-28");
  });
});

describe("getPreviousMonth", () => {
  it("returns the previous month at cron time (1st, 06:00 UTC)", () => {
    expect(getPreviousMonth(new Date("2026-11-01T06:00:00Z")).key).toBe("2026-10");
  });

  it("wraps around the year", () => {
    expect(getPreviousMonth(new Date("2027-01-01T06:00:00Z")).key).toBe("2026-12");
  });

  it("uses Paris time, not UTC", () => {
    // 23:30 UTC on Oct 31 is already Nov 1 in Paris
    expect(getPreviousMonth(new Date("2026-10-31T23:30:00Z")).key).toBe("2026-10");
  });
});
