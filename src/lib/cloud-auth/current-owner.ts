import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

import { getAuthProvider } from "@/config/auth-provider";
import { isCloudMode } from "@/config/deployment-mode";
import {
  readRequestIdentity,
  type RequestIdentity
} from "@/lib/cloud-auth/request-identity";

export async function getIdentityFromSession(
  supabase: Pick<SupabaseClient, "auth">
): Promise<RequestIdentity | null> {
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) {
    return null;
  }

  const sub = data.claims.sub;
  if (typeof sub !== "string" || sub.length === 0) {
    return null;
  }

  const email = data.claims.email;
  return {
    ownerId: sub,
    email: typeof email === "string" && email.length > 0 ? email : null
  };
}

export async function getOwnerIdFromSession(
  supabase: Pick<SupabaseClient, "auth">
): Promise<string | null> {
  return (await getIdentityFromSession(supabase))?.ownerId ?? null;
}

export async function getOwnerEmailFromSession(
  supabase: Pick<SupabaseClient, "auth">
): Promise<string | null> {
  return (await getIdentityFromSession(supabase))?.email ?? null;
}

// Fallback for contexts that do not pass through middleware. Normal page
// renders consume middleware's verified request identity below and never make
// this second claims call.
const getCurrentOwnerClaims = cache(async (): Promise<Record<string, unknown> | null> => {
  if (!isCloudMode() || getAuthProvider() !== "supabase") {
    return null;
  }

  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) {
    return null;
  }

  return data.claims;
});

/** AUTH_PROVIDER=simple resolves identity straight from the signed session
 * cookie — the owner id and email both come from the same decoded email, so
 * this is cached per request the same way getCurrentOwnerClaims() is, letting
 * getCurrentOwnerId() and getCurrentOwnerEmail() share one cookie read. */
const getCurrentSimpleIdentity = cache(async (): Promise<{ ownerId: string; email: string } | null> => {
  if (!isCloudMode() || getAuthProvider() !== "simple") {
    return null;
  }

  const { cookies } = await import("next/headers");
  const { SIMPLE_SESSION_COOKIE, deriveOwnerId, verifySessionToken } = await import("@/lib/simple-auth/session");
  const store = await cookies();
  const identity = await verifySessionToken(store.get(SIMPLE_SESSION_COOKIE)?.value);

  return identity ? { ownerId: await deriveOwnerId(identity.email), email: identity.email } : null;
});

const getCurrentOwnerIdentity = cache(async (): Promise<RequestIdentity | null> => {
  if (!isCloudMode()) {
    return null;
  }

  const { headers } = await import("next/headers");
  const forwardedIdentity = readRequestIdentity(await headers());
  if (forwardedIdentity) {
    return forwardedIdentity;
  }

  if (getAuthProvider() === "simple") {
    return getCurrentSimpleIdentity();
  }

  const claims = await getCurrentOwnerClaims();
  const sub = claims?.sub;
  if (typeof sub !== "string" || sub.length === 0) {
    return null;
  }

  const email = claims?.email;
  return {
    ownerId: sub,
    email: typeof email === "string" && email.length > 0 ? email : null
  };
});

export const getCurrentOwnerId = cache(async (): Promise<string | null> => {
  return (await getCurrentOwnerIdentity())?.ownerId ?? null;
});

export async function getCurrentOwnerEmail(): Promise<string | null> {
  return (await getCurrentOwnerIdentity())?.email ?? null;
}
