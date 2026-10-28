"use client";

import { useActionState, useState } from "react";

import {
  createTransactions,
  createTransaction,
  type TransactionFormState,
  type TransactionsBatchFormState
} from "@/app/accounts/[id]/transactions/new/actions";
import { updateTransaction } from "@/app/accounts/[id]/transactions/[transactionId]/edit/actions";
import { BackLink } from "@/app/components/back-link";
import { DecimalInput } from "@/app/components/decimal-input";
import { RequiredMark } from "@/app/components/required-mark";
import { SegmentedControl } from "@/app/components/segmented-control";
import { SheetSelect } from "@/app/components/sheet-select";
import { toDatetimeLocalValue } from "@/app/datetime-local";
import { TEXT_FIELD_MAX_LENGTH } from "@/app/form-limits";
import { categoriesForKind, type TransactionKind } from "@/domain/transaction-category";
import { useTranslator } from "@/i18n/client";

const initialState: TransactionFormState = {};
const initialBatchState: TransactionsBatchFormState = {};

type BatchTransactionRow = {
  id: number;
  kind: TransactionKind;
  category: string;
  amount: string;
  description: string;
  occurredAt: string;
};

function freshBatchRow(id: number, kind: TransactionKind): BatchTransactionRow {
  return {
    id,
    kind,
    category: categoriesForKind(kind)[0],
    amount: "",
    description: "",
    occurredAt: toDatetimeLocalValue(new Date())
  };
}

function initialKind(values: Record<string, string> | undefined, fallback: TransactionKind): TransactionKind {
  if (values?.kind === "Income" || values?.kind === "Expense") {
    return values.kind;
  }
  return fallback;
}

export type TransactionFormInitialValues = {
  transactionId: string;
  kind: TransactionKind;
  category: string;
  amount: string;
  description: string;
  occurredAt: string;
};

