import { createHash } from "node:crypto";

import { revalidateTag, unstable_cache } from "next/cache";

import { resolveDatabasePath } from "@/config/resolve-database-path";
import {
  getAccountRepository,
  getFixedDepositRepository,
  getInstitutionRepository,
  type RepositoryFactoryDeps
} from "@/db/repository-factory";
import type { Account } from "@/domain/account";
import type { FixedDeposit } from "@/domain/fixed-deposit";
import type { Institution } from "@/domain/institution";
import { getCurrentOwnerId } from "@/lib/cloud-auth/current-owner";

export const FORM_OPTIONS_TAGS = {
  institutions: "form-options:institutions",
  accounts: "form-options:accounts",
  fixedDeposits: "form-options:fixed-deposits"
} as const;

export type FormOptionsTag = (typeof FORM_OPTIONS_TAGS)[keyof typeof FORM_OPTIONS_TAGS];

export type FormOptionsEntity = keyof typeof FORM_OPTIONS_TAGS;

/** Fallback TTL so a missed invalidation cannot stick forever. */
const REVALIDATE_SECONDS = 60;

/** Owner id in cloud; resolved database path in the configurable SQLite tier. */
export function formOptionsScope(
  ownerId: string | null,
  localDatabasePath?: string
): string {
  if (ownerId !== null) {
    return ownerId;
  }

  const databasePath = localDatabasePath ?? resolveDatabasePath();
  const databaseHash = createHash("sha256")
    .update(databasePath)
    .digest("hex");
  return `local:${databaseHash}`;
}

export function formOptionsCacheKey(
  entity: FormOptionsEntity,
  ownerScope: string
): string[] {
  return ["form-options", entity, ownerScope];
}

export type InvalidateFormOptionsDeps = {
  revalidate?: (tag: string) => void;
};

export function scopedFormOptionsTag(tag: FormOptionsTag, scope: string): string {
  return `${tag}:${scope}`;
}

async function resolveFormOptionsScope(deps: RepositoryFactoryDeps): Promise<{
  ownerId: string | null;
  scope: string;
}> {
  const resolveOwnerId = deps.getCurrentOwnerId ?? getCurrentOwnerId;
  const ownerId = await resolveOwnerId();
  return { ownerId, scope: formOptionsScope(ownerId) };
}

/** Drop this Owner/database's cached form dropdown lists after a mutation. */
export async function invalidateFormOptions(
  tags: readonly FormOptionsTag[],
  deps: RepositoryFactoryDeps & InvalidateFormOptionsDeps = {}
): Promise<void> {
  const revalidate = deps.revalidate ?? revalidateTag;
  const { scope } = await resolveFormOptionsScope(deps);
  for (const tag of tags) {
    revalidate(scopedFormOptionsTag(tag, scope));
  }
}

async function cachedListAll<T>(
  entity: FormOptionsEntity,
  tag: FormOptionsTag,
  listAll: (ownerId: string | null) => Promise<T[]>,
  deps: RepositoryFactoryDeps
): Promise<T[]> {
  const { ownerId, scope } = await resolveFormOptionsScope(deps);

  return unstable_cache(
    async () => listAll(ownerId),
    formOptionsCacheKey(entity, scope),
    {
      tags: [scopedFormOptionsTag(tag, scope)],
      revalidate: REVALIDATE_SECONDS
    }
  )();
}

/** Institution names for create/edit form dropdowns. */
export async function listInstitutionsForForms(
  deps: RepositoryFactoryDeps = {}
): Promise<Institution[]> {
  return cachedListAll(
    "institutions",
    FORM_OPTIONS_TAGS.institutions,
    async (ownerId) =>
      (
        await getInstitutionRepository({
          ...deps,
          getCurrentOwnerId: async () => ownerId
        })
      ).listAll(),
    deps
  );
}

/** Accounts for create/edit form dropdowns (transfers, fixed deposits). */
export async function listAccountsForForms(
  deps: RepositoryFactoryDeps = {}
): Promise<Account[]> {
  return cachedListAll(
    "accounts",
    FORM_OPTIONS_TAGS.accounts,
    async (ownerId) =>
      (
        await getAccountRepository({
          ...deps,
          getCurrentOwnerId: async () => ownerId
        })
      ).listAll(),
    deps
  );
}

/** Fixed deposits for transfer form dropdowns. */
export async function listFixedDepositsForForms(
  deps: RepositoryFactoryDeps = {}
): Promise<FixedDeposit[]> {
  return cachedListAll(
    "fixedDeposits",
    FORM_OPTIONS_TAGS.fixedDeposits,
    async (ownerId) =>
      (
        await getFixedDepositRepository({
          ...deps,
          getCurrentOwnerId: async () => ownerId
        })
      ).listAll(),
    deps
  );
}
