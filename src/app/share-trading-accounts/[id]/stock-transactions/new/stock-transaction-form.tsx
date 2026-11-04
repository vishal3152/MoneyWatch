"use client";

import { useActionState, useEffect, useState } from "react";

import {
  createStockTransactions,
  createStockTransaction,
  type StockTransactionFormState,
  type StockTransactionsBatchFormState
} from "@/app/share-trading-accounts/[id]/stock-transactions/new/actions";
import { updateStockTransaction } from "@/app/share-trading-accounts/[id]/stock-transactions/[stockTransactionId]/edit/actions";
import { BackLink } from "@/app/components/back-link";
import { DecimalInput } from "@/app/components/decimal-input";
import { RequiredMark } from "@/app/components/required-mark";
import { SegmentedControl } from "@/app/components/segmented-control";
import { toDatetimeLocalValue } from "@/app/datetime-local";
import { TEXT_FIELD_MAX_LENGTH } from "@/app/form-limits";
import {
  restoreStockTransactionBatchRows,
  type BatchStockTransactionRow
} from "@/app/stock-transaction-batch-state";
import type { StockTransactionType } from "@/domain/stock-transaction";
import { useTranslator } from "@/i18n/client";

const initialState: StockTransactionFormState = {};
const initialBatchState: StockTransactionsBatchFormState = {};

function freshBatchRow(id: number, type: StockTransactionType = "Buy"): BatchStockTransactionRow {
  return {
    id,
    type,
    scripCode: "",
    quantity: "",
    price: "",
    description: "",
    occurredAt: toDatetimeLocalValue(new Date())
  };
}

function initialType(
  values: Record<string, string> | undefined,
  fallback: StockTransactionType = "Buy"
): StockTransactionType {
  if (values?.type === "Buy" || values?.type === "Sell") {
    return values.type;
  }
  return fallback;
}

export type StockTransactionFormInitialValues = {
  stockTransactionId: string;
  type: StockTransactionType;
  scripCode: string;
  quantity: string;
  price: string;
  description: string;
  occurredAt: string;
};

