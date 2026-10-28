"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { dismissSuspectedDuplicate, type DismissDuplicateState } from "@/app/imports/[id]/dismiss-duplicate-actions";
import { useTranslator } from "@/i18n/client";

const initialState: DismissDuplicateState = {};

export function DismissDuplicateForm({ transactionId, batchId }: { transactionId: string; batchId: string }) {
  const { text } = useTranslator();
  const [state, formAction, pending] = useActionState(dismissSuspectedDuplicate, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="batchId" value={batchId} />
      {state.formError ? (
        <p className="pw-banner-error" role="alert">
          {text(state.formError)}
        </p>
      ) : null}
      <DismissDuplicateButton pending={pending} />
    </form>
  );
}

function DismissDuplicateButton({ pending }: { pending: boolean }) {
  const { pending: formPending } = useFormStatus();
  const { t } = useTranslator();

  return (
    <button className="pw-action-chip" type="submit" disabled={pending || formPending}>
      {pending || formPending ? t("common.saving") : t("imports.dismissDuplicate")}
    </button>
  );
}