export function TransactionForm({
  accountId,
  currencyCode,
  defaultKind = "Expense",
  returnTo,
  initialValues
}: {
  accountId: string;
  currencyCode: string;
  defaultKind?: TransactionKind;
  returnTo?: string;
  initialValues?: TransactionFormInitialValues;
}) {
  const { t, text } = useTranslator();
  const isEdit = initialValues !== undefined;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateTransaction : createTransaction,
    initialState
  );
  // Regenerated whenever the form remounts (a fresh `/new` navigation, or the
  // formKey-forced remount after a validation error) so a genuine resubmission
  // never collides with an earlier failed attempt's key.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [kind, setKind] = useState<TransactionKind>(() =>
    initialKind(state.values, initialValues?.kind ?? defaultKind)
  );
  const categories = categoriesForKind(kind);
  const [category, setCategory] = useState<string>(() => {
    const preferred = state.values?.category ?? initialValues?.category;
    if (preferred && categoriesForKind(kind).includes(preferred as never)) {
      return preferred;
    }
    return categoriesForKind(kind)[0];
  });

  const kindOptions = [
    { value: "Expense", label: t("transactionKind.Expense") },
    { value: "Income", label: t("transactionKind.Income") }
  ];

  function handleKindChange(next: TransactionKind) {
    setKind(next);
    setCategory(categoriesForKind(next)[0]);
  }

  return (
    <div className="pw-transaction-entry">
    <form key={state.formKey ?? "new"} className="pw-card pw-transaction-single" action={formAction} noValidate>
      <BackLink href={`/accounts/${accountId}`} label={t("transactions.backToAccount")} />
      <h1>{isEdit ? t("transactions.edit.heading") : t("transactions.new.heading")}</h1>
      <div className="pw-detail-lede">{t("transactions.form.lede")}</div>
      <input name="accountId" type="hidden" value={accountId} />
      {isEdit ? <input name="transactionId" type="hidden" value={initialValues.transactionId} /> : null}
      {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
      {isEdit ? null : <input name="idempotencyKey" type="hidden" value={idempotencyKey} />}
      {state.formError ? (
        <p className="pw-banner-error" role="alert">
          {text(state.formError)}
        </p>
      ) : null}
      <div className="pw-field">
        <span className="pw-field-legend" id="transaction-kind-label">
          {t("transactions.form.typeLabel")}
          <RequiredMark />
        </span>
        <SegmentedControl
          name="kind"
          aria-label={t("transactions.form.typeLabel")}
          value={kind}
          options={kindOptions}
          onChange={(next) => handleKindChange(next as TransactionKind)}
        />
      </div>
      <SheetSelect
        id="transaction-category"
        name="category"
        label={t("transactions.form.categoryLabel")}
        value={category}
        options={categories.map((option) => ({
          value: option,
          label: t(`category.${option}`)
        }))}
        onChange={setCategory}
        required
        invalid={Boolean(state.fieldErrors?.category)}
        errorId={state.fieldErrors?.category ? "transaction-category-error" : undefined}
        error={state.fieldErrors?.category ? text(state.fieldErrors.category) : undefined}
      />
      <div className="pw-field">
        <label htmlFor="transaction-amount">
          {t("transactions.form.amountLabel", { currency: currencyCode })}
          <RequiredMark />
        </label>
        <DecimalInput
          id="transaction-amount"
          name="amount"
          placeholder="0.00"
          required
          defaultValue={state.values?.amount ?? initialValues?.amount ?? ""}
          aria-invalid={state.fieldErrors?.amount ? true : undefined}
          aria-describedby={state.fieldErrors?.amount ? "transaction-amount-error" : undefined}
        />
        {state.fieldErrors?.amount ? (
          <p className="pw-field-error" id="transaction-amount-error" role="alert">
            {text(state.fieldErrors.amount)}
          </p>
        ) : null}
      </div>
      <div className="pw-field">
        <label htmlFor="transaction-description">
          {t("transactions.form.descriptionLabel")}
          <RequiredMark />
        </label>
        <input
          id="transaction-description"
          name="description"
          type="text"
          required
          maxLength={TEXT_FIELD_MAX_LENGTH}
          defaultValue={state.values?.description ?? initialValues?.description ?? ""}
          aria-invalid={state.fieldErrors?.description ? true : undefined}
          aria-describedby={
            state.fieldErrors?.description ? "transaction-description-error" : undefined
          }
        />
        {state.fieldErrors?.description ? (
          <p className="pw-field-error" id="transaction-description-error" role="alert">
            {text(state.fieldErrors.description)}
          </p>
        ) : null}
      </div>
      <div className="pw-field">
        <label htmlFor="transaction-occurred-at">
          {t("transactions.form.occurredAtLabel")}
          <RequiredMark />
        </label>
        <input
          id="transaction-occurred-at"
          name="occurredAt"
          type="datetime-local"
          required
          defaultValue={
            state.values?.occurredAt ?? initialValues?.occurredAt ?? toDatetimeLocalValue(new Date())
          }
          aria-invalid={state.fieldErrors?.occurredAt ? true : undefined}
          aria-describedby={
            state.fieldErrors?.occurredAt ? "transaction-occurred-at-error" : undefined
          }
        />
        {state.fieldErrors?.occurredAt ? (
          <p className="pw-field-error" id="transaction-occurred-at-error" role="alert">
            {text(state.fieldErrors.occurredAt)}
          </p>
        ) : null}
      </div>
      <button className="pw-button" type="submit" disabled={pending}>
        {pending ? t("common.saving") : t("transactions.form.submit")}
      </button>
    </form>
    {!isEdit ? <TransactionBatchForm accountId={accountId} currencyCode={currencyCode} defaultKind={defaultKind} /> : null}
    </div>
  );
}

