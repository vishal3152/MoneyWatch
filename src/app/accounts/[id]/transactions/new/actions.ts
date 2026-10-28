"use server";

import { redirect } from "next/navigation";

import { claimIdempotencyKey } from "@/app/duplicate-submission-guard";
import { withPersistedFormState } from "@/app/form-persistence";
import { textFieldLengthError } from "@/app/form-limits";
import {
  getAccountRepository,
  getTransactionRepository,
  type RepositoryFactoryDeps
} from "@/db/repository-factory";
import { parseDecimalToMinorUnits } from "@/domain/decimal-input";
import { InvalidMinorUnitsError } from "@/domain/money";
import {
  InvalidTransactionTimestampError,
  normalizeTransactionTimestamp
} from "@/domain/transaction";
import {
  assertValidCategoryForKind,
  InvalidTransactionCategoryError,
  type TransactionCategory,
  type TransactionKind
} from "@/domain/transaction-category";
import type { LocalizedText } from "@/i18n/translator";

export type TransactionFormState = {
  fieldErrors?: {
    amount?: LocalizedText;
    occurredAt?: LocalizedText;
    kind?: LocalizedText;
    category?: LocalizedText;
    description?: LocalizedText;
  };
  formError?: LocalizedText;
  values?: Record<string, string>;
  formKey?: string;
};

type BatchRowErrors = Record<number, NonNullable<TransactionFormState["fieldErrors"]>>;

export type TransactionsBatchFormState = {
  rowErrors?: BatchRowErrors;
  formError?: LocalizedText;
  values?: Record<string, string>;
  formKey?: string;
};

function isTransactionKind(value: string): value is TransactionKind {
  return value === "Income" || value === "Expense";
}

export type CreateTransactionDeps = RepositoryFactoryDeps & {
  redirectTo?: (path: string) => void;
  newId?: () => string;
};

export async function createTransaction(
  _prevState: TransactionFormState,
  formData: FormData,
  deps: CreateTransactionDeps = {}
): Promise<TransactionFormState> {
  const fail = (state: Omit<TransactionFormState, "values" | "formKey">) =>
    withPersistedFormState(formData, state);

  const accountId = String(formData.get("accountId") ?? "");
  const amount = String(formData.get("amount") ?? "");
  const kindInput = String(formData.get("kind") ?? "");
  const category = String(formData.get("category") ?? "");
  const occurredAtInput = String(formData.get("occurredAt") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  if (description.length === 0) {
    return fail({ fieldErrors: { description: { key: "errors.descriptionRequired" } } });
  }
  const descriptionLengthError = textFieldLengthError(description);
  if (descriptionLengthError) {
    return fail({ fieldErrors: { description: descriptionLengthError } });
  }
  const accounts = await getAccountRepository(deps);
  const account = await accounts.getById(accountId);

  if (!account) {
    return fail({ formError: { key: "errors.accountMissing" } });
  }

  if (!isTransactionKind(kindInput)) {
    return fail({ fieldErrors: { kind: { key: "errors.kindRequired" } } });
  }

  let amountMagnitudeMinor: number;
  try {
    amountMagnitudeMinor = parseDecimalToMinorUnits(amount, account.currencyCode);
  } catch (error) {
    if (error instanceof InvalidMinorUnitsError) {
      return fail({ fieldErrors: { amount: { key: "errors.amountInvalid" } } });
    }
    throw error;
  }

  if (amountMagnitudeMinor < 0) {
    return fail({
      fieldErrors: { amount: { key: "errors.amountMustBePositive" } }
    });
  }

  try {
    assertValidCategoryForKind(kindInput, category);
  } catch (error) {
    if (error instanceof InvalidTransactionCategoryError) {
      return fail({
        fieldErrors: { category: { key: "errors.categoryMismatch" } }
      });
    }
    throw error;
  }

  const amountMinor = kindInput === "Expense" ? -amountMagnitudeMinor : amountMagnitudeMinor;

  let occurredAt: string;
  try {
    occurredAt = normalizeTransactionTimestamp(occurredAtInput);
  } catch (error) {
    if (error instanceof InvalidTransactionTimestampError) {
      return fail({ fieldErrors: { occurredAt: { key: "errors.timestampInvalid" } } });
    }
    throw error;
  }

  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!claimIdempotencyKey(idempotencyKey)) {
    return fail({ formError: { key: "errors.duplicateSubmission" } });
  }

  const id = (deps.newId ?? (() => crypto.randomUUID()))();
  await (await getTransactionRepository(deps)).create({
    id,
    accountId,
    amountMinor,
    occurredAt,
    description,
    trustStatus: "Confirmed",
    transferId: null,
    category: category as TransactionCategory,
    importBatchId: null
  });

  (deps.redirectTo ?? redirect)(`/accounts/${accountId}?message=transaction_created`);
  return {};
}

