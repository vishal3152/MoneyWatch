"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  dismissStockSuspectedDuplicate,
  type DismissStockDuplicateState
} from "@/app/stock-imports/[id]/dismiss-duplicate-actions";
import { useTranslator } from "@/i18n/client";

const initialState: DismissStockDuplicateState = {};

export function DismissStockDuplicateForm({
  stockTransactionId,
  batchId
}: {
  stockTransactionId: string;
  batchId: string;
}) {
  const { text } = useTranslator();
  const [state, formAction, pending] = useActionState(dismissStockSuspectedDuplicate, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="stockTransactionId" value={stockTransactionId} />
      <input type="hidden" name="batchId" value={batchId} />
      {state.formError ? (
        <p className="pw-banner-error" role="alert">
          {text(state.formError)}
        </p>
      ) : null}
      <DismissStockDuplicateButton pending={pending} />
    </form>
  );
}

function DismissStockDuplicateButton({ pending }: { pending: boolean }) {
  const { pending: formPending } = useFormStatus();
  const { t } = useTranslator();

  return (
    <button className="pw-action-chip" type="submit" disabled={pending || formPending}>
      {pending || formPending ? t("common.saving") : t("imports.dismissDuplicate")}
    </button>
  );
}
