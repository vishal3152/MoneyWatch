// What the bank CLAIMS the balance is at asOfDate (a calendar date), captured
// by the user. balanceMinor is integer minor units. Reconciliation compares
// this claim against the ledger-computed balance.
export type BalanceSnapshot = {
  id: string;
  accountId: string;
  asOfDate: string;
  balanceMinor: number;
};
