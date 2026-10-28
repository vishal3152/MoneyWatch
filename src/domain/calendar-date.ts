export class InvalidCalendarDateError extends Error {
  constructor() {
    super("Enter a valid date.");
    this.name = "InvalidCalendarDateError";
  }
}

export function assertValidCalendarDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new InvalidCalendarDateError();
  }
  // new Date() rolls an impossible day into the next month ("2026-02-30" becomes
  // March 2) instead of returning NaN, so a round-trip check is required.
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new InvalidCalendarDateError();
  }
}
