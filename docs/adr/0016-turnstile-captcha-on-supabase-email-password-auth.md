---
status: accepted
---

# Cloudflare Turnstile on Supabase email/password authentication

Cloud Supabase email/password sign-in and sign-up had no app-level bot protection — credential stuffing and signup spam only hit whatever rate limits Supabase applies by default. We require Cloudflare Turnstile on sign-in, sign-up, and recovery-email submits: the login UI embeds a managed/normal/light widget, Server Actions reject an empty `cf-turnstile-response` before calling Auth, and a present token is passed as Supabase Auth's `captchaToken` so verification stays in hosted Auth (secret configured only in the Supabase dashboard). The app env exposes only `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Missing that key fails closed for email/password and recovery-email forms (system error; forms hidden) while Google OAuth may remain. Changing the password through an authenticated recovery session, Google, `AUTH_PROVIDER=simple`, and local `supabase/config.toml` captcha stay out of scope for this change.

## Considered Options

- **App-side Turnstile siteverify** (Next.js holds the secret and checks the token before Auth) — rejected: duplicates what Supabase Auth already does when captcha is enabled on the project, and puts a second copy of the secret in app env.
- **Risk-based / after-N-failures only** — rejected: needs shared rate-limit state and leaves the first attempts open; always-on is simpler and matches the threat (public cloud login).
- **Omit captcha from password recovery** — rejected: enabling Supabase Auth captcha also protects its recovery endpoint, so recovery-email requests must supply a token. Google OAuth and authenticated password changes do not require this widget.
- **Enable `[auth.captcha]` in local `supabase/config.toml`** — rejected for now: local Auth keeps captcha off so integration tests can pass a synthetic token; hosted Supabase is where Turnstile is enabled.

## Consequences

Hosted cloud deployments that use Supabase email/password must set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and enable Turnstile (provider + secret) in Supabase Auth captcha settings, or email/password login and recovery-email forms will not render. Unit tests inject a FormData token and assert forwarding; they do not call Cloudflare. Electron packaging (`scripts/package-electron.sh`) unsets the site key so the desktop bundle never inlines captcha.