export async function createTransactions(
  _prevState: TransactionsBatchFormState,
  formData: FormData,
  deps: CreateTransactionDeps = {}
): Promise<TransactionsBatchFormState> {
  const fail = (state: Omit<TransactionsBatchFormState, "values" | "formKey">) =>
    withPersistedFormState(formData, state);
  const accountId = String(formData.get("accountId") ?? "");
  const rowCount = Number(formData.get("rowCount"));
  if (!Number.isSafeInteger(rowCount) || rowCount < 1) {
    return fail({ formError: { key: "errors.transactionRowsEmpty" } });
  }

  const account = await (await getAccountRepository(deps)).getById(accountId);
  if (!account) {
    return fail({ formError: { key: "errors.accountMissing" } });
  }

  const rowErrors: BatchRowErrors = {};
  const validRows: Array<{
    amountMinor: number;
    category: TransactionCategory;
    description: string;
    occurredAt: string;
  }> = [];

  for (let index = 0; index < rowCount; index += 1) {
    const value = (field: string) => String(formData.get(`${field}.${index}`) ?? "");
    const kindInput = value("kind");
    const category = value("category");
    const amount = value("amount").trim();
    const description = value("description").trim();
    const occurredAtInput = value("occurredAt");
    if (!amount && !description) continue;

    const errors: NonNullable<TransactionFormState["fieldErrors"]> = {};
    if (!isTransactionKind(kindInput)) {
      errors.kind = { key: "errors.kindRequired" };
    }
    if (!description) {
      errors.description = { key: "errors.descriptionRequired" };
    } else {
      const descriptionLengthError = textFieldLengthError(description);
      if (descriptionLengthError) errors.description = descriptionLengthError;
    }

    let amountMinor: number | undefined;
    try {
      const magnitude = parseDecimalToMinorUnits(amount, account.currencyCode);
      if (magnitude < 0) errors.amount = { key: "errors.amountMustBePositive" };
      else amountMinor = kindInput === "Expense" ? -magnitude : magnitude;
    } catch (error) {
      if (error instanceof InvalidMinorUnitsError) errors.amount = { key: "errors.amountInvalid" };
      else throw error;
    }

    if (isTransactionKind(kindInput)) {
      try {
        assertValidCategoryForKind(kindInput, category);
      } catch (error) {
        if (error instanceof InvalidTransactionCategoryError) errors.category = { key: "errors.categoryMismatch" };
        else throw error;
      }
    }

    let occurredAt: string | undefined;
    try {
      occurredAt = normalizeTransactionTimestamp(occurredAtInput);
    } catch (error) {
      if (error instanceof InvalidTransactionTimestampError) errors.occurredAt = { key: "errors.timestampInvalid" };
      else throw error;
    }

    if (Object.keys(errors).length > 0 || amountMinor === undefined || occurredAt === undefined || !isTransactionKind(kindInput)) {
      rowErrors[index] = errors;
    } else {
      validRows.push({ amountMinor, category: category as TransactionCategory, description, occurredAt });
    }
  }

  if (Object.keys(rowErrors).length > 0) {
    return fail({ rowErrors });
  }
  if (validRows.length === 0) {
    return fail({ formError: { key: "errors.transactionRowsEmpty" } });
  }

  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!claimIdempotencyKey(idempotencyKey)) {
    return fail({ formError: { key: "errors.duplicateSubmission" } });
  }

  const id = deps.newId ?? (() => crypto.randomUUID());
  await (await getTransactionRepository(deps)).createMany(validRows.map((row, index) => ({
    id: id(),
    accountId,
    amountMinor: row.amountMinor,
    occurredAt: row.occurredAt,
    description: row.description,
    trustStatus: "Confirmed" as const,
    transferId: null,
    category: row.category,
    importBatchId: null
  })));

  (deps.redirectTo ?? redirect)(`/accounts/${accountId}?message=transaction_created`);
  return {};
}
