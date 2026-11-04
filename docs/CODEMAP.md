# Code Map

Where modules live, what each is responsible for, and how they depend on each other. `docs/specs/` defines both domain vocabulary and intended feature behavior, and `docs/adr/` records architectural decisions. Change history belongs in commit messages, specs, and ADRs — not here.

## Table of contents

- [Feature specifications](#feature-specifications)
- [Current status](#current-status)
- [Invariants](#invariants)
- [Current structure](#current-structure)
  - Root documents; build, packaging & release
  - `src/demo-data`, `src/desktop`, `src/i18n`
  - `src/app` (shell, shared components, per-route screens, auth, API routes)
  - `src/lib/supabase`, `src/lib/cloud-auth`, `src/lib/simple-auth`, `src/middleware.ts`, `src/config`, `src/domain`, `src/db`, `src/email-sync`
  - Cloud & deploy infrastructure (`postgres/`, `drizzle/`, `supabase/`, `vercel.json`)
- [Application boundaries](#application-boundaries)
- [Data flows](#data-flows)
- [Test locations](#test-locations)

## Feature specifications

- `docs/specs/accounts.md` — Institutions, Accounts, computed balances, BalanceSnapshots, Account hard delete.
- `docs/specs/transactions.md` — Account ledger behavior, trust status, editability.
- `docs/specs/fixed-deposits.md` — FixedDeposit lifecycle and constraints.
- `docs/specs/transfers.md` — atomic two-leg Transfers, ledger projections, realized FX rate, editing.
- `docs/specs/reconciliation.md` — Reconciliation, Discrepancy resolution, Adjustment.
- `docs/specs/import.md` — MCP statement import, ImportBatch review/confirm/undo, Suspected Duplicate flagging.
- `docs/specs/email-alert-sync.md` — IMAP bank-alert polling, server-side LLM structuring, Account resolution into ImportBatches.
- `docs/specs/share-trading.md` — ShareTradingAccount/StockTransaction, Holdings, StockImportBatch, and what is out of scope.
- `docs/specs/ui.md` — navigation, route map, and form conventions.

## Current status

Signed-out cloud visitors see the public marketing page; signed-in cloud and local users see the dashboard. The dashboard shows a welcome state with one Add Institution link whenever no Institutions exist. Once one exists, it shows the regular dashboard. Copy lives in the three locale catalogs; `.pw-onboarding` styles the welcome state.


- **Built:** every domain entity (Institution, Account, Transaction, BalanceSnapshot, FixedDeposit, Transfer, Reconciliation, Discrepancy, Adjustment) plus ImportBatch, ShareTradingAccount, StockTransaction, and StockImportBatch, each with a domain seam, a SQLite repository, a Postgres repository, and UI. The full route map in `docs/specs/ui.md` is implemented.
- **Tiers:** local/self-hosted (SQLite) and desktop (Electron, SQLite-only, ADR-0007) are complete. The cloud tier (Postgres + Supabase Auth or `AUTH_PROVIDER=simple`, ADR-0006/ADR-0015) serves every screen and Server Action except dev-only `/dev/seed`.
- **Import paths:** MCP import (local loopback; cloud via bearer token, ADR-0011) and email alert sync (local daemon; cloud Vercel Cron, ADR-0010).
- **Known gaps:**
  - Nothing starts the local email-sync daemon (`pnpm email-sync:poll`) automatically.
  - Share trading has no cash legs, cost basis, valuation, or Reconciliation equivalent, and email alert sync does not cover broker trade confirmations.
  - `/stock-imports/[id]` edit links have no `returnTo`, unlike `/imports/[id]`.
  - Repository error messages composed in `src/db/errors.ts` stay English (they all pass through `src/app/domain-error-text.ts`).
  - `AUTH_PROVIDER=simple` has no password reset.
  - Vercel Cron runs daily (`0 8 * * *`) because Hobby plans disallow hourly.
  - Postgres `owner_id` columns have no FK to `auth.users`.
  - `owner_emails` rows exist only for Owners who signed in after it shipped.
  - LLM host DNS check does not pin `fetch` to the resolved address (accepted TOCTOU, ADR-0013).
  - `duplicate-submission-guard.ts` is single-process only (best-effort on serverless).

## Invariants

- **Deletion:** Institution and Account deletes are blocked while dependents exist (`getDependentCounts()` → `EntityHasDependentsError`); repositories check counts themselves rather than relying on DB `ON DELETE CASCADE`, which would silently drop ledger history. Account `hardDelete()` is the separate advanced path (blocked by a linked FixedDeposit or by a counterparty Account that has reconciled past a shared Transfer). FixedDeposit has no edit or delete (ADR-0003). Transfers are always deletable; their linked Transactions go with them and FixedDeposit state is recomputed. ImportBatch `delete()` is pre-confirm; `undoConfirmed()` is post-confirm, blocked by an owner-authored Adjustment or a later Reconciliation.
- **Editing:** a Transaction is editable/deletable only when Imported, or Confirmed with no `transferId` and no Adjustment (`TransactionNotEditableError`). Transfers support full re-edit except `fixed-deposit-opening` (`TransferNotEditableError`). Account `currencyCode` is never updatable.
- **Owner isolation (cloud):** app-layer, not RLS (ADR-0006). Every Postgres `select` filters by `ownerId`, and every `update`/`delete` includes `ownerId` in its predicate. A missing Owner predicate on an `update`/`delete` silently no-ops on another Owner's row instead of throwing — the highest-risk pattern; each Pg repository's tests reproduce it. Compound `(id, owner_id)` FKs stop cross-Owner references but are not a substitute for the predicate.
- **Tier selection:** `src/db/repository-factory.ts` is the only seam. Local mode → SQLite; cloud mode + Owner → `Pg*Repository`; cloud mode without an Owner throws `DatabaseConfigurationError` (never falls back to SQLite).
- **Bundling:** desktop/local never evaluates Supabase/Postgres modules and cloud never loads `better-sqlite3`; cross-tier modules are reached only through dynamic `import()` behind `isCloudMode()`/`getAuthProvider()`.
- **Language:** `src/domain` and `src/db` never know the display language; Server Actions return `LocalizedText` keys. Money display is not localized (`DISPLAY_LOCALE = "en-US"`).

## Current structure

### Root documents & tooling entry points

- `AGENTS.md` — agent operating instructions. `docs/specs/` — domain vocabulary and feature behavior. `DESIGN.md` / `docs/brand/README.md` — visual design and brand (display brand **Money Watch**).
- `docs/specs/`, `docs/adr/` — feature specs and ADRs. `docs/agents/` — agent guidance (`domain.md`, `issue-tracker.md`, `mobile-ux.md`, `product-qa.md`). `docs/qa/` — audits and test-case write-ups. `docs/mcp-setup.md`, `docs/cron-setup.md` — setup guides.
- `package.json` — commands (`dev`, `build`, `test`, `lint`, `typecheck`, `electron:dev`, `electron:start`, `electron:package`, `release`, `supabase:start`, `email-sync:poll`, `perf:navigation`). `dev`/`start` run `scripts/prepare-cloud-database.ts` first and set `DEPLOYMENT_MODE=cloud`; `electron:start` builds with `DEPLOYMENT_MODE=local` (`scripts/electron-start-script.test.ts`).
- `vitest.config.ts` / `src/test/vitest.setup.ts` — Vitest; the setup mocks `revalidateTag` (tests asserting form-options invalidation inject `deps.revalidate`); `revalidatePath` stays real.

### Build, packaging & release (Electron shell, `scripts/`, CI)

- `electron/main.cjs` — local-only shell (ADR-0007). Sets `DEPLOYMENT_MODE=local`, `PAISA_WATCH_DESKTOP=1`, `DATABASE_PATH` (appData/`Paisa-Watch` or saved setting) and `MIGRATIONS_FOLDER`, runs prepare-database, spawns Next on loopback port 4571 (sequential fallback), and opens a `BrowserWindow`. No native modules in the Electron process. Carries CJS mirrors of `resolveDatabasePath`, `resolveAppUrl`, `resolveLoopbackPort`, and merge-preserving `settings.json` writes (it cannot import the TS modules). `electron/preload.cjs` — renderer bridge (`window.paisaWatch` file/folder pickers).
- `electron/app-paths.cjs` — `resolveAppLayout` / `resolveNodeBinary` / `resolveChildProcessEnv` for unpackaged vs packaged layouts; packaged children run as Electron-as-Node (`ELECTRON_RUN_AS_NODE=1`).
- `scripts/prepare-database.ts` — SQLite migrations via `ensureDatabaseReady()`. `scripts/prepare-cloud-database.ts` — loads `.env`/`.env.local`, then `ensurePostgresDatabaseReady()`.
- `scripts/email-sync-poll-daemon.ts` — standalone `tsx` process for `startEmailAlertSyncPolling()`; never imported by Next (imapflow breaks Next's edge bundling).
- `scripts/package-electron.sh` — Electron packaging for mac/linux/win. Stashes dotenv files and unsets cloud secrets before one standalone `next build`, then stages per-platform resource trees each pruned to that platform's `better-sqlite3` prebuild. Host requirements (Wine on Linux for win, Rosetta on Apple Silicon, ad-hoc mac signing when no Developer ID) are documented and preflighted in the script. `scripts/electron-after-pack.cjs` strips workspace `node_modules` from `app.asar`. `package.json` `build.*` holds per-platform `extraResources` and disables win signing.
- `scripts/release.sh` / `scripts/release-steps.ts` — tests → typecheck → Electron package → GitHub Release → `vercel deploy --prod` (`--skip-*` flags). Cloud env lives in Vercel project settings.
- `scripts/navigation-benchmark.ts` (`pnpm perf:navigation`) — warm-p95 navigation benchmark.
- `scripts/demo-data/` — regenerates `public/demo-data/seed-data.json`; see its README.
- `.github/workflows/deploy.yml` — on push to `main`: starts local Supabase, then `pnpm release -- --skip-electron --skip-github`. Needs `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

### `src/demo-data`

`generate-seed-data.ts` (`generateDemoSeedData()`) and `load-demo-seed.ts` (`loadDemoSeedData()`), used by `/dev/seed`.

### `src/types`

`paisa-watch-desktop.d.ts` — the `window.paisaWatch` file/folder picker types for the Electron preload bridge; no runtime code.

### `src/functional-qa`

Ad-hoc QA suites that call real Server Actions and repositories directly (no browser): `screen-qa.test.ts` (edge cases across all UI Server Actions), `scenario-verification.test.ts` (Transfer/Transaction add, delete, duplicate, edit scenarios).

### `src/desktop`

Electron bootstrap helpers: `database-path.ts` (`resolveDatabasePath`), `app-url.ts` (`resolveAppUrl`), `ensure-database.ts` (create parents, migrate, close), `resolve-loopback-port.ts` (pure port selection with injected probe).

### `src/i18n`

English, Simplified Chinese, Arabic; locale is the `pw-locale` cookie, set in Settings or the header switcher.

- `locales.ts` — `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `LOCALE_LABELS`, `LOCALE_TAGS`, `localeDirection()` (Arabic `rtl`), `resolveLocale()`.
- `messages/en.ts` — source catalog; `zh.ts`/`ar.ts` are typed against its keys, so a missing translation is a compile error.
- `translator.ts` — `createTranslator()` → `t()`, `plural()`, `text()` for `LocalizedText`.
- `server.ts` — `getLocale()` (React `cache()`-wrapped) / `getTranslator()`. `client.tsx` — `LocaleProvider` + `useTranslator()`; only the active catalog ships to the client.
- `rich-text.ts` — `renderMessage()` substitutes React nodes into `{placeholders}`.

### `src/app`

#### Shell chrome

- `layout.tsx`, `loading.tsx`, `not-found.tsx`, `icon.svg` (favicon); `marketing-metadata.ts` provides localized public-page title and description.
- `components/app-header.tsx` — server component: brand, `<NavTabs>` (hidden in cloud mode without a session, `nav-tabs-visibility.ts`), `<HeaderLanguageSwitcher>`, and in cloud mode a dynamically imported `CloudOwnerControls` (initials + sign-out, gated on `ownerId`).
- `components/nav-tabs.tsx` — Dashboard / Imports / Settings / MCP from one `TABS` array: inline `.pw-nav` on wide viewports, portaled `.pw-nav-drawer-*` behind a hamburger at `max-width: 640px` (CSS picks which).
- `components/header-language-switcher.tsx` — icon button opening a bottom sheet of locales; calls `settings/locale-actions.ts`'s `setLocale()`.
- `components/brand-mark.tsx` — register mark from `public/brand/logo-mark.svg`.
- `globals.css` — shared Soft Ledger classes; reuse these rather than adding ad hoc ones. Surfaces: `.pw-card`, `.pw-dashboard`, `.pw-detail`, `.pw-detail-header`, `.pw-detail-meta`. Wells: `.pw-list`, `.pw-facts`, `.pw-empty`, `.pw-balance*`, `.pw-currency-total-*`, `.pw-fieldset` (never nest elevated cards). Controls: `.pw-field`, `.pw-segmented`, `.pw-sheet-*`, `.pw-toggle-*`, `.pw-choice-chip`, `.pw-menu`. Lists/ledgers: `.pw-list-paged`, `.pw-section-*`, `.pw-item-title` (`overflow-wrap: anywhere`), `.pw-item-sub`, `.pw-item-amount`, `.pw-item-tags`, `.pw-item-tag-edit` (~44px hit area — only safe where no adjacent link), `.pw-badge`. Detail headings: `.pw-detail-heading-row`, `.pw-detail-icon`, `.pw-menu-danger`. Actions: `.pw-actions`, `.pw-sticky-actions`, `.pw-action-primary`, `.pw-danger-zone`, `.pw-form-stack` (stacks a card with trailing content — `.pw-main` is a flex row). Banners: `.pw-banner-error`, `.pw-banner-success`. `.pw-list > li > a|span` is the only child shape that gets list-row layout. RTL overrides live at the bottom of the file.
- `design-system/tokens.css` — palette, type scale, radii, shadows, widths. `components/design-system.tsx` — `<PageHeader>`, `<SectionHeader>`, `<DataRow>`.

#### Shared components & helpers

- Form controls: `components/decimal-input.tsx` (`<DecimalInput>`, required for money/rate fields) + `decimal-field.ts` (`sanitizeDecimalInput`), `segmented-control.tsx`, `sheet-select.tsx`, `toggle-field.tsx`, `required-mark.tsx`, `currency-flag.tsx`, `icons.tsx` (`EditIcon`/`DeleteIcon`, non-mirroring under RTL).
- Lists: `components/collapsible-section-list.tsx` (collapse + 6-at-a-time scroll pagination; optional `total`/`onNeedMore` for server-backed paging; `defaultExpanded` is initial-only, so callers remount via `key`), `collapsible-section.tsx`, `list-pagination.ts` (`LIST_PAGE_SIZE` 6 reveal vs `LEDGER_FETCH_SIZE` 60 fetch).
- Navigation: `components/back-link.tsx` (fixed parent), `back-to-previous-link.tsx` (`router.back()`, Transfer detail only), `return-to.ts` (`resolveReturnTo` — same-origin relative paths only).
- Feedback: `components/system-message.ts` / `system-message-banner.tsx` (`?message=`/`?error=` codes → fixed copy, never raw query text), `app-pending-indicator.tsx` / `app-pending-events.ts` (app-wide pending spinner).
- Forms: `form-persistence.ts` (`withPersistedFormState`, required so validation errors keep input; `omitKeys` for secrets), `form-limits.ts` (`TEXT_FIELD_MAX_LENGTH` 60), `duplicate-submission-guard.ts` (`claimIdempotencyKey`, create paths only), `components/delete-confirm-form.tsx`, `hard-delete-confirm-form.tsx` (type-the-name gate), `dashboard-add-menu.tsx`, `institution-add-menu.tsx`.
- `stock-transaction-batch-state.ts` — restores typed stock-entry rows from persisted action values after validation errors; used by the desktop batch form and covered by its colocated test.
- Formatting: `format-money.ts` (`formatMinorUnits`, `formatRealizedFxRate`, `DISPLAY_LOCALE`), `format-calendar-date.ts` (UTC-anchored `YYYY-MM-DD`), `datetime-local.ts`, `format-fixed-deposit.ts`, `domain-error-text.ts`.
- Caching: `form-options-cache.ts` — `unstable_cache` for create/edit dropdown options (`listInstitutionsForForms`/`listAccountsForForms`/`listFixedDepositsForForms`), scoped by Owner or hashed local DB path; matching Server Actions call `invalidateFormOptions`. Money screens are never cached.
- Filters: `institution-group-filter.ts`, `account-balance-filter.ts` (Hide zero-balance accounts).
- Availability: `transfer-availability.ts` — `canCreateTransfer()` gates Transfer entry points until an Account has a distinct Account or Open FixedDeposit destination.
- `components/transfer-availability-action.tsx` — shared available Transfer link and blocked action with hover, focus, and tap prerequisite help.

#### Dashboard

- `page.tsx` — signed-out cloud visitors get `components/marketing-landing.tsx`; otherwise per-currency totals (no cross-currency total), Account/FixedDeposit groups via `components/institutions-browser.tsx` (client-side name/number search and per-Account income/expense shortcuts), ShareTradingAccounts section (Holdings count via `listAllWithHoldingCounts()`, no valuation), six recent Transactions (`listRecentByAccountIds`). Links to expensive detail routes disable prefetch.
- `components/marketing-landing.tsx` — localized public cloud introduction, plain-language MCP import/transaction-query and email-sync explanations, local/self-hosted privacy boundaries, and sign-in calls to action; its product-preview illustration is static markup and CSS.

#### Entity routes

- `institutions/` — `page.tsx` lists Institutions for management, `new/`, `[id]/` (Accounts via client `components/account-list-section.tsx`, FixedDeposits, ShareTradingAccounts — all `listByInstitutionId`), `[id]/edit/`, `[id]/delete/`.
- `accounts/` — `new/` (`?institutionId=` preselect), `[id]/` (ledger via `getInitialLedgerOverview`), `[id]/edit/`, `[id]/delete/` (guarded delete + Danger Zone hard delete), `[id]/reconcile/`, `[id]/transactions/new/` and `[transactionId]/edit|delete/` (manual or Imported only; honors `?returnTo=`; new entry uses a mobile single form and a desktop multi-row table). `components/transaction-ledger.tsx` (client) pages, searches, and month-filters via `[id]/ledger-actions.ts`'s `loadLedgerPage` — filtering runs in SQL, never over loaded rows.
- `fixed-deposits/` — `new/` (optional `debitNow` opening debit) and `[id]/` with Transfer history and top-up/withdrawal launch.
- `transfers/` — `new/`, `[id]/`, `[id]/edit/` (reuses `new/transfer-form.tsx`), `[id]/delete/`. Opening debit only via FD create or `purpose=fixed-deposit-opening` deep link. `new/transfer-amount-sync.ts` clears a mirrored amount on currency change.
- `reconciliations/[id]/` — detail (`getDetailById`) and Discrepancy resolution (`resolution-form.tsx`, `resolve-actions.ts`).
- `share-trading-accounts/` — `new/`, `[id]/` (Holdings + StockTransaction ledger), `[id]/edit|delete/`, `[id]/stock-transactions/new/` (mobile single form, desktop multi-row table) and `[stockTransactionId]/edit|delete/`.
- `prototype/bulk-entry/` — dev-only interactive sample comparing three batch-entry layouts for Account Transactions and StockTransactions; all state is in memory and production returns 404.
- `imports/` — `/imports` (Email sync vs MCP import by `batch.source`, plus the Unresolved email alerts queue with in-place correction form backed by `resolve-unresolved-email-alert-actions.ts`), `[id]/` review (edit/remove line items via the generic Transaction routes with `returnTo`, dismiss Suspected Duplicates, Confirm All gated on unresolved duplicates), `[id]/delete/` (pre-confirm delete or post-confirm undo). Confirm All and Undo are never both shown.
- `stock-imports/` — same shape as `imports/` for StockImportBatch.
- `settings/mcp/page.tsx` — dedicated MCP connection setup, linked below Settings in desktop and mobile navigation; reuses the existing guide and token actions.
- `settings/` — database path (local only; desktop pickers via `window.paisaWatch`; `normalize-database-path.ts` resolves directory input to a file path outside the `"use server"` module because helpers there must be async actions), language (`language-form.tsx`, `locale-actions.ts`), link to the `mcp/` setup guide (`mcp-setup-section.tsx`, `mcp-connection.ts`, cloud token generate/revoke in `mcp-token-actions.ts`), Email Alert Sync (`email-sync-settings-form.tsx`, `email-sync-actions.ts` — secrets never echoed back; status panel + Check now), and `llm-host-safety-policy.ts` (cloud SSRF guard skipped on loopback so local cloud-mode can reach Ollama). `settings-copy.ts` picks desktop/self-hosted/cloud copy.
- `dev/seed/` — dev-only demo data loader; redirects in production.

#### Auth & Login (cloud only)

- `login/` — `page.tsx` redirects in local mode; dynamically imports `login-form.tsx` (Supabase: sign in/up + Turnstile, Google, forgot password) or `simple-login-form.tsx`. `actions.ts` — Supabase Server Actions (`signIn`, `signUp`, `signInWithGoogle`, `requestPasswordReset`, `resetPassword`, `signOut`); `signIn`/`signUp`/`requestPasswordReset` require `cf-turnstile-response` and pass `captchaToken` to Auth. `turnstile-field.tsx` / `turnstile.ts` / `turnstile-preload.tsx` — managed Turnstile widget; script preloaded on login HTML, kept across remounts; explicit `render()` after async load — never `turnstile.ready()` (Cloudflare throws with async/defer). `email-password-available.ts` — hide email/password when site key missing. `simple-actions.ts` — `simpleSignIn`/`simpleSignOut` (same generic error for any bad credential). `forgot-password/`, `reset-password/` — Supabase-only; requesting a recovery email requires Turnstile, changing the password uses the recovery session. `sync-owner-email.ts` — best-effort `owner_emails` write at every session start; never fails a sign-in.
- `auth/callback/` — OAuth/email-link target; `handle-callback.ts` exchanges the code, syncs owner email, and redirects to `resolveReturnTo(next, "/")` or `/login?error=<code>`.

#### API routes

- `api/mcp/` — MCP import and read-only transaction-search server. `tools.ts` is the tested, transport-agnostic seam (`search_transactions`; `list*`/`create*` (require `confirmed: true`)/`resolve*`/`stage*`/`commit*` for Accounts and ShareTradingAccounts). Transaction search is owner-scoped, newest-first, filterable, and capped at 100 rows. `resolve*` uses the deterministic `resolveAccountByNumberSuffix`, never creates, and reports `unresolved`/`ambiguous`/`wrong-account-type`. `stage*` writes nothing and flags likely duplicates. `commit*` delegates to the batch repositories and accepts `idempotencyKey`. `route.ts` — stateless Web-standard streamable HTTP transport; local mode enforces `loopback-guard.ts` (Host/Origin, DNS-rebinding), cloud mode `cloud-auth.ts` bearer token → Owner. `route.ts` is untested by design.
- `api/cron/email-sync/route.ts` — Vercel Cron: `cron-auth.ts` (`CRON_SECRET`, constant-time, ≥32 chars), 404 outside cloud, iterates Owners by `lastPolledAt` within a 45s budget, per-Owner failures sanitized.
- `api/email-sync/check-now/route.ts` — Settings "Check now" trigger. Both email-sync routes are `runtime = "nodejs"`.

### `src/lib/supabase`

`server.ts` — `createSupabaseServerClient()` for Next `cookies()`. Only loaded when cloud + `AUTH_PROVIDER=supabase`.

### `src/lib/cloud-auth`

- `current-owner.ts` — `getCurrentOwnerId()` / `getCurrentOwnerEmail()` (shared `cache()`d identity). Normal renders read the identity middleware already verified via `request-identity.ts`; direct Supabase/simple-cookie verification is the fallback. Local mode returns `null` without loading either backend.
- `request-identity.ts` — internal Owner headers; `withVerifiedRequestIdentity()` always deletes incoming values before writing verified ones. The middleware matcher therefore covers every path except `/_next/static` and `/_next/image`; asset-extension paths skip the login gate but still have identity headers stripped (`src/middleware.test.ts`).
- `session-gate.ts` — `shouldRedirectToLogin()`; public paths include `/`, `/login*`, `/auth/callback`, `/api/mcp`, `/api/cron/email-sync` (the last two authenticate themselves).

### `src/lib/simple-auth`

`session.ts` — `AUTH_PROVIDER=simple` (ADR-0015): `getAuthUsers()` parses `AUTH_USERS`, `verifyCredentials()`, `deriveOwnerId()` (UUID v5 from email), `createSessionToken()`/`verifySessionToken()` (HMAC keyed by the user's current password, so editing `AUTH_USERS` revokes sessions), `resolveOwnerIdFromToken()`. Web Crypto, Node + Edge.

### `src/middleware.ts`

Local mode passes through without importing auth. Cloud mode verifies the session once (per `getAuthProvider()`), applies `shouldRedirectToLogin()`, strips client-supplied identity headers, and forwards the verified Owner id/email to the render.

### `src/config`

- `deployment-mode.ts` — `isCloudMode()`: false on desktop; true iff `DEPLOYMENT_MODE=cloud` or `VERCEL=1`.
- `auth-provider.ts` — `getAuthProvider()`: `"simple"` iff `AUTH_PROVIDER=simple`, otherwise `"supabase"`.
- `turnstile-site-key.ts` — `getTurnstileSiteKey()` from `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (null if unset); secret lives only in hosted Supabase Auth captcha settings.
- `is-desktop-app.ts` — `isDesktopApp()` (`PAISA_WATCH_DESKTOP=1`).
- `resolve-database-path.ts` — explicit path → `DATABASE_PATH` → saved setting → `./paisa-watch.db`.
- `database-settings.ts` — merge-preserving read/write of `~/.config/paisa-watch/settings.json`; `email-sync-settings.ts` layers on it.
- `email-sync-encryption-key.ts` — `EMAIL_SYNC_ENCRYPTION_KEY` (32 bytes, cloud only, ADR-0012). `email-sync-status.ts` — local poll status.
- `postgres-connection.ts` — `POSTGRES_URL` or the local Supabase default. `load-project-env.ts` — `.env` then `.env.local`, no overrides.

### `src/domain`

Pure logic and types; no database or framework imports.

- Entity types: `institution.ts`, `account.ts`, `transaction.ts` (`TrustStatus`, ISO normalization), `balance-snapshot.ts`, `fixed-deposit.ts` (`originalPrincipalMinor` immutable, `FixedDepositStatus`), `transfer.ts` (`purpose`, `assertValidTransferLegs/Purpose/Amounts`, `realizedFxRate()` — derived, never stored), `reconciliation.ts`, `discrepancy.ts`, `adjustment.ts`, `import-batch.ts`, `share-trading-account.ts`, `stock-transaction.ts` (`parseWholeShareQuantity`), `stock-import-batch.ts`.
- Money and dates: `money.ts` (safe-integer minor units), `currency.ts` (`getMinorUnitExponent`), `decimal-input.ts` (exact decimal parsing), `calendar-date.ts`, `account-balance.ts` (`computeAccountBalance`, `computeAccountBalanceAsOf` — inclusive end-of-day UTC), `currency-totals.ts` (per-currency, never across), `holdings.ts` (`computeHoldings`, net quantity only).
- Categories: `transaction-category.ts` (`categoriesForKind`, `assertValidCategoryForKind`).
- Import/sync: `account-number-match.ts` (`resolveAccountByNumberSuffix`/`findAccountNumberMatches` — digits-only last 4 + trimmed case-insensitive institution, never fuzzy; shared by email sync and MCP), `email-alert.ts` (field-by-field LLM output validation producing either an alert or a correctable draft; `toSignedAmount`, `isOccurredAtPlausible` ±3 days), `email-sync-cursor.ts` (`UIDVALIDITY:uid` pointer rules — the email-sync idempotency mechanism), `deterministic-id.ts` (`uuidFromHash`).
- Security: `imap-host-safety.ts` (always-on SSRF block list), `llm-host-safety.ts` (shape check both tiers; block list cloud only, so local can reach Ollama), `secret-cipher.ts` (AES-GCM `v1:` envelope; legacy plaintext passes through), `mcp-access-token.ts` (generate + SHA-256 hash).

### `src/db`

- `schema.ts` — SQLite Drizzle tables and constraints (source of truth for FKs). Live SQLite FKs for `transactions.import_batch_id` and `stock_transactions.import_batch_id` are `NO ACTION` despite the declared cascade (added via `ADD COLUMN`); repositories delete children explicitly, so this is harmless.
- `client.ts` — `createDb()` (isolated handle for tests/jobs; migrates on first use, `MIGRATIONS_FOLDER` or `<cwd>/drizzle`, `PRAGMA foreign_keys = ON`); `getSharedDb()` (one handle per DB path on `globalThis`, the UI runtime path); `closeSharedDb()`.
- `better-sqlite3-cloud-stub.ts` / `cloud-sqlite-webpack.ts` — `next.config.ts` aliases `better-sqlite3` to a throwing stub on cloud builds.
- `errors.ts` — typed errors and `runDatabaseWrite()` (rethrows existing `DatabaseError`s unchanged). `like-pattern.ts` — `likeContainsPattern` (escapes `%`/`_`/`\`). `inspect-database-path.ts` — Settings path validation.
- `repositories/ports.ts` — one `*RepositoryPort` per entity, implemented by both tiers: Institution, Account (incl. `listByInstitutionId`, `hardDelete`), FixedDeposit (create with optional atomic `openingDebit`; no update), ShareTradingAccount (incl. `listAllWithHoldingCounts`), StockTransaction (incl. `createMany`, `listByImportBatchId`, `sumQuantityByScripCode`, `dismissSuspectedDuplicate`), StockImportBatch, Transaction (incl. `createMany`, `listRecentByAccountIds`, `countByAccountId`, `listPageByAccountId`, `getInitialLedgerOverview`, `listMonthsByAccountId`, `sumAmountsByAccountIds`, `dismissSuspectedDuplicate`), BalanceSnapshot, Reconciliation (incl. atomic `createWithSnapshot`, `getDetailById`, `countOpenDiscrepanciesByAccountIds`, `listAdjustmentLinksByAccountId`, `resolveWithAdjustment`), Adjustment, ImportBatch (`confirmAll`, `delete`, `undoConfirmed`), EmailSyncCursor, UnresolvedEmailAlert, Transfer (incl. `getTransferImpactByAccountId`, `update`). Batch methods short-circuit `[]` on empty input; transaction `createMany` writes all supplied rows atomically.
- `repositories/*-repository.ts` — SQLite implementations. Notable behavior: `transfer-repository.ts` writes ledger projections atomically, applies chronological FixedDeposit appends with a guarded balance update, and replays dated history for backdated creates, edits, and deletes; `reconciliation-repository.ts` creates the BalanceSnapshot, Reconciliation, and optional Discrepancy atomically, and resolves conditionally (`WHERE resolution IS NULL`) with `DiscrepancyAlreadyResolvedError` on a lost race; `import-batch-repository.ts` / `stock-import-batch-repository.ts` compute Suspected Duplicate matches at `create()` (earliest match wins, `externalRef` preferred) and `confirmAll()` refuses while any remain (ADR-0014); `confirmAll()` is not one atomic write — a racing loser reports `ImportBatchAlreadyConfirmedError`. `email-alert-draft-json.ts` is shared by both tiers. `test-db.ts` — temp SQLite + migrations for tests.
- `repository-factory.ts` — `get*Repository(deps?)` for every port; `createDb`/Pg modules are dynamically imported per tier. See [Invariants](#invariants).

### `src/email-sync`

- `run-email-alert-sync-poll.ts` — `runEmailAlertSyncPoll(deps)`, the tested orchestration: skip at/below cursor → `parseAlertEmail` → plausibility → `resolveAccountByNumberSuffix` → create ImportBatch (deterministic ids) or queue for the owner; cursor advances per message. A unique-constraint race on queueing counts as `skipped`.
- `parse-alert-email.ts` — sender/subject classifier first (no body to the LLM for non-transactional mail), then LLM + validation. `llm-client.ts` — `createLlmCaller` / `createEmailClassifier` for any OpenAI-compatible or Ollama `/api/chat` URL (used as-is), optional API key, 30s timeout, memoized host-safety check when `enforceHostSafety`.
- `imap-client.ts` — `fetchUnseenImapMessages(config, 50)`; unseen-or-recent search (`imap-candidate-search.ts`, Gmail Promotions/Social excluded), `UIDVALIDITY`-prefixed uids, forwarded-sender extraction (`extract-original-sender.ts`). Untested by design.
- `assert-safe-imap-host.ts` / `assert-safe-llm-host.ts` — DNS-resolved SSRF checks.
- `create-email-alert-import-batch.ts` — one-line `commitImport` (reuses MCP validation). `resolve-unresolved-email-alert.ts` — owner-corrected import of a queued alert. `email-alert-import-ids.ts` — deterministic ids from `(mailbox, messageUid)`.
- `start-polling.ts` — local daemon loop: self-scheduling `setTimeout`, settings re-read every tick, pinned to local SQLite (`isCloudMode: () => false`), `enforceHostSafety: false`. `should-start-polling.ts` — required-settings check (API key optional). `check-now.ts` — shared seam for every trigger; always records a sanitized status.

### Cloud & deploy infrastructure (`vercel.json`, `postgres/`, `drizzle/`, `supabase/`)

`vercel.json` — `ELECTRON_SKIP_BINARY_DOWNLOAD=1` install and the `crons` schedule. `.vercelignore` excludes env/credentials/desktop/docs. `next.config.ts` excludes `better-sqlite3`/Electron from cloud output tracing.

#### Postgres core (`src/db/postgres`)

- `scoped-db.ts` — `getScopedDb(connectionString)`: Drizzle over the shared pool, running as the table owner (bypasses RLS; RLS policies stay defined but dormant, ADR-0006).
- `connection-pool.ts` — `getPooledClient()`: one client per connection string on `globalThis` (survives Fast Refresh); `max: 4` (dashboard's opening query wave vs Supabase's ~15-connection session-pooler cap); `idle_timeout: 300`.
- `ensure-database.ts` / `supabase-compat.ts` — `ensurePostgresDatabaseReady()` applies `postgres/migrations/*.sql` in order (tracked in `supabase_migrations.schema_migrations`), stubbing `auth.uid()`/`authenticated` on plain Postgres hosts.
- `schema.ts` — `pg-core` tables mirroring SQLite plus `email_sync_settings`, `owner_emails`, `mcp_access_tokens`; every table has `owner_id`, compound same-owner FKs via `ownerScopedForeignKey()`, and the performance indexes. `owner_emails` is keyed by Owner id with no FKs.

#### Postgres repositories (`src/db/postgres/repositories`)

`Pg*Repository(connectionString, ownerId)` for every port in `ports.ts`, owner-scoped per [Invariants](#invariants); async only (no `.get()`/`.run()`). `SUM`/`count(*) over ()` return `numeric` text and are cast to `number`. Unique violations (SQLSTATE `23505`) are normalized to `DatabaseConstraintError`. Cross-owner exceptions, by design: `email-sync-settings-repository.ts`'s `listAllEmailSyncCredentials()` (cron; returns per-row `ok`/`error` so one bad row cannot block others; IMAP credentials encrypted at rest) and `mcp-access-token-repository.ts`'s `resolveOwnerIdByTokenHash()`. `owner-email-repository.ts` — `upsertOwnerEmail()`, write-only.

#### Migrations and other directories

- `drizzle/` — generated SQLite migrations (edit `src/db/schema.ts` and regenerate; do not hand-edit).
- `postgres/migrations/` — hand-written Postgres migrations, applied by `ensurePostgresDatabaseReady()`; never edited after the fact.
- `supabase/` — local Supabase stack config (`config.toml`); `pnpm supabase:start` starts it and applies migrations.

## Application boundaries

```mermaid
flowchart TD
    electronShell[electron_main]
    nextServer[next_server]
    srcApp[src_app]
    srcDomain[src_domain]
    srcDbRepos[src_db_repositories]
    srcDbSchema[src_db_schema]
    sqliteDb[(sqlite_file_DATABASE_PATH)]

    electronShell --> nextServer
    nextServer --> srcApp
    srcApp --> srcDomain
    srcApp --> srcDbRepos
    srcDbRepos --> srcDbSchema
    srcDbSchema --> sqliteDb
```

- `electron/main.cjs` starts the local Next.js process and opens a window; it never loads `better-sqlite3`.
- `src/app` calls `src/domain` and the repository factory; never Drizzle directly.
- `src/domain` has no database or framework dependencies.
- `src/i18n` is imported by `src/app` only.
- `src/db/repository-factory.ts` is the only application-facing data-access surface; `src/db/postgres` mirrors `src/db/repositories` for the cloud tier.
- FK relationships are defined in `src/db/schema.ts` and `src/db/postgres/schema.ts`.

## Data flows

- **Balances:** Account balance = sum of its Transactions (Transfer legs and Adjustments are ordinary rows). Pages use SQL sums (`sumAmountsByAccountIds`, `getInitialLedgerOverview`); `computeAccountBalance*` is the pure reference and what Reconciliation's cutoff semantics are pinned against.
- **Dashboard:** four opening entity queries (fits pool `max: 4`) plus recent Transactions and holding counts — six statements over two waves.
- **Account detail:** `getInitialLedgerOverview` (first page, total, months, balance in one statement) + Institution and Reconciliation reads; later pages via `listPageByAccountId` (offset paging — a mid-scroll insert can shift rows by one, accepted).
- **Reconciliation:** `create()` computes the balance as of the BalanceSnapshot date and writes a Discrepancy iff they differ; `resolveWithAdjustment()` writes the Adjustment Transaction atomically.
- **Import:** MCP or email → `ImportBatch` with `Imported` Transactions (Suspected Duplicates flagged) → review at `/imports/[id]` → `confirmAll()` flips to `Confirmed` and, if a closing balance was supplied, creates BalanceSnapshot/Reconciliation.
- **Cloud request:** middleware verifies session → forwards Owner identity → `current-owner.ts` → repository factory → owner-scoped `Pg*Repository`.

## Test locations

Tests are colocated as `*.test.ts` next to the file under test; find coverage for `foo.ts` in `foo.test.ts`.

- **SQLite integration tests** (`src/db/repositories/*.test.ts`, most `src/app/**/actions.test.ts`) run against a temporary file DB via `repositories/test-db.ts`; no setup needed.
- **Postgres and Auth tests** need a local Supabase stack (`pnpm supabase:start`, Docker): `src/db/postgres/**/*.test.ts`, `src/lib/cloud-auth/**/*.test.ts`, `src/app/login/**/*.test.ts`, and the Postgres cases in `src/db/repository-factory.test.ts` and Server Action tests. Postgres connects to `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (`TEST_DATABASE_URL` overrides); Auth to `http://127.0.0.1:54321` (`TEST_SUPABASE_URL` / `TEST_SUPABASE_PUBLISHABLE_KEY` override).
- **Each Pg repository test** proves owner isolation: two Owners' rows, cross-owner reads return nothing, cross-owner writes do not touch the other Owner's row, compound FKs reject cross-owner references.
- **Untested by design** (thin I/O plumbing, verified by hand): `src/app/api/mcp/route.ts`, `src/email-sync/imap-client.ts`, `src/lib/supabase/server.ts`. Their logic lives in tested seams (`tools.ts`, `loopback-guard.ts`, `cloud-auth.ts`, `imap-candidate-search.ts`, `session-gate.ts`, `request-identity.ts`).
- **Script tests:** `scripts/*.test.ts`, `electron/app-paths.test.ts`.
