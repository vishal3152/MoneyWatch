// Money invariant: every stored/computed amount is integer minor units
// (paise/cents), never floats. These helpers guard that invariant.
export class InvalidMinorUnitsError extends Error {
  constructor() {
    super("Minor units must be safe integers.");
    this.name = "InvalidMinorUnitsError";
  }
}

// Throws unless the amount is a safe integer, so float/overflow bugs fail loud.
export function assertMinorUnits(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new InvalidMinorUnitsError();
  }
}
