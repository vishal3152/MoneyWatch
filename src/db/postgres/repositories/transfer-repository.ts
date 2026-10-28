import { and, asc, count, eq, gt, notExists, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import {
  DatabaseConstraintError,
  FixedDepositTransferError,
  TransferCurrencyMismatchError,
  TransferNotEditableError,
  TransferNotFoundError
} from "@/db/errors";
import { PgAccountRepository } from "@/db/postgres/repositories/account-repository";
import { PgFixedDepositRepository } from "@/db/postgres/repositories/fixed-deposit-repository";
import { getScopedDb } from "@/db/postgres/scoped-db";
import { accounts, fixedDeposits, transactions, transfers } from "@/db/postgres/schema";
import type { AccountTransferImpact, TransferRepositoryPort } from "@/db/repositories/ports";
import type { FixedDepositStatus } from "@/domain/fixed-deposit";
import { assertMinorUnits } from "@/domain/money";
import { normalizeTransactionTimestamp } from "@/domain/transaction";
import {
  assertValidTransferAmounts,
  assertValidTransferLegs,
  assertValidTransferPurpose,
  type Transfer,
  type TransferPurpose
} from "@/domain/transfer";

function rowToTransfer(row: typeof transfers.$inferSelect): Transfer {
  return {
    id: row.id,
    sourceAccountId: row.sourceAccountId,
    sourceFixedDepositId: row.sourceFixedDepositId,
    sourceAmountMinor: row.sourceAmountMinor,
    sourceCurrencyCode: row.sourceCurrencyCode,
    destinationAccountId: row.destinationAccountId,
    destinationFixedDepositId: row.destinationFixedDepositId,
    destinationAmountMinor: row.destinationAmountMinor,
    destinationCurrencyCode: row.destinationCurrencyCode,
    occurredAt: row.occurredAt,
    description: row.description,
    purpose: row.purpose
  };
}

function closedFixedDepositStatus(maturityDate: string, occurredAt: string): FixedDepositStatus {
  return occurredAt.slice(0, 10) < maturityDate ? "PrematurelyClosed" : "Matured";
}

export class PgTransferRepository implements TransferRepositoryPort {
  constructor(
    private readonly connectionString: string,
    private readonly ownerId: string
  ) {}

  async create(input: Transfer): Promise<Transfer> {
    const transfer = { ...input, occurredAt: normalizeTransactionTimestamp(input.occurredAt) };
    const db = getScopedDb(this.connectionString);

    await this.validateTransferInvariants(transfer);

    await db.transaction(async (tx) => {
      const affectedFixedDeposits: (typeof fixedDeposits.$inferSelect)[] = [];
      for (const fixedDepositId of [transfer.sourceFixedDepositId, transfer.destinationFixedDepositId]
        .filter((id): id is string => id !== null).sort()) {
        const [fixedDeposit] = await tx.select().from(fixedDeposits)
          .where(and(eq(fixedDeposits.id, fixedDepositId), eq(fixedDeposits.ownerId, this.ownerId)))
          .for("update");
        if (!fixedDeposit || fixedDeposit.status !== "Open") {
          throw new FixedDepositTransferError(
            transfer.sourceFixedDepositId === fixedDepositId
              ? "Only an Open Fixed Deposit can be used as a Transfer source."
              : "Only an Open Fixed Deposit can receive a Transfer."
          );
        }
        affectedFixedDeposits.push(fixedDeposit);
      }
      await tx.insert(transfers).values({
        id: transfer.id,
        ownerId: this.ownerId,
        sourceAccountId: transfer.sourceAccountId,
        sourceFixedDepositId: transfer.sourceFixedDepositId,
        sourceAmountMinor: transfer.sourceAmountMinor,
        sourceCurrencyCode: transfer.sourceCurrencyCode,
        destinationAccountId: transfer.destinationAccountId,
        destinationFixedDepositId: transfer.destinationFixedDepositId,
        destinationAmountMinor: transfer.destinationAmountMinor,
        destinationCurrencyCode: transfer.destinationCurrencyCode,
        occurredAt: transfer.occurredAt,
        description: transfer.description,
        purpose: transfer.purpose
      });

      await this.insertLinkedTransactions(tx, transfer);
      for (const fixedDeposit of affectedFixedDeposits) {
        await this.applyFixedDepositTransfer(tx, fixedDeposit, transfer);
      }
    });

    return transfer;
  }

  async update(transferId: string, input: Omit<Transfer, "id">): Promise<Transfer> {
    const existing = await this.getById(transferId);
    if (!existing) {
      throw new TransferNotFoundError(transferId);
    }
    if (existing.purpose === "fixed-deposit-opening" || input.purpose === "fixed-deposit-opening") {
      throw new TransferNotEditableError();
    }

    const transfer: Transfer = {
      ...input,
      id: transferId,
      occurredAt: normalizeTransactionTimestamp(input.occurredAt)
    };
    const db = getScopedDb(this.connectionString);

    await this.validateTransferInvariants(transfer, existing);

    const affectedFixedDepositIds = new Set(
      [
        existing.sourceFixedDepositId,
        existing.destinationFixedDepositId,
        transfer.sourceFixedDepositId,
        transfer.destinationFixedDepositId
      ].filter((id): id is string => id !== null)
    );

    await db.transaction(async (tx) => {
      const affectedFixedDeposits = await this.lockFixedDeposits(tx, [...affectedFixedDepositIds]);
      await tx
        .delete(transactions)
        .where(and(eq(transactions.transferId, transferId), eq(transactions.ownerId, this.ownerId)));
      await tx
        .update(transfers)
        .set({
          sourceAccountId: transfer.sourceAccountId,
          sourceFixedDepositId: transfer.sourceFixedDepositId,
          sourceAmountMinor: transfer.sourceAmountMinor,
          sourceCurrencyCode: transfer.sourceCurrencyCode,
          destinationAccountId: transfer.destinationAccountId,
          destinationFixedDepositId: transfer.destinationFixedDepositId,
          destinationAmountMinor: transfer.destinationAmountMinor,
          destinationCurrencyCode: transfer.destinationCurrencyCode,
          occurredAt: transfer.occurredAt,
          description: transfer.description,
          purpose: transfer.purpose
        })
        .where(and(eq(transfers.id, transferId), eq(transfers.ownerId, this.ownerId)));

      await this.insertLinkedTransactions(tx, transfer);

      // An edit can move a Transfer in time or between Fixed Deposits, so
      // replay every affected history after replacing its ledger projections.
      for (const fixedDeposit of affectedFixedDeposits) {
        await this.recomputeFixedDepositState(tx, fixedDeposit);
      }
    });

    return transfer;
  }

  private async validateTransferInvariants(transfer: Transfer, existing?: Transfer): Promise<void> {
    assertValidTransferLegs(transfer);
    assertValidTransferPurpose(transfer);
    assertValidTransferAmounts(transfer);
    assertMinorUnits(transfer.sourceAmountMinor);
    assertMinorUnits(transfer.destinationAmountMinor);

    const db = getScopedDb(this.connectionString);
    const accounts = new PgAccountRepository(this.connectionString, this.ownerId);
    const fixedDepositRepository = new PgFixedDepositRepository(this.connectionString, this.ownerId);

    if (transfer.sourceAccountId) {
      const account = await accounts.getById(transfer.sourceAccountId);
      if (account && account.currencyCode !== transfer.sourceCurrencyCode) {
        throw new TransferCurrencyMismatchError(
          `Transfer source currency must match the Account's currency (${account.currencyCode}).`
        );
      }
    }

    if (transfer.destinationAccountId) {
      const account = await accounts.getById(transfer.destinationAccountId);
      if (account && account.currencyCode !== transfer.destinationCurrencyCode) {
        throw new TransferCurrencyMismatchError(
          `Transfer destination currency must match the Account's currency (${account.currencyCode}).`
        );
      }
    }

    if (transfer.destinationFixedDepositId) {
      const destination = await fixedDepositRepository.getById(transfer.destinationFixedDepositId);
      if (!destination) {
        throw new DatabaseConstraintError(
          new Error(`Fixed Deposit ${transfer.destinationFixedDepositId} does not exist.`)
        );
      }
      if (destination.currencyCode !== transfer.destinationCurrencyCode) {
        throw new TransferCurrencyMismatchError(
          `Transfer destination currency must match the Fixed Deposit's currency (${destination.currencyCode}).`
        );
      }
      if (destination.status !== "Open") {
        throw new FixedDepositTransferError("Only an Open Fixed Deposit can receive a Transfer.");
      }
      if (transfer.purpose === "fixed-deposit-opening") {
        const existingOpeningRows = await db
          .select()
          .from(transfers)
          .where(
            and(
              eq(transfers.destinationFixedDepositId, transfer.destinationFixedDepositId as string),
              eq(transfers.purpose, "fixed-deposit-opening"),
              eq(transfers.ownerId, this.ownerId)
            )
          );
        if (existingOpeningRows[0]) {
          throw new FixedDepositTransferError("A Fixed Deposit can only have one opening Transfer.");
        }
        if (
          transfer.sourceCurrencyCode === transfer.destinationCurrencyCode &&
          transfer.destinationAmountMinor !== destination.originalPrincipalMinor
        ) {
          throw new FixedDepositTransferError(
            "Opening Transfer amount must match the Fixed Deposit original principal."
          );
        }
      }
    }

    if (transfer.sourceFixedDepositId) {
      const source = await fixedDepositRepository.getById(transfer.sourceFixedDepositId);

      if (!source) {
        throw new DatabaseConstraintError(new Error(`Fixed Deposit ${transfer.sourceFixedDepositId} does not exist.`));
      }
      if (source.currencyCode !== transfer.sourceCurrencyCode) {
        throw new TransferCurrencyMismatchError(
          `Transfer source currency must match the Fixed Deposit's currency (${source.currencyCode}).`
        );
      }
      // See the SQLite TransferRepository's identical comment: editing the very Transfer that
      // is already this Fixed Deposit's withdrawal source means `source.status`/
      // `source.principalMinor` still reflect that Transfer's OLD amount, so treat its old
      // effect as already reversed before validating the new one.
      const isEditingSameWithdrawal =
        existing !== undefined &&
        existing.sourceFixedDepositId === transfer.sourceFixedDepositId &&
        existing.purpose === "fixed-deposit-withdrawal";
      const effectivePrincipalMinor = isEditingSameWithdrawal
        ? source.principalMinor + existing!.sourceAmountMinor
        : source.principalMinor;

      if (source.status !== "Open" && !isEditingSameWithdrawal) {
        throw new FixedDepositTransferError("Only an Open Fixed Deposit can be used as a Transfer source.");
      }
      if (transfer.destinationAccountId !== source.linkedAccountId) {
        throw new FixedDepositTransferError("A Fixed Deposit withdrawal must pay out to its linked Account.");
      }
      if (
        transfer.occurredAt.slice(0, 10) < source.maturityDate &&
        transfer.sourceAmountMinor > effectivePrincipalMinor
      ) {
        throw new FixedDepositTransferError("Withdrawal amount cannot exceed the Fixed Deposit current principal.");
      }
    }

  }

  private async insertLinkedTransactions(tx: PostgresJsDatabase, transfer: Transfer): Promise<void> {
    if (transfer.sourceAccountId) {
      await tx.insert(transactions).values({
        id: `${transfer.id}-source`,
        ownerId: this.ownerId,
        accountId: transfer.sourceAccountId,
        amountMinor: -transfer.sourceAmountMinor,
        occurredAt: transfer.occurredAt,
        description: transfer.description,
        trustStatus: "Confirmed",
        transferId: transfer.id
      });
    }

    if (transfer.destinationAccountId) {
      await tx.insert(transactions).values({
        id: `${transfer.id}-destination`,
        ownerId: this.ownerId,
        accountId: transfer.destinationAccountId,
        amountMinor: transfer.destinationAmountMinor,
        occurredAt: transfer.occurredAt,
        description: transfer.description,
        trustStatus: "Confirmed",
        transferId: transfer.id
      });
    }
  }

  async getById(transferId: string): Promise<Transfer | null> {
    const db = getScopedDb(this.connectionString);

    const rows = await db
      .select()
      .from(transfers)
      .where(and(eq(transfers.id, transferId), eq(transfers.ownerId, this.ownerId)));

    const row = rows[0];
    return row ? rowToTransfer(row) : null;
  }

  async listByLeg(accountOrFixedDepositId: string): Promise<Transfer[]> {
    const db = getScopedDb(this.connectionString);

    const rows = await db
      .select()
      .from(transfers)
      .where(
        and(
          eq(transfers.ownerId, this.ownerId),
          or(
            eq(transfers.sourceAccountId, accountOrFixedDepositId),
            eq(transfers.sourceFixedDepositId, accountOrFixedDepositId),
            eq(transfers.destinationAccountId, accountOrFixedDepositId),
            eq(transfers.destinationFixedDepositId, accountOrFixedDepositId)
          )
        )
      )
      .orderBy(asc(transfers.occurredAt), asc(transfers.id));

    return rows.map(rowToTransfer);
  }

  async getTransferImpactByAccountId(accountId: string): Promise<AccountTransferImpact> {
    const db = getScopedDb(this.connectionString);
    const touchesAccount = and(
      eq(transfers.ownerId, this.ownerId),
      or(eq(transfers.sourceAccountId, accountId), eq(transfers.destinationAccountId, accountId))
    );

    const [countRow] = await db.select({ total: count() }).from(transfers).where(touchesAccount);

    const otherAccountId = sql`case when ${transfers.sourceAccountId} = ${accountId} then ${transfers.destinationAccountId} else ${transfers.sourceAccountId} end`;
    const nameRows = await db
      .selectDistinct({ name: accounts.name })
      .from(transfers)
      .innerJoin(accounts, and(eq(accounts.id, otherAccountId), eq(accounts.ownerId, this.ownerId)))
      .where(touchesAccount)
      .orderBy(asc(accounts.name));

    return {
      transferCount: countRow?.total ?? 0,
      counterpartyAccountNames: nameRows.map((row) => row.name)
    };
  }

  async delete(transferId: string): Promise<void> {
    const transfer = await this.getById(transferId);

    if (!transfer) {
      return;
    }

    const db = getScopedDb(this.connectionString);

    await db.transaction(async (tx) => {
      const affectedFixedDeposits = await this.lockFixedDeposits(tx, [transfer.sourceFixedDepositId, transfer.destinationFixedDepositId]
        .filter((id): id is string => id !== null));
      await tx
        .delete(transactions)
        .where(and(eq(transactions.transferId, transferId), eq(transactions.ownerId, this.ownerId)));
      await tx.delete(transfers).where(and(eq(transfers.id, transferId), eq(transfers.ownerId, this.ownerId)));

      for (const fixedDeposit of affectedFixedDeposits) {
        await this.recomputeFixedDepositState(tx, fixedDeposit);
      }
    });
  }

  private async lockFixedDeposits(
    tx: PostgresJsDatabase,
    fixedDepositIds: string[]
  ): Promise<(typeof fixedDeposits.$inferSelect)[]> {
    const rows: (typeof fixedDeposits.$inferSelect)[] = [];
    for (const fixedDepositId of [...new Set(fixedDepositIds)].sort()) {
      const [row] = await tx.select().from(fixedDeposits)
        .where(and(eq(fixedDeposits.id, fixedDepositId), eq(fixedDeposits.ownerId, this.ownerId)))
        .for("update");
      if (row) rows.push(row);
    }
    return rows;
  }

  private async applyFixedDepositTransfer(
    tx: PostgresJsDatabase,
    fixedDeposit: typeof fixedDeposits.$inferSelect,
    transfer: Transfer
  ): Promise<void> {
    if (transfer.purpose === "fixed-deposit-opening") return;
    const withdrawal = transfer.purpose === "fixed-deposit-withdrawal";
    if (withdrawal && transfer.occurredAt.slice(0, 10) < fixedDeposit.maturityDate &&
      transfer.sourceAmountMinor > fixedDeposit.principalMinor) {
      throw new FixedDepositTransferError("Withdrawal amount cannot exceed the Fixed Deposit current principal.");
    }
    const principalMinor = Math.max(0, fixedDeposit.principalMinor +
      (withdrawal ? -transfer.sourceAmountMinor : transfer.destinationAmountMinor));
    assertMinorUnits(principalMinor);
    const laterTransfers = tx.select({ id: transfers.id }).from(transfers).where(and(
      eq(transfers.ownerId, this.ownerId),
      or(eq(transfers.sourceFixedDepositId, fixedDeposit.id), eq(transfers.destinationFixedDepositId, fixedDeposit.id)),
      gt(transfers.occurredAt, transfer.occurredAt)
    ));
    // Keep chronological appends constant in query count; only backdated entries need replay.
    const updated = await tx.update(fixedDeposits).set({
      principalMinor,
      status: principalMinor === 0 ? closedFixedDepositStatus(fixedDeposit.maturityDate, transfer.occurredAt) : "Open"
    }).where(and(
      eq(fixedDeposits.id, fixedDeposit.id), eq(fixedDeposits.ownerId, this.ownerId), notExists(laterTransfers)
    )).returning({ id: fixedDeposits.id });
    if (updated.length === 0) await this.recomputeFixedDepositState(tx, fixedDeposit);
  }

  private async recomputeFixedDepositState(
    tx: PostgresJsDatabase,
    fixedDeposit: typeof fixedDeposits.$inferSelect
  ): Promise<void> {
    const fixedDepositId = fixedDeposit.id;

    const relatedTransfers = await tx
      .select()
      .from(transfers)
      .where(
        and(
          eq(transfers.ownerId, this.ownerId),
          or(eq(transfers.sourceFixedDepositId, fixedDepositId), eq(transfers.destinationFixedDepositId, fixedDepositId))
        )
      )
      .orderBy(
        asc(transfers.occurredAt),
        // Equal timestamps have no event order; make their funding available before withdrawals.
        sql`case when ${transfers.purpose} = 'fixed-deposit-top-up' then 0 else 1 end`,
        asc(transfers.id)
      );

    let principalMinor = fixedDeposit.originalPrincipalMinor;
    let status: FixedDepositStatus = "Open";

    for (const transfer of relatedTransfers) {
      const purpose = transfer.purpose as TransferPurpose;
      if (transfer.destinationFixedDepositId === fixedDepositId && purpose === "fixed-deposit-top-up") {
        principalMinor += transfer.destinationAmountMinor;
      }
      if (transfer.sourceFixedDepositId === fixedDepositId && purpose === "fixed-deposit-withdrawal") {
        const isBeforeMaturity = transfer.occurredAt.slice(0, 10) < fixedDeposit.maturityDate;
        if (isBeforeMaturity && transfer.sourceAmountMinor > principalMinor) {
          throw new FixedDepositTransferError("Fixed Deposit principal cannot become negative.");
        }
        principalMinor = Math.max(0, principalMinor - transfer.sourceAmountMinor);
        if (principalMinor === 0) {
          status = closedFixedDepositStatus(fixedDeposit.maturityDate, transfer.occurredAt);
        }
      }
    }

    if (principalMinor > 0) {
      status = "Open";
    }

    await tx
      .update(fixedDeposits)
      .set({ principalMinor, status })
      .where(and(eq(fixedDeposits.id, fixedDepositId), eq(fixedDeposits.ownerId, this.ownerId)));
  }
}
