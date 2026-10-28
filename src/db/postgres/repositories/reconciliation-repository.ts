import { and, asc, count, eq, inArray, isNull, lte, sql } from "drizzle-orm";

import { BalanceSnapshotNotFoundError, DiscrepancyAlreadyResolvedError, DiscrepancyNotFoundError } from "@/db/errors";
import { PgBalanceSnapshotRepository } from "@/db/postgres/repositories/balance-snapshot-repository";
import { getScopedDb } from "@/db/postgres/scoped-db";
import {
  accounts,
  adjustments,
  balanceSnapshots,
  discrepancies,
  reconciliations,
  transactions as transactionRows
} from "@/db/postgres/schema";
import type {
  AccountOpenDiscrepancyCount,
  AdjustmentLink,
  CreateAdjustmentTransactionInput,
  CreateReconciliationInput,
  CreateReconciliationWithSnapshotInput,
  ReconciliationDetail,
  ReconciliationRepositoryPort
} from "@/db/repositories/ports";
import type { Adjustment } from "@/domain/adjustment";
import type { BalanceSnapshot } from "@/domain/balance-snapshot";
import { assertMinorUnits } from "@/domain/money";
import type { Discrepancy, DiscrepancyResolution } from "@/domain/discrepancy";
import type { Reconciliation } from "@/domain/reconciliation";
import { normalizeTransactionTimestamp, type Transaction } from "@/domain/transaction";

function rowToReconciliation(row: typeof reconciliations.$inferSelect): Reconciliation {
  return {
    id: row.id,
    accountId: row.accountId,
    balanceSnapshotId: row.balanceSnapshotId,
    computedBalanceMinor: row.computedBalanceMinor,
    reconciledAt: row.reconciledAt
  };
}

function rowToDiscrepancy(row: typeof discrepancies.$inferSelect): Discrepancy {
  return {
    id: row.id,
    reconciliationId: row.reconciliationId,
    amountMinor: row.amountMinor,
    resolution: row.resolution
  };
}

export class PgReconciliationRepository implements ReconciliationRepositoryPort {
  constructor(
    private readonly connectionString: string,
    private readonly ownerId: string
  ) {}

  async create(input: CreateReconciliationInput): Promise<Reconciliation> {
    const snapshot = await new PgBalanceSnapshotRepository(this.connectionString, this.ownerId).getById(
      input.balanceSnapshotId
    );
    if (!snapshot) {
      throw new BalanceSnapshotNotFoundError(input.balanceSnapshotId);
    }
    return this.persist(snapshot, input, false);
  }

  async createWithSnapshot(
    snapshot: BalanceSnapshot,
    input: CreateReconciliationWithSnapshotInput
  ): Promise<Reconciliation> {
    return this.persist(snapshot, {
      ...input,
      accountId: snapshot.accountId,
      balanceSnapshotId: snapshot.id
    }, true);
  }

  private async persist(
    snapshot: BalanceSnapshot,
    input: CreateReconciliationInput,
    createSnapshot: boolean
  ): Promise<Reconciliation> {
    const db = getScopedDb(this.connectionString);
    const cutoff = `${snapshot.asOfDate}T23:59:59.999Z`;
    const [{ total }] = await db
      .select({ total: sql<string>`coalesce(sum(${transactionRows.amountMinor}), 0)` })
      .from(transactionRows)
      .where(
        and(
          eq(transactionRows.accountId, input.accountId),
          eq(transactionRows.ownerId, this.ownerId),
          lte(transactionRows.occurredAt, cutoff)
        )
      );
    const computedBalanceMinor = Number(total);
    assertMinorUnits(snapshot.balanceMinor);
    assertMinorUnits(computedBalanceMinor);
    const reconciliation: Reconciliation = {
      id: input.id,
      accountId: input.accountId,
      balanceSnapshotId: input.balanceSnapshotId,
      computedBalanceMinor,
      reconciledAt: normalizeTransactionTimestamp(input.reconciledAt)
    };

    await db.transaction(async (tx) => {
      if (createSnapshot) {
        await tx.insert(balanceSnapshots).values({
          id: snapshot.id,
          ownerId: this.ownerId,
          accountId: snapshot.accountId,
          asOfDate: snapshot.asOfDate,
          balanceMinor: snapshot.balanceMinor
        });
      }
      await tx.insert(reconciliations).values({
        id: reconciliation.id,
        ownerId: this.ownerId,
        accountId: reconciliation.accountId,
        balanceSnapshotId: reconciliation.balanceSnapshotId,
        computedBalanceMinor: reconciliation.computedBalanceMinor,
        reconciledAt: reconciliation.reconciledAt
      });
      if (computedBalanceMinor !== snapshot.balanceMinor) {
        await tx.insert(discrepancies).values({
          id: `${reconciliation.id}-discrepancy`,
          ownerId: this.ownerId,
          reconciliationId: reconciliation.id,
          amountMinor: snapshot.balanceMinor - computedBalanceMinor,
          resolution: null
        });
      }
    });

    return reconciliation;
  }

