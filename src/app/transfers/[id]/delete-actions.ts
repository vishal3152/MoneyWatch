"use server";

import { redirect } from "next/navigation";

import type { DeleteFormState } from "@/app/components/delete-confirm-form";
import { domainErrorText } from "@/app/domain-error-text";
import {
  FORM_OPTIONS_TAGS,
  invalidateFormOptions,
  type InvalidateFormOptionsDeps
} from "@/app/form-options-cache";
import { FixedDepositTransferError } from "@/db/errors";
import { getTransferRepository, type RepositoryFactoryDeps } from "@/db/repository-factory";

export type DeleteTransferDeps = RepositoryFactoryDeps &
  InvalidateFormOptionsDeps & {
    redirectTo?: (path: string) => void;
  };

export async function deleteTransfer(
  _prevState: DeleteFormState,
  formData: FormData,
  deps: DeleteTransferDeps = {}
): Promise<DeleteFormState> {
  const transferId = String(formData.get("transferId") ?? "");

  try {
    await (await getTransferRepository(deps)).delete(transferId);
  } catch (error) {
    if (error instanceof FixedDepositTransferError) {
      return { formError: domainErrorText(error) };
    }
    throw error;
  }

  await invalidateFormOptions([FORM_OPTIONS_TAGS.fixedDeposits], deps);

  (deps.redirectTo ?? redirect)("/?message=transfer_deleted");
  return {};
}
