// An Adjustment is the visible correction leg for a Discrepancy resolved as
// "corrected-my-record": it points at both the ledger Transaction that
// carries the correction and the Discrepancy it resolves.
export type Adjustment = {
  id: string;
  transactionId: string;
  discrepancyId: string;
};
