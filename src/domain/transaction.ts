import type { TransactionCategory } from "@/domain/transaction-category";

// Trust status: "Confirmed" = human-entered or reviewed; "Imported" = arrived
// via an automated feed (MCP/email import) and not yet reviewed.
export type TrustStatus = "Confirmed" | "Imported";

// One ledger line. Signed amountMinor in integer minor units (credit
// positive, debit negative). transferId links the two legs of a Transfer;
// importBatchId links rows staged through an import batch.
export type Transaction = {
  id: string;
  accountId: string;
  amountMinor: number;
  occurredAt: string;
  description: string;
  trustStatus: TrustStatus;
  transferId: string | null;
  category: TransactionCategory | null;
  importBatchId: string | null;
  // The statement's own reference/confirmation number, when supplied — used for Suspected
  // Duplicate matching (CONTEXT.md). Optional for the same reason as the field below: most
  // Transaction-creating call sites have no such number.
  externalRef?: string | null;
  // Suspected Duplicate (CONTEXT.md) — set only by ImportBatchRepository.create() at commit time.
  // Optional (unlike the other fields above) so the many unrelated call sites that construct a
  // Transaction (manual entry, Transfer/FixedDeposit/Adjustment legs) don't need to know about it;
  // a row read back from the database always carries a real value, never undefined.
  possibleDuplicateOfTransactionId?: string | null;
};

export class InvalidTransactionTimestampError extends Error {
  constructor() {
    super("Transaction timestamp must be a valid ISO 8601 timestamp.");
    this.name = "InvalidTransactionTimestampError";
  }
}

// Accepts any Date-parseable timestamp, rejects garbage loudly, and returns
// the canonical ISO form so ledger ordering/comparison stays consistent.
export function normalizeTransactionTimestamp(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    throw new InvalidTransactionTimestampError();
  }

  return date.toISOString();
}
