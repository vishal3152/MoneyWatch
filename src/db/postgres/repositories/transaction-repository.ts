import { and, asc, count, desc, eq, gt, gte, inArray, like, lt, lte, sql } from "drizzle-orm";

import type { Transaction } from "@/domain/transaction";
import { normalizeTransactionTimestamp } from "@/domain/transaction";
import { TransactionNotEditableError, TransactionNotFoundError } from "@/db/errors";
import { getScopedDb } from "@/db/postgres/scoped-db";
import { adjustments, transactions } from "@/db/postgres/schema";
import { likeContainsPattern } from "@/db/like-pattern";
import type {
  AccountBalanceTotal,
  InitialLedgerOverview,
  TransactionPage,
  TransactionPageQuery,
  TransactionRepositoryPort,
  TransactionSearchQuery,
  TransactionUpdateInput
} from "@/db/repositories/ports";
import { assertMinorUnits } from "@/domain/money";

function rowToTransaction(row: typeof transactions.$inferSelect): Transaction {
  return {
    id: row.id,
    accountId: row.accountId,
    amountMinor: row.amountMinor,
    occurredAt: row.occurredAt,
    description: row.description,
    trustStatus: row.trustStatus,
    transferId: row.transferId,
    category: row.category as Transaction["category"],
    importBatchId: row.importBatchId,
    externalRef: row.externalRef,
    possibleDuplicateOfTransactionId: row.possibleDuplicateOfTransactionId
  };
}

/** Shared by the page query and its empty-page fallback count, so both filter identically. */
function ledgerConditions(accountId: string, ownerId: string, query: TransactionPageQuery) {
  const conditions = [eq(transactions.accountId, accountId), eq(transactions.ownerId, ownerId)];

  if (query.search && query.search.trim().length > 0) {
    conditions.push(
      sql`lower(${transactions.description}) like ${likeContainsPattern(query.search.trim())} escape '\\'`
    );
  }

  if (query.month && query.month.length > 0) {
    conditions.push(like(transactions.occurredAt, `${query.month}-%`));
  }

  return conditions;
}

function searchConditions(ownerId: string, query: TransactionSearchQuery) {
  const conditions = [
    inArray(transactions.accountId, query.accountIds),
    eq(transactions.ownerId, ownerId)
  ];

  if (query.search && query.search.trim().length > 0) {
    conditions.push(
      sql`lower(${transactions.description}) like ${likeContainsPattern(query.search.trim())} escape '\\'`
    );
  }
  if (query.fromDate) {
    conditions.push(gte(transactions.occurredAt, `${query.fromDate}T00:00:00.000Z`));
  }
  if (query.toDate) {
    conditions.push(lte(transactions.occurredAt, `${query.toDate}T23:59:59.999Z`));
  }
  if (query.category) {
    conditions.push(eq(transactions.category, query.category));
  }
  if (query.direction === "credit") {
    conditions.push(gt(transactions.amountMinor, 0));
  }
  if (query.direction === "debit") {
    conditions.push(lt(transactions.amountMinor, 0));
  }

  return conditions;
}

export class PgTransactionRepository implements TransactionRepositoryPort {
  constructor(
    private readonly connectionString: string,
    private readonly ownerId: string
  ) {}

  async create(input: Transaction): Promise<Transaction> {
    assertMinorUnits(input.amountMinor);
    const occurredAt = normalizeTransactionTimestamp(input.occurredAt);
    const db = getScopedDb(this.connectionString);

    await db.insert(transactions).values({
      id: input.id,
      ownerId: this.ownerId,
      accountId: input.accountId,
      amountMinor: input.amountMinor,
      occurredAt,
      description: input.description,
      trustStatus: input.trustStatus,
      transferId: input.transferId,
      category: input.category,
      importBatchId: input.importBatchId,
      externalRef: input.externalRef ?? null,
      possibleDuplicateOfTransactionId: input.possibleDuplicateOfTransactionId ?? null
    });

    return { ...input, occurredAt };
  }

  async createMany(inputs: Transaction[]): Promise<Transaction[]> {
    const normalized = inputs.map((input) => {
      assertMinorUnits(input.amountMinor);
      return { ...input, occurredAt: normalizeTransactionTimestamp(input.occurredAt) };
    });
    if (normalized.length === 0) return [];

    const db = getScopedDb(this.connectionString);
    await db.transaction(async (tx) => {
      for (const transaction of normalized) {
        await tx.insert(transactions).values({
          id: transaction.id,
          ownerId: this.ownerId,
          accountId: transaction.accountId,
          amountMinor: transaction.amountMinor,
          occurredAt: transaction.occurredAt,
          description: transaction.description,
          trustStatus: transaction.trustStatus,
          transferId: transaction.transferId,
          category: transaction.category,
          importBatchId: transaction.importBatchId,
          externalRef: transaction.externalRef ?? null,
          possibleDuplicateOfTransactionId: transaction.possibleDuplicateOfTransactionId ?? null
        });
      }
    });

    return normalized;
  }

