import { describe, expect, it } from "vitest";

import { assertValidCalendarDate, InvalidCalendarDateError } from "@/domain/calendar-date";

describe("assertValidCalendarDate", () => {
  it("accepts a valid YYYY-MM-DD date", () => {
    expect(() => assertValidCalendarDate("2026-09-05")).not.toThrow();
  });

  it("rejects a non-date string", () => {
    expect(() => assertValidCalendarDate("not-a-date")).toThrow(InvalidCalendarDateError);
  });

  it("rejects an out-of-range month or day", () => {
    expect(() => assertValidCalendarDate("2026-13-45")).toThrow(InvalidCalendarDateError);
  });

  it("rejects an impossible day that Date would roll into the next month", () => {
    expect(() => assertValidCalendarDate("2026-02-30")).toThrow(InvalidCalendarDateError);
    expect(() => assertValidCalendarDate("2025-02-29")).toThrow(InvalidCalendarDateError);
    expect(() => assertValidCalendarDate("2026-04-31")).toThrow(InvalidCalendarDateError);
  });

  it("accepts a leap day on a leap year", () => {
    expect(() => assertValidCalendarDate("2024-02-29")).not.toThrow();
  });

  it("rejects an empty string", () => {
    expect(() => assertValidCalendarDate("")).toThrow(InvalidCalendarDateError);
  });
});
