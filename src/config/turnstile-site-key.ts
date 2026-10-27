/**
 * Cloudflare Turnstile site key for cloud Supabase email/password login.
 * Secret stays in the hosted Supabase Auth captcha settings — never in app env.
 */
export function getTurnstileSiteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return key && key.length > 0 ? key : null;
}