  async getById(transactionId: string): Promise<Transaction | null> {
    const db = getScopedDb(this.connectionString);

    const rows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.ownerId, this.ownerId)));

    const row = rows[0];
    return row ? rowToTransaction(row) : null;
  }

  async listByAccountId(accountId: string): Promise<Transaction[]> {
    const db = getScopedDb(this.connectionString);

    const rows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.accountId, accountId), eq(transactions.ownerId, this.ownerId)))
      .orderBy(asc(transactions.occurredAt), asc(transactions.id));

    return rows.map(rowToTransaction);
  }

  async listRecentByAccountIds(accountIds: string[], limit: number): Promise<Transaction[]> {
    if (accountIds.length === 0) {
      return [];
    }

    const db = getScopedDb(this.connectionString);
    const rows = await db
      .select()
      .from(transactions)
      .where(
        and(inArray(transactions.accountId, accountIds), eq(transactions.ownerId, this.ownerId))
      )
      .orderBy(desc(transactions.occurredAt), desc(transactions.id))
      .limit(limit);

    return rows.map(rowToTransaction);
  }

  async search(query: TransactionSearchQuery): Promise<TransactionPage> {
    if (query.accountIds.length === 0) {
      return { rows: [], total: 0 };
    }

    const db = getScopedDb(this.connectionString);
    const rows = await db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        amountMinor: transactions.amountMinor,
        occurredAt: transactions.occurredAt,
        description: transactions.description,
        trustStatus: transactions.trustStatus,
        transferId: transactions.transferId,
        category: transactions.category,
        importBatchId: transactions.importBatchId,
        externalRef: transactions.externalRef,
        possibleDuplicateOfTransactionId: transactions.possibleDuplicateOfTransactionId,
        total: sql<string>`count(*) over ()`
      })
      .from(transactions)
      .where(and(...searchConditions(this.ownerId, query)))
      .orderBy(desc(transactions.occurredAt), desc(transactions.id))
      .limit(query.limit);

    return {
      rows: rows.map((row) => rowToTransaction({ ...row, ownerId: this.ownerId })),
      total: rows[0] ? Number(rows[0].total) : 0
    };
  }

  async listPageByAccountId(accountId: string, query: TransactionPageQuery): Promise<TransactionPage> {
    const db = getScopedDb(this.connectionString);

    const rows = await db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        amountMinor: transactions.amountMinor,
        occurredAt: transactions.occurredAt,
        description: transactions.description,
        trustStatus: transactions.trustStatus,
        transferId: transactions.transferId,
        category: transactions.category,
        importBatchId: transactions.importBatchId,
        externalRef: transactions.externalRef,
        possibleDuplicateOfTransactionId: transactions.possibleDuplicateOfTransactionId,
        // Windowed count rather than a second COUNT query: the page and its
        // total come back in one round trip, which is the cost that matters
        // against a remote database.
        total: sql<string>`count(*) over ()`
      })
      .from(transactions)
      .where(and(...ledgerConditions(accountId, this.ownerId, query)))
      .orderBy(asc(transactions.occurredAt), asc(transactions.id))
      .limit(query.limit)
      .offset(query.offset);

    return {
      rows: rows.map((row) => rowToTransaction({ ...row, ownerId: this.ownerId })),
      total: rows[0] ? Number(rows[0].total) : await this.countFilteredByAccountId(accountId, query)
    };
  }

  async getInitialLedgerOverview(
    accountId: string,
    limit: number
  ): Promise<InitialLedgerOverview> {
    const db = getScopedDb(this.connectionString);
    const rows = await db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        amountMinor: transactions.amountMinor,
        occurredAt: transactions.occurredAt,
        description: transactions.description,
        trustStatus: transactions.trustStatus,
        transferId: transactions.transferId,
        category: transactions.category,
        importBatchId: transactions.importBatchId,
        externalRef: transactions.externalRef,
        possibleDuplicateOfTransactionId: transactions.possibleDuplicateOfTransactionId,
        total: sql<string>`count(*) over ()`,
        balanceMinor: sql<string>`(
          select coalesce(sum(balance_rows.amount_minor), 0)
          from transactions balance_rows
          where balance_rows.account_id = ${accountId}
            and balance_rows.owner_id = ${this.ownerId}
        )`,
        months: sql<string[]>`(
          select coalesce(json_agg(month order by month desc), '[]'::json)
          from (
            select distinct substr(month_rows.occurred_at, 1, 7) as month
            from transactions month_rows
            where month_rows.account_id = ${accountId}
              and month_rows.owner_id = ${this.ownerId}
          ) distinct_months
        )`
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          eq(transactions.ownerId, this.ownerId)
        )
      )
      .orderBy(asc(transactions.occurredAt), asc(transactions.id))
      .limit(limit);

    if (!rows[0]) {
      return { page: { rows: [], total: 0 }, months: [], balanceMinor: 0 };
    }

    return {
      page: {
        rows: rows.map((row) => rowToTransaction({ ...row, ownerId: this.ownerId })),
        total: Number(rows[0].total)
      },
      months: rows[0].months,
      balanceMinor: Number(rows[0].balanceMinor)
    };
  }

  /**
   * Only reached when the requested page is empty — either past the end of a
   * non-empty result, where `count(*) over ()` returns no row to read the total
   * from, or a genuinely empty ledger.
   */
  private async countFilteredByAccountId(accountId: string, query: TransactionPageQuery): Promise<number> {
    const db = getScopedDb(this.connectionString);

    const [row] = await db
      .select({ total: count() })
      .from(transactions)
      .where(and(...ledgerConditions(accountId, this.ownerId, query)));

    return row?.total ?? 0;
  }

  async countByAccountId(accountId: string): Promise<number> {
    const db = getScopedDb(this.connectionString);

    const [row] = await db
      .select({ total: count() })
      .from(transactions)
      .where(and(eq(transactions.accountId, accountId), eq(transactions.ownerId, this.ownerId)));

    return row?.total ?? 0;
  }

  async listMonthsByAccountId(accountId: string): Promise<string[]> {
    const db = getScopedDb(this.connectionString);

    const rows = await db
      .selectDistinct({ month: sql<string>`substr(${transactions.occurredAt}, 1, 7)` })
      .from(transactions)
      .where(and(eq(transactions.accountId, accountId), eq(transactions.ownerId, this.ownerId)))
      .orderBy(desc(sql`substr(${transactions.occurredAt}, 1, 7)`));

    return rows.map((row) => row.month);
  }

  async sumAmountsByAccountIds(accountIds: string[]): Promise<AccountBalanceTotal[]> {
    if (accountIds.length === 0) {
      return [];
    }

    const db = getScopedDb(this.connectionString);

    const rows = await db
      .select({
        accountId: transactions.accountId,
        balanceMinor: sql<string>`coalesce(sum(${transactions.amountMinor}), 0)`
      })
      .from(transactions)
      .where(and(inArray(transactions.accountId, accountIds), eq(transactions.ownerId, this.ownerId)))
      .groupBy(transactions.accountId);

    return rows.map((row) => ({ accountId: row.accountId, balanceMinor: Number(row.balanceMinor) }));
  }

  // Mirrors TransactionRepository.assertEditable() (SQLite): editable/deletable
  // when Imported, or Confirmed with no transferId and no Adjustment referencing it.
  private async assertEditable(
    db: ReturnType<typeof getScopedDb>,
    existing: { id: string; trustStatus: string; transferId: string | null }
  ) {
    if (existing.trustStatus === "Imported") {
      return;
    }
    if (existing.transferId !== null) {
      throw new TransactionNotEditableError("transfer");
    }
    const adjustmentRows = await db
      .select({ id: adjustments.id })
      .from(adjustments)
      .where(and(eq(adjustments.transactionId, existing.id), eq(adjustments.ownerId, this.ownerId)));
    if (adjustmentRows.length > 0) {
      throw new TransactionNotEditableError("adjustment");
    }
  }

  async update(transactionId: string, fields: TransactionUpdateInput): Promise<Transaction> {
    const db = getScopedDb(this.connectionString);
    const rows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.ownerId, this.ownerId)));
    const existing = rows[0];

    if (!existing) {
      throw new TransactionNotFoundError(transactionId);
    }
    await this.assertEditable(db, existing);
    if (fields.amountMinor !== undefined) {
      assertMinorUnits(fields.amountMinor);
    }

    const occurredAt =
      fields.occurredAt !== undefined ? normalizeTransactionTimestamp(fields.occurredAt) : existing.occurredAt;
    const next = {
      amountMinor: fields.amountMinor ?? existing.amountMinor,
      description: fields.description ?? existing.description,
      category: fields.category !== undefined ? fields.category : existing.category,
      occurredAt
    };

    await db
      .update(transactions)
      .set(next)
      .where(and(eq(transactions.id, transactionId), eq(transactions.ownerId, this.ownerId)));

    return rowToTransaction({ ...existing, ...next });
  }

  async delete(transactionId: string): Promise<void> {
    const db = getScopedDb(this.connectionString);
    const rows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.ownerId, this.ownerId)));
    const existing = rows[0];

    if (!existing) {
      return;
    }
    await this.assertEditable(db, existing);

    await db
      .delete(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.ownerId, this.ownerId)));
  }

  async dismissSuspectedDuplicate(transactionId: string): Promise<Transaction> {
    const db = getScopedDb(this.connectionString);
    const rows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.ownerId, this.ownerId)));
    const existing = rows[0];

    if (!existing) {
      throw new TransactionNotFoundError(transactionId);
    }

    await db
      .update(transactions)
      .set({ possibleDuplicateOfTransactionId: null })
      .where(and(eq(transactions.id, transactionId), eq(transactions.ownerId, this.ownerId)));

    return rowToTransaction({ ...existing, possibleDuplicateOfTransactionId: null });
  }
}