export function StockTransactionForm({
  shareTradingAccountId,
  currencyCode,
  initialValues
}: {
  shareTradingAccountId: string;
  currencyCode: string;
  initialValues?: StockTransactionFormInitialValues;
}) {
  const { t, text } = useTranslator();
  const typeOptions = [
    { value: "Buy", label: t("stockTransactionType.Buy") },
    { value: "Sell", label: t("stockTransactionType.Sell") }
  ];
  const isEdit = initialValues !== undefined;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateStockTransaction : createStockTransaction,
    initialState
  );
  // Regenerated whenever the form remounts (a fresh /new navigation, or the
  // formKey-forced remount after a validation error) — same pattern as
  // TransactionForm's idempotencyKey. Edit mode omits it: updateStockTransaction
  // never claims one, matching updateTransaction.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [type, setType] = useState<StockTransactionType>(() =>
    initialType(state.values, initialValues?.type ?? "Buy")
  );

  return (
    <div className={isEdit ? "pw-transaction-entry pw-transaction-entry--edit" : "pw-transaction-entry"}>
    <form key={state.formKey ?? "new"} className="pw-card pw-transaction-single" action={formAction} noValidate>
      <BackLink href={`/share-trading-accounts/${shareTradingAccountId}`} label={t("transactions.backToAccount")} />
      <h1>{isEdit ? t("stockTransactions.edit.heading") : t("stockTransactions.new.heading")}</h1>
      <input name="shareTradingAccountId" type="hidden" value={shareTradingAccountId} />
      {isEdit ? (
        <input name="stockTransactionId" type="hidden" value={initialValues.stockTransactionId} />
      ) : (
        <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      )}
      {state.formError ? (
        <p className="pw-banner-error" role="alert">
          {text(state.formError)}
        </p>
      ) : null}
      <div className="pw-field">
        <span className="pw-field-legend" id="stock-transaction-type-label">
          {t("stockTransactions.form.typeLabel")}
          <RequiredMark />
        </span>
        <SegmentedControl
          name="type"
          aria-label={t("stockTransactions.form.typeLabel")}
          value={type}
          options={typeOptions}
          onChange={(next) => setType(next as StockTransactionType)}
        />
      </div>
      <div className="pw-field">
        <label htmlFor="stock-transaction-scrip-code">
          {t("stockTransactions.form.scripCodeLabel")}
          <RequiredMark />
        </label>
        <input
          id="stock-transaction-scrip-code"
          name="scripCode"
          type="text"
          required
          maxLength={TEXT_FIELD_MAX_LENGTH}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder={t("stockTransactions.form.scripCodePlaceholder")}
          defaultValue={state.values?.scripCode ?? initialValues?.scripCode ?? ""}
          aria-invalid={state.fieldErrors?.scripCode ? true : undefined}
          aria-describedby={state.fieldErrors?.scripCode ? "stock-transaction-scrip-code-error" : undefined}
        />
        {state.fieldErrors?.scripCode ? (
          <p className="pw-field-error" id="stock-transaction-scrip-code-error" role="alert">
            {text(state.fieldErrors.scripCode)}
          </p>
        ) : null}
      </div>
      <div className="pw-field">
        <label htmlFor="stock-transaction-quantity">
          {t("stockTransactions.form.quantityLabel")}
          <RequiredMark />
        </label>
        <DecimalInput
          id="stock-transaction-quantity"
          name="quantity"
          placeholder="0"
          required
          defaultValue={state.values?.quantity ?? initialValues?.quantity ?? ""}
          aria-invalid={state.fieldErrors?.quantity ? true : undefined}
          aria-describedby={state.fieldErrors?.quantity ? "stock-transaction-quantity-error" : undefined}
        />
        {state.fieldErrors?.quantity ? (
          <p className="pw-field-error" id="stock-transaction-quantity-error" role="alert">
            {text(state.fieldErrors.quantity)}
          </p>
        ) : null}
      </div>
      <div className="pw-field">
        <label htmlFor="stock-transaction-price">
          {t("stockTransactions.form.priceLabel", { currency: currencyCode })}
          <RequiredMark />
        </label>
        <DecimalInput
          id="stock-transaction-price"
          name="price"
          placeholder="0.00"
          required
          defaultValue={state.values?.price ?? initialValues?.price ?? ""}
          aria-invalid={state.fieldErrors?.price ? true : undefined}
          aria-describedby={state.fieldErrors?.price ? "stock-transaction-price-error" : undefined}
        />
        {state.fieldErrors?.price ? (
          <p className="pw-field-error" id="stock-transaction-price-error" role="alert">
            {text(state.fieldErrors.price)}
          </p>
        ) : null}
      </div>
      <div className="pw-field">
        <label htmlFor="stock-transaction-description">
          {t("stockTransactions.form.descriptionLabel")}
          <RequiredMark />
        </label>
        <input
          id="stock-transaction-description"
          name="description"
          type="text"
          required
          maxLength={TEXT_FIELD_MAX_LENGTH}
          defaultValue={state.values?.description ?? initialValues?.description ?? ""}
          aria-invalid={state.fieldErrors?.description ? true : undefined}
          aria-describedby={
            state.fieldErrors?.description ? "stock-transaction-description-error" : undefined
          }
        />
        {state.fieldErrors?.description ? (
          <p className="pw-field-error" id="stock-transaction-description-error" role="alert">
            {text(state.fieldErrors.description)}
          </p>
        ) : null}
      </div>
      <div className="pw-field">
        <label htmlFor="stock-transaction-occurred-at">
          {t("stockTransactions.form.occurredAtLabel")}
          <RequiredMark />
        </label>
        <input
          id="stock-transaction-occurred-at"
          name="occurredAt"
          type="datetime-local"
          required
          defaultValue={
            state.values?.occurredAt ?? initialValues?.occurredAt ?? toDatetimeLocalValue(new Date())
          }
          aria-invalid={state.fieldErrors?.occurredAt ? true : undefined}
          aria-describedby={
            state.fieldErrors?.occurredAt ? "stock-transaction-occurred-at-error" : undefined
          }
        />
        {state.fieldErrors?.occurredAt ? (
          <p className="pw-field-error" id="stock-transaction-occurred-at-error" role="alert">
            {text(state.fieldErrors.occurredAt)}
          </p>
        ) : null}
      </div>
      <button className="pw-button" type="submit" disabled={pending}>
        {pending ? t("common.saving") : t("stockTransactions.form.submit")}
      </button>
    </form>
    {!isEdit ? <StockTransactionBatchForm shareTradingAccountId={shareTradingAccountId} currencyCode={currencyCode} /> : null}
    </div>
  );
}

