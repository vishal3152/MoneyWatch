// A Reconciliation formally compares what the bank claims (the linked
// BalanceSnapshot) against what our own ledger computes at that moment.
// computedBalanceMinor is integer minor units (paise/cents), never floats.
export type Reconciliation = {
  id: string;
  accountId: string;
  // The bank-claimed balance this run was checked against.
  balanceSnapshotId: string;
  // Ledger-computed balance at reconciliation time, in minor units.
  computedBalanceMinor: number;
  reconciledAt: string;
};
