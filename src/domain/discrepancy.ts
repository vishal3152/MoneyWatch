// A Discrepancy is the first-class gap between the bank-claimed balance and
// our ledger-computed balance. resolution stays null while open; resolving as
// "corrected-my-record" creates an explicit Adjustment leg (never a silent
// edit), while "disputed-with-bank" leaves the ledger untouched.
export type DiscrepancyResolution = "corrected-my-record" | "disputed-with-bank";

export type Discrepancy = {
  id: string;
  reconciliationId: string;
  amountMinor: number;
  resolution: DiscrepancyResolution | null;
};