  async getById(reconciliationId: string): Promise<Reconciliation | null> {
    const db = getScopedDb(this.connectionString);

    const rows = await db
      .select()
      .from(reconciliations)
      .where(and(eq(reconciliations.id, reconciliationId), eq(reconciliations.ownerId, this.ownerId)));

    const row = rows[0];
    return row ? rowToReconciliation(row) : null;
  }

  async getDetailById(reconciliationId: string): Promise<ReconciliationDetail | null> {
    const db = getScopedDb(this.connectionString);
    const [row] = await db
      .select({
        reconciliation: reconciliations,
        account: accounts,
        snapshot: balanceSnapshots,
        discrepancy: discrepancies,
        adjustmentTransaction: transactionRows
      })
      .from(reconciliations)
      .innerJoin(
        accounts,
        and(eq(accounts.id, reconciliations.accountId), eq(accounts.ownerId, this.ownerId))
      )
      .innerJoin(
        balanceSnapshots,
        and(
          eq(balanceSnapshots.id, reconciliations.balanceSnapshotId),
          eq(balanceSnapshots.ownerId, this.ownerId)
        )
      )
      .leftJoin(
        discrepancies,
        and(
          eq(discrepancies.reconciliationId, reconciliations.id),
          eq(discrepancies.ownerId, this.ownerId)
        )
      )
      .leftJoin(
        adjustments,
        and(
          eq(adjustments.discrepancyId, discrepancies.id),
          eq(adjustments.ownerId, this.ownerId)
        )
      )
      .leftJoin(
        transactionRows,
        and(
          eq(transactionRows.id, adjustments.transactionId),
          eq(transactionRows.ownerId, this.ownerId)
        )
      )
      .where(
        and(
          eq(reconciliations.id, reconciliationId),
          eq(reconciliations.ownerId, this.ownerId)
        )
      );

    if (!row) {
      return null;
    }

    return {
      reconciliation: rowToReconciliation(row.reconciliation),
      account: {
        id: row.account.id,
        institutionId: row.account.institutionId,
        name: row.account.name,
        accountNumber: row.account.accountNumber ?? null,
        currencyCode: row.account.currencyCode
      },
      snapshot: {
        id: row.snapshot.id,
        accountId: row.snapshot.accountId,
        asOfDate: row.snapshot.asOfDate,
        balanceMinor: row.snapshot.balanceMinor
      },
      discrepancy: row.discrepancy ? rowToDiscrepancy(row.discrepancy) : null,
      adjustmentTransaction: row.adjustmentTransaction
        ? {
            id: row.adjustmentTransaction.id,
            accountId: row.adjustmentTransaction.accountId,
            amountMinor: row.adjustmentTransaction.amountMinor,
            occurredAt: row.adjustmentTransaction.occurredAt,
            description: row.adjustmentTransaction.description,
            trustStatus: row.adjustmentTransaction.trustStatus,
            transferId: row.adjustmentTransaction.transferId,
            category: row.adjustmentTransaction.category as Transaction["category"],
            importBatchId: row.adjustmentTransaction.importBatchId,
            externalRef: row.adjustmentTransaction.externalRef,
            possibleDuplicateOfTransactionId:
              row.adjustmentTransaction.possibleDuplicateOfTransactionId
          }
        : null
    };
  }

  async listByAccountId(accountId: string): Promise<Reconciliation[]> {
    const db = getScopedDb(this.connectionString);

    const rows = await db
      .select()
      .from(reconciliations)
      .where(and(eq(reconciliations.accountId, accountId), eq(reconciliations.ownerId, this.ownerId)))
      .orderBy(asc(reconciliations.reconciledAt), asc(reconciliations.id));

    return rows.map(rowToReconciliation);
  }

  async countOpenDiscrepanciesByAccountIds(
    accountIds: string[]
  ): Promise<AccountOpenDiscrepancyCount[]> {
    if (accountIds.length === 0) {
      return [];
    }

    const db = getScopedDb(this.connectionString);

    const rows = await db
      .select({
        accountId: reconciliations.accountId,
        openDiscrepancies: count(discrepancies.id)
      })
      .from(reconciliations)
      .innerJoin(discrepancies, eq(discrepancies.reconciliationId, reconciliations.id))
      .where(
        and(
          inArray(reconciliations.accountId, accountIds),
          eq(reconciliations.ownerId, this.ownerId),
          isNull(discrepancies.resolution)
        )
      )
      .groupBy(reconciliations.accountId);

    return rows.map((row) => ({
      accountId: row.accountId,
      openDiscrepancies: row.openDiscrepancies
    }));
  }

