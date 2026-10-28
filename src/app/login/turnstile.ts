/** Turnstile's default form field name when the widget is embedded in a `<form>`. */
export const TURNSTILE_RESPONSE_FIELD = "cf-turnstile-response";

export const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
export const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Run once `window.turnstile` exists (script `load` or already present).
 * Intentionally ignores `turnstile.ready`: Cloudflare throws if api.js was loaded with
 * async/defer, and both Next.js `Script` (afterInteractive) and our injector use async.
 * Explicit render only needs `turnstile.render()` after the script has loaded.
 */
export function runWhenTurnstileApiReady(
  _api: { ready?: (callback: () => void) => void },
  run: () => void
): void {
  run();
}

export function readCaptchaToken(formData: FormData): string {
  return String(formData.get(TURNSTILE_RESPONSE_FIELD) ?? "").trim();
}
