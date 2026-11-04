import type { Transaction } from "@/domain/transaction";
import { assertMinorUnits } from "@/domain/money";

// Sums signed ledger amounts (credits positive, debits negative) in integer
// minor units. Every addend and the running total are asserted, so a float or
// overflowed amount throws instead of silently corrupting the balance.
export function computeAccountBalance(transactions: readonly Transaction[]) {
  return transactions.reduce((sum, transaction) => {
    assertMinorUnits(transaction.amountMinor);
    const nextBalance = sum + transaction.amountMinor;
    assertMinorUnits(nextBalance);
    return nextBalance;
  }, 0);
}

// Balance as of end-of-day (UTC) on a calendar date: only legs with
// occurredAt <= 23:59:59.999Z that day count. Used for reconciliation cutoffs.
export function computeAccountBalanceAsOf(transactions: readonly Transaction[], asOfDate: string) {
  const cutoff = new Date(`${asOfDate}T23:59:59.999Z`).getTime();

  return computeAccountBalance(transactions.filter((transaction) => Date.parse(transaction.occurredAt) <= cutoff));
}
