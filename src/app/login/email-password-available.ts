/** Email/password forms require a Turnstile site key; without it only Google may remain. */
export function isEmailPasswordLoginAvailable(turnstileSiteKey: string | null): boolean {
  return turnstileSiteKey !== null && turnstileSiteKey.length > 0;
}