function StockTransactionBatchForm({
  shareTradingAccountId,
  currencyCode
}: {
  shareTradingAccountId: string;
  currencyCode: string;
}) {
  const { t, text } = useTranslator();
  const [state, formAction, pending] = useActionState(createStockTransactions, initialBatchState);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [rows, setRows] = useState<BatchStockTransactionRow[]>([freshBatchRow(1)]);
  const [showErrors, setShowErrors] = useState(true);

  useEffect(() => {
    if (!state.formKey || !state.values) return;
    const restoredRows = restoreStockTransactionBatchRows(state.values);
    if (restoredRows.length > 0) setRows(restoredRows);
  }, [state.formKey, state.values]);

  function updateRow(id: number, field: keyof BatchStockTransactionRow, value: string) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
    setShowErrors(false);
  }

  function addRow() {
    setRows((current) => {
      const nextId = Math.max(0, ...current.map((row) => row.id)) + 1;
      return [...current, freshBatchRow(nextId, current.at(-1)?.type ?? "Buy")];
    });
    setShowErrors(false);
  }

  return (
    <form key={state.formKey ?? "new"} className="pw-card pw-transaction-batch" action={formAction} onSubmit={() => setShowErrors(true)} noValidate>
      <BackLink href={`/share-trading-accounts/${shareTradingAccountId}`} label={t("transactions.backToAccount")} />
      <h1>{t("stockTransactions.new.heading")}</h1>
      <div className="pw-detail-lede">{t("stockTransactions.batch.lede", { currency: currencyCode })}</div>
      <input name="shareTradingAccountId" type="hidden" value={shareTradingAccountId} />
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <input name="rowCount" type="hidden" value={rows.length} readOnly />
      {showErrors && state.formError ? <p className="pw-banner-error" role="alert">{text(state.formError)}</p> : null}
      <div className="pw-bulk-table-wrap">
        <table className="pw-bulk-table pw-stock-bulk-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">{t("stockTransactions.form.typeLabel")} <RequiredMark /></th>
              <th scope="col">{t("stockTransactions.form.scripCodeLabel")} <RequiredMark /></th>
              <th scope="col">{t("stockTransactions.form.quantityLabel")} <RequiredMark /></th>
              <th scope="col">{t("stockTransactions.form.priceLabel", { currency: currencyCode })} <RequiredMark /></th>
              <th scope="col">{t("stockTransactions.form.descriptionLabel")} <RequiredMark /></th>
              <th scope="col">{t("stockTransactions.form.occurredAtLabel")} <RequiredMark /></th>
              <th scope="col"><span className="pw-visually-hidden">{t("stockTransactions.batch.removeRow", { row: "" })}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const errors = showErrors ? state.rowErrors?.[index] : undefined;
              const inputName = (field: string) => `${field}.${index}`;
              const renderError = (field: keyof NonNullable<StockTransactionFormState["fieldErrors"]>) => {
                const error = errors?.[field];
                return error ? <span className="pw-bulk-field-error" id={`stock-row-${row.id}-${field}-error`} role="alert">{text(error)}</span> : null;
              };
              return (
                <tr key={row.id}>
                  <th scope="row">{index + 1}</th>
                  <td>
                    <label className="pw-bulk-control">
                      <span className="pw-visually-hidden">{t("stockTransactions.form.typeLabel")} {index + 1}</span>
                      <select name={inputName("type")} value={row.type} disabled={pending} aria-invalid={Boolean(errors?.type)} aria-describedby={errors?.type ? `stock-row-${row.id}-type-error` : undefined} onChange={(event) => updateRow(row.id, "type", event.target.value as StockTransactionType)}>
                        <option value="Buy">{t("stockTransactionType.Buy")}</option>
                        <option value="Sell">{t("stockTransactionType.Sell")}</option>
                      </select>
                      {renderError("type")}
                    </label>
                  </td>
                  <td>
                    <label className="pw-bulk-control">
                      <span className="pw-visually-hidden">{t("stockTransactions.form.scripCodeLabel")} {index + 1}</span>
                      <input name={inputName("scripCode")} value={row.scripCode} disabled={pending} maxLength={TEXT_FIELD_MAX_LENGTH} autoCapitalize="characters" autoComplete="off" aria-invalid={Boolean(errors?.scripCode)} aria-describedby={errors?.scripCode ? `stock-row-${row.id}-scripCode-error` : undefined} onChange={(event) => updateRow(row.id, "scripCode", event.target.value)} />
                      {renderError("scripCode")}
                    </label>
                  </td>
                  <td>
                    <label className="pw-bulk-control">
                      <span className="pw-visually-hidden">{t("stockTransactions.form.quantityLabel")} {index + 1}</span>
                      <DecimalInput name={inputName("quantity")} value={row.quantity} disabled={pending} placeholder="0" aria-invalid={Boolean(errors?.quantity)} aria-describedby={errors?.quantity ? `stock-row-${row.id}-quantity-error` : undefined} onValueChange={(value) => updateRow(row.id, "quantity", value)} />
                      {renderError("quantity")}
                    </label>
                  </td>
                  <td>
                    <label className="pw-bulk-control">
                      <span className="pw-visually-hidden">{t("stockTransactions.form.priceLabel", { currency: currencyCode })} {index + 1}</span>
                      <DecimalInput name={inputName("price")} value={row.price} disabled={pending} placeholder="0.00" aria-invalid={Boolean(errors?.price)} aria-describedby={errors?.price ? `stock-row-${row.id}-price-error` : undefined} onValueChange={(value) => updateRow(row.id, "price", value)} />
                      {renderError("price")}
                    </label>
                  </td>
                  <td>
                    <label className="pw-bulk-control">
                      <span className="pw-visually-hidden">{t("stockTransactions.form.descriptionLabel")} {index + 1}</span>
                      <input name={inputName("description")} value={row.description} disabled={pending} maxLength={TEXT_FIELD_MAX_LENGTH} aria-invalid={Boolean(errors?.description)} aria-describedby={errors?.description ? `stock-row-${row.id}-description-error` : undefined} onChange={(event) => updateRow(row.id, "description", event.target.value)} />
                      {renderError("description")}
                    </label>
                  </td>
                  <td>
                    <label className="pw-bulk-control">
                      <span className="pw-visually-hidden">{t("stockTransactions.form.occurredAtLabel")} {index + 1}</span>
                      <input type="datetime-local" name={inputName("occurredAt")} value={row.occurredAt} disabled={pending} aria-invalid={Boolean(errors?.occurredAt)} aria-describedby={errors?.occurredAt ? `stock-row-${row.id}-occurredAt-error` : undefined} onChange={(event) => updateRow(row.id, "occurredAt", event.target.value)} />
                      {renderError("occurredAt")}
                    </label>
                  </td>
                  <td>
                    <button className="pw-bulk-remove" type="button" disabled={pending} aria-label={t("stockTransactions.batch.removeRow", { row: index + 1 })} onClick={() => { setRows((current) => current.filter((item) => item.id !== row.id)); setShowErrors(false); }}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="pw-bulk-footer">
        <button className="pw-button pw-button-subtle" type="button" disabled={pending} onClick={addRow}>+ {t("stockTransactions.batch.addRow")}</button>
        <div>
          <span>{t("stockTransactions.batch.emptyRowsSkipped")}</span>
          <button className="pw-button" type="submit" disabled={pending || rows.length === 0}>
            {pending ? t("common.saving") : rows.length === 1 ? t("stockTransactions.form.submit") : t("stockTransactions.batch.submit", { count: rows.length })}
          </button>
        </div>
      </footer>
    </form>
  );
}
