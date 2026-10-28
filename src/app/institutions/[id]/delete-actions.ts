"use server";

import { redirect } from "next/navigation";

import type { DeleteFormState } from "@/app/components/delete-confirm-form";
import { domainErrorText } from "@/app/domain-error-text";
import {
  FORM_OPTIONS_TAGS,
  invalidateFormOptions,
  type InvalidateFormOptionsDeps
} from "@/app/form-options-cache";
import { EntityHasDependentsError } from "@/db/errors";
import { getInstitutionRepository, type RepositoryFactoryDeps } from "@/db/repository-factory";

export type DeleteInstitutionDeps = RepositoryFactoryDeps &
  InvalidateFormOptionsDeps & {
    redirectTo?: (path: string) => void;
  };

export async function deleteInstitution(
  _prevState: DeleteFormState,
  formData: FormData,
  deps: DeleteInstitutionDeps = {}
): Promise<DeleteFormState> {
  const institutionId = String(formData.get("institutionId") ?? "");
  const institutions = await getInstitutionRepository(deps);

  try {
    await institutions.delete(institutionId);
  } catch (error) {
    if (error instanceof EntityHasDependentsError) {
      return { formError: domainErrorText(error) };
    }
    throw error;
  }

  await invalidateFormOptions([FORM_OPTIONS_TAGS.institutions], deps);

  (deps.redirectTo ?? redirect)("/?message=institution_deleted");
  return {};
}