  async getDiscrepancyByReconciliationId(reconciliationId: string): Promise<Discrepancy | null> {
    const db = getScopedDb(this.connectionString);

    const rows = await db
      .select()
      .from(discrepancies)
      .where(
        and(eq(discrepancies.reconciliationId, reconciliationId), eq(discrepancies.ownerId, this.ownerId))
      );

    const row = rows[0];
    return row ? rowToDiscrepancy(row) : null;
  }

  async listDiscrepanciesByReconciliationIds(reconciliationIds: string[]): Promise<Discrepancy[]> {
    if (reconciliationIds.length === 0) {
      return [];
    }

    const db = getScopedDb(this.connectionString);

    const rows = await db
      .select()
      .from(discrepancies)
      .where(
        and(inArray(discrepancies.reconciliationId, reconciliationIds), eq(discrepancies.ownerId, this.ownerId))
      );

    return rows.map(rowToDiscrepancy);
  }

  async listAdjustmentLinksByAccountId(accountId: string): Promise<AdjustmentLink[]> {
    const db = getScopedDb(this.connectionString);

    return db
      .select({
        transactionId: adjustments.transactionId,
        reconciliationId: discrepancies.reconciliationId
      })
      .from(adjustments)
      .innerJoin(discrepancies, eq(discrepancies.id, adjustments.discrepancyId))
      .innerJoin(reconciliations, eq(reconciliations.id, discrepancies.reconciliationId))
      .where(and(eq(reconciliations.accountId, accountId), eq(reconciliations.ownerId, this.ownerId)));
  }

  async resolveDiscrepancy(discrepancyId: string, resolution: DiscrepancyResolution): Promise<Discrepancy> {
    const db = getScopedDb(this.connectionString);

    const existing = await db
      .select({ id: discrepancies.id })
      .from(discrepancies)
      .where(and(eq(discrepancies.id, discrepancyId), eq(discrepancies.ownerId, this.ownerId)));

    if (!existing[0]) {
      throw new DiscrepancyNotFoundError(discrepancyId);
    }

    // See the SQLite ReconciliationRepository's identical comment: two concurrent resolve
    // submissions can both read resolution === null before either writes. This conditional
    // update — WHERE resolution IS NULL — is the atomic gate: an empty `.returning()` result
    // means someone else already resolved it, instead of silently overwriting their resolution.
    const rows = await db
      .update(discrepancies)
      .set({ resolution })
      .where(
        and(
          eq(discrepancies.id, discrepancyId),
          eq(discrepancies.ownerId, this.ownerId),
          isNull(discrepancies.resolution)
        )
      )
      .returning();

    const row = rows[0];
    if (!row) {
      throw new DiscrepancyAlreadyResolvedError();
    }

    return rowToDiscrepancy(row);
  }

  async resolveWithAdjustment(
    discrepancyId: string,
    transaction: CreateAdjustmentTransactionInput
  ): Promise<Adjustment> {
    assertMinorUnits(transaction.amountMinor);

    const occurredAt = normalizeTransactionTimestamp(transaction.occurredAt);
    const adjustment: Adjustment = {
      id: `${transaction.id}-adjustment`,
      transactionId: transaction.id,
      discrepancyId
    };

    const db = getScopedDb(this.connectionString);

    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: discrepancies.id })
        .from(discrepancies)
        .where(and(eq(discrepancies.id, discrepancyId), eq(discrepancies.ownerId, this.ownerId)));

      if (!existing[0]) {
        throw new DiscrepancyNotFoundError(discrepancyId);
      }

      // The same race as resolveDiscrepancy's, and much more costly here: without this
      // conditional-update gate, two concurrent calls both insert their own Adjustment
      // Transaction against the same Discrepancy — adjustments.discrepancy_id carries no
      // unique constraint — silently doubling the ledger correction. Run this first so a lost
      // race throws before any Transaction/Adjustment row is inserted, and the transaction
      // rolls back cleanly.
      const resolvedRows = await tx
        .update(discrepancies)
        .set({ resolution: "corrected-my-record" })
        .where(
          and(
            eq(discrepancies.id, discrepancyId),
            eq(discrepancies.ownerId, this.ownerId),
            isNull(discrepancies.resolution)
          )
        )
        .returning();

      if (!resolvedRows[0]) {
        throw new DiscrepancyAlreadyResolvedError();
      }

      await tx.insert(transactionRows).values({
        id: transaction.id,
        ownerId: this.ownerId,
        accountId: transaction.accountId,
        amountMinor: transaction.amountMinor,
        occurredAt,
        description: transaction.description,
        trustStatus: "Confirmed",
        transferId: null,
        category: null
      });

      await tx.insert(adjustments).values({
        id: adjustment.id,
        ownerId: this.ownerId,
        transactionId: adjustment.transactionId,
        discrepancyId: adjustment.discrepancyId
      });
    });

    return adjustment;
  }
}