function TransactionBatchForm({
  accountId,
  currencyCode,
  defaultKind
}: {
  accountId: string;
  currencyCode: string;
  defaultKind: TransactionKind;
}) {
  const { t, text } = useTranslator();
  const [state, formAction, pending] = useActionState(createTransactions, initialBatchState);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [rows, setRows] = useState<BatchTransactionRow[]>([freshBatchRow(1, defaultKind)]);
  const [showErrors, setShowErrors] = useState(true);

  function updateRow(id: number, field: keyof BatchTransactionRow, value: string) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
    setShowErrors(false);
  }

  function addRow() {
    setRows((current) => {
      const nextId = Math.max(0, ...current.map((row) => row.id)) + 1;
      return [...current, freshBatchRow(nextId, current.at(-1)?.kind ?? defaultKind)];
    });
    setShowErrors(false);
  }

  return (
    <form className="pw-card pw-transaction-batch" action={formAction} onSubmit={() => setShowErrors(true)} noValidate>
      <BackLink href={`/accounts/${accountId}`} label={t("transactions.backToAccount")} />
      <h1>{t("transactions.new.heading")}</h1>
      <div className="pw-detail-lede">{t("transactions.batch.lede", { currency: currencyCode })}</div>
      <input name="accountId" type="hidden" value={accountId} />
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <input name="rowCount" type="hidden" value={rows.length} readOnly />
      {showErrors && state.formError ? <p className="pw-banner-error" role="alert">{text(state.formError)}</p> : null}
      <div className="pw-bulk-table-wrap">
        <table className="pw-bulk-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">{t("transactions.form.typeLabel")} <RequiredMark /></th>
              <th scope="col">{t("transactions.form.categoryLabel")} <RequiredMark /></th>
              <th scope="col">{t("transactions.form.amountLabel", { currency: currencyCode })} <RequiredMark /></th>
              <th scope="col">{t("transactions.form.descriptionLabel")} <RequiredMark /></th>
              <th scope="col">{t("transactions.form.occurredAtLabel")} <RequiredMark /></th>
              <th scope="col"><span className="pw-visually-hidden">{t("transactions.batch.removeRow", { row: "" })}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const errors = showErrors ? state.rowErrors?.[index] : undefined;
              const inputName = (field: string) => `${field}.${index}`;
              const renderError = (field: keyof NonNullable<TransactionFormState["fieldErrors"]>) => {
                const error = errors?.[field];
                return error ? <span className="pw-bulk-field-error" id={`transaction-row-${row.id}-${field}-error`} role="alert">{text(error)}</span> : null;
              };
              return (
                <tr key={row.id}>
                  <th scope="row">{index + 1}</th>
                  <td>
                    <label className="pw-bulk-control">
                      <span className="pw-visually-hidden">{t("transactions.form.typeLabel")} {index + 1}</span>
                      <select name={inputName("kind")} value={row.kind} aria-invalid={Boolean(errors?.kind)} aria-describedby={errors?.kind ? `transaction-row-${row.id}-kind-error` : undefined} onChange={(event) => { updateRow(row.id, "kind", event.target.value as TransactionKind); updateRow(row.id, "category", categoriesForKind(event.target.value as TransactionKind)[0]); }}>
                        <option value="Expense">{t("transactionKind.Expense")}</option>
                        <option value="Income">{t("transactionKind.Income")}</option>
                      </select>
                      {renderError("kind")}
                    </label>
                  </td>
                  <td>
                    <label className="pw-bulk-control">
                      <span className="pw-visually-hidden">{t("transactions.form.categoryLabel")} {index + 1}</span>
                      <select name={inputName("category")} value={row.category} aria-invalid={Boolean(errors?.category)} aria-describedby={errors?.category ? `transaction-row-${row.id}-category-error` : undefined} onChange={(event) => updateRow(row.id, "category", event.target.value)}>
                        {categoriesForKind(row.kind).map((item) => <option key={item} value={item}>{t(`category.${item}`)}</option>)}
                      </select>
                      {renderError("category")}
                    </label>
                  </td>
                  <td>
                    <label className="pw-bulk-control">
                      <span className="pw-visually-hidden">{t("transactions.form.amountLabel", { currency: currencyCode })} {index + 1}</span>
                      <DecimalInput name={inputName("amount")} value={row.amount} placeholder="0.00" aria-invalid={Boolean(errors?.amount)} aria-describedby={errors?.amount ? `transaction-row-${row.id}-amount-error` : undefined} onValueChange={(value) => updateRow(row.id, "amount", value)} />
                      {renderError("amount")}
                    </label>
                  </td>
                  <td>
                    <label className="pw-bulk-control">
                      <span className="pw-visually-hidden">{t("transactions.form.descriptionLabel")} {index + 1}</span>
                      <input name={inputName("description")} value={row.description} maxLength={TEXT_FIELD_MAX_LENGTH} aria-invalid={Boolean(errors?.description)} aria-describedby={errors?.description ? `transaction-row-${row.id}-description-error` : undefined} onChange={(event) => updateRow(row.id, "description", event.target.value)} />
                      {renderError("description")}
                    </label>
                  </td>
                  <td>
                    <label className="pw-bulk-control">
                      <span className="pw-visually-hidden">{t("transactions.form.occurredAtLabel")} {index + 1}</span>
                      <input type="datetime-local" name={inputName("occurredAt")} value={row.occurredAt} aria-invalid={Boolean(errors?.occurredAt)} aria-describedby={errors?.occurredAt ? `transaction-row-${row.id}-occurredAt-error` : undefined} onChange={(event) => updateRow(row.id, "occurredAt", event.target.value)} />
                      {renderError("occurredAt")}
                    </label>
                  </td>
                  <td>
                    <button className="pw-bulk-remove" type="button" disabled={pending} aria-label={t("transactions.batch.removeRow", { row: index + 1 })} onClick={() => { setRows((current) => current.filter((item) => item.id !== row.id)); setShowErrors(false); }}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="pw-bulk-footer">
        <button className="pw-button pw-button-subtle" type="button" disabled={pending} onClick={addRow}>+ {t("transactions.batch.addRow")}</button>
        <div>
          <span>{t("transactions.batch.emptyRowsSkipped")}</span>
          <button className="pw-button" type="submit" disabled={pending || rows.length === 0}>
            {pending ? t("common.saving") : rows.length === 1 ? t("transactions.form.submit") : t("transactions.batch.submit", { count: rows.length })}
          </button>
        </div>
      </footer>
    </form>
  );
}
