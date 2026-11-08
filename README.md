<div align="center">

<img src="public/brand/logo-lockup.svg" alt="Money Watch" width="320" />

# Money Watch

**Know exactly where your money is — to the paise.**

[![Audited with Cloudflare security-audit-skill](https://img.shields.io/badge/security_audit-Cloudflare-F38020?style=flat&logo=cloudflare&logoColor=white)](https://github.com/cloudflare/security-audit-skill)

Money Watch is a personal system of record for money held across multiple institutions and currencies — built to _verify_ balances, not just display them.

[Live app](https://money-watch-me.vercel.app/) · [Run it locally](#a-local--this-machine-sqlite-simplest) · [Self-host it](#b-self-hosted--your-server-or-nas-sqlite) · [Cloud mode](#c-cloud-hosted--vercel--supabase-postgres-multi-user) · [Architecture](#architecture) · [FAQ](#faq)

</div>

---

## Why this exists

Money Watch focuses on checking bank-reported balances against an independently maintained ledger, rather than on budgeting or spending charts.

Across institutions and currencies, the balance you expect can differ from the bank-reported amount. A wire arrives with a different FX rate than quoted. An unexpected fee lands. A fixed deposit matures into the wrong account. An independent ledger gives you a basis for investigating the difference.

**Money Watch is built the other way around.** You keep your own ledger. Periodically you capture what the bank _claims_ your balance is, and the app formally compares it against what your ledger computes. The difference is a first-class record — a `Discrepancy` — that you must explicitly resolve as _corrected-my-record_ or _disputed-with-bank_, or leave open. Resolving a discrepancy as corrected creates an explicit `Adjustment` record, distinct from real bank activity. Ordinary manually entered transactions can still be edited or deleted.

That's the whole thesis: **independent verification over trust.**

> **Not** a budgeting app, **not** an expense tracker, and **not** a bank aggregator. There is no Plaid/Yodlee-style credential-sharing integration anywhere in this codebase, by design.

---

## Table of contents

- [Feature overview](#feature-overview)
- [Run it your way](#run-it-your-way)
- [Environment](#environment)
- [Why Supabase, and when you actually need it](#why-supabase-and-when-you-actually-need-it)
- [Automation: imports without typing](#automation-imports-without-typing)
- [Privacy and data ownership](#privacy-and-data-ownership)
- [Languages](#languages)
- [Architecture](#architecture)
- [Develop](#develop)
- [Build & release](#build--release)
- [Project status and known gaps](#project-status-and-known-gaps)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

---

## Feature overview

| Area | What it does |
| --- | --- |
| **Institutions & Accounts** | Group accounts under institutions, each account denominated in a single three-letter currency code (for example INR, USD, SGD or AED; precision rules below). |
| **Transactions** | A full ledger per account. Every transaction carries a trust status — `Confirmed` (you entered or reviewed it) or `Imported` (came from an automated feed, not yet reviewed). |
| **Transfers** | A transfer between two accounts is **one entity with two legs**, not two disconnected transactions. Cross-currency transfers carry the **FX rate actually realised** — not an assumed market rate — so a bad rate is itself a signal. ([ADR-0001](docs/adr/0001-transfer-as-single-entity-with-realized-fx-rate.md)) |
| **Fixed Deposits** | Term deposits with lifecycle-tracked principal, including fixed-deposit open/top-up/withdrawal flows. |
| **Reconciliation** | Capture a `BalanceSnapshot` (what the bank says) and run a `Reconciliation` against the computed ledger balance. Any mismatch becomes a `Discrepancy` that must be resolved explicitly — as an `Adjustment`, as a dispute, or left open. |
| **Share trading** | Net share quantities and trade ledgers per trading account, plus stock import batches. Whole shares only; no cash legs, cost basis, market valuation or trading reconciliation. |
| **Imports** | Stage statements through the MCP endpoint, or let bank email alerts flow in automatically. Committed batches save rows with **Imported** trust status: they already appear in the ledger and affect balances (or holdings for stock imports). Confirmation marks them **Confirmed**; flagged rows must first be deleted or their duplicate flags explicitly dismissed. Editing alone does not clear a flag. |
| **Multi-currency by construction** | Stored monetary amounts and ledger sums use **integer minor units** (paise/cents). Realised FX rates are derived ratios, not stored monetary amounts. |
| **Three locales** | English, Simplified Chinese (中文) and Arabic (العربية, right-to-left). |

---

## Run it your way

Three setups, same codebase. Pick one.

### A. Local — this machine, SQLite (simplest)

 Check the [releases page](https://github.com/vishal3152/MoneyWatch/releases) for available installers and their platform/architecture. Or run it from source: `pnpm electron:dev` starts the desktop app, `pnpm electron:start` runs it against a production build (the database migrates on start either way). **The Electron desktop app is always local** — it forces `DEPLOYMENT_MODE=local`, has no storage-mode switch, and never loads the Supabase SDK. ([ADR-0007](docs/adr/0007-electron-desktop-is-local-only.md))

> ⚠️ **Heads-up:** the `dev` and `start` scripts in `package.json` are wired for **cloud** mode (they run the Postgres migration step and set `DEPLOYMENT_MODE=cloud`). For local SQLite mode in a browser, set `DEPLOYMENT_MODE=local` explicitly when building and running `pnpm exec next dev` / `pnpm exec next start`. `VERCEL=1` independently selects cloud mode, so these local commands are for non-Vercel environments.

**Want data to look at?** A deterministic demo fixture (10 institutions, 100 accounts across INR/USD/AED, 100 fixed deposits, 600 transactions, 600 transfers) ships in the repo:

```bash
DEPLOYMENT_MODE=local pnpm exec next dev   # start the app
# open http://localhost:3000/dev/seed, then click "Load seed data"
```

The seeder refuses to run if any seed institution already exists, and is disabled in production builds. See [scripts/demo-data/README.md](scripts/demo-data/README.md).

### B. Self-hosted — your server or NAS, SQLite

You run the Next.js server and SQLite database on your hardware. Local mode has no application login or user isolation; anyone who can reach it can access the dataset.

```bash
pnpm install
DEPLOYMENT_MODE=local pnpm build
DATABASE_PATH=/data/money-watch.db PORT=3000 DEPLOYMENT_MODE=local pnpm exec next start
```

- Put `DATABASE_PATH` on a persistent volume and back it up (see the backup FAQ).
- Serve behind a reverse proxy with TLS and access control if it is reachable beyond your own machine; the Next.js server uses HTTP on `PORT`.
- Optional: run `DATABASE_PATH=/data/money-watch.db pnpm email-sync:poll` as a separate process under the same operating-system user. It reads saved email settings, but does not load `.env.local`; export the same `DATABASE_PATH` used by the app. Nothing starts it automatically.
- Want multiple users on your own hardware without Supabase? Run cloud mode against any Postgres with `AUTH_PROVIDER=simple` and a static `AUTH_USERS` list instead (see below).

### C. Cloud-hosted — Vercel + Supabase Postgres (multi-user)

Each person signs in and sees only their own data (owner-scoped at the app layer).

1. Install dependencies (`pnpm install`). Create a Supabase project and obtain its URL, publishable key and Postgres connection string.
2. Copy `env.example` to `.env.local` and set `DEPLOYMENT_MODE=cloud`, `POSTGRES_URL` (use the Session pooler URI, port 5432), and the Supabase keys.
3. Configure Supabase Auth for the flows you intend to use: set the app's Site URL and allow `<origin>/auth/callback` plus `<origin>/auth/callback?next=/login/reset-password` as redirect URLs; enable Google for Google sign-in. Email/password sign-in, sign-up and password recovery require `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in the app and the matching Turnstile secret in Supabase Auth captcha settings (see [redirect URL setup](https://supabase.com/docs/guides/auth/redirect-urls) and [CAPTCHA setup](https://supabase.com/docs/guides/auth/auth-captcha)).
4. Run `pnpm dev` locally against that database; it applies Postgres migrations before starting Next.js. For Vercel, link the project (`pnpm exec vercel link`), set the same cloud variables in **Project → Settings → Environment Variables**, and run `pnpm prepare:cloud-database` with `POSTGRES_URL` pointing to the deployment database before `pnpm exec vercel deploy --prod`. The Vercel build and `pnpm release` do not apply Postgres migrations themselves.
5. The daily email-sync cron (`/api/cron/email-sync`) registers itself from `vercel.json` — configure `CRON_SECRET` (≥32 chars) and `EMAIL_SYNC_ENCRYPTION_KEY`, then save each Owner's email/LLM settings to enable it. Details: [docs/cron-setup.md](docs/cron-setup.md).
6. Skip Supabase Auth? Set `AUTH_PROVIDER=simple` + `AUTH_USERS=email:password,…` — static logins, no self-service sign-up or password reset. Passwords cannot contain `,` or `:` (see [ADR-0015](docs/adr/0015-simple-email-password-auth-as-supabase-alternative.md)).

For local Postgres development, `pnpm supabase:start` starts a local Supabase stack and applies migrations; Docker is required. Set the app's Supabase URL/key to the values from that stack and `POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

---

## Environment

Configuration comes from environment variables and saved app settings. Use shell/deployment environment variables or `.env.local` for Next.js (see `env.example`); the standalone local email poller does not load `.env.local`. Common variables:

| Variable | When | Default |
|---|---|---|
| `DEPLOYMENT_MODE` | Browser deployment | Unset selects local; `cloud` or `VERCEL=1` selects Postgres. `pnpm dev`/`start` force cloud; Electron forces local. |
| `DATABASE_PATH` | Local database file | Browser: environment → Settings → `./money-watch.db`. Electron: Settings → environment → appData/`Money-Watch/money-watch.db`. |
| `POSTGRES_URL` | Cloud | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cloud with Supabase Auth | — |
| `AUTH_PROVIDER` | Cloud authentication | `supabase`; set `simple` for static `AUTH_USERS` |
| `AUTH_USERS` | `AUTH_PROVIDER=simple` | — (comma-separated `email:password`) |
| `EMAIL_SYNC_ENCRYPTION_KEY` | Email Alert Sync in cloud | — (generate: `openssl rand -base64 32`) |
| `CRON_SECRET` | Cloud cron email sync | — (min 32 chars) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloud + Supabase Auth email/password and recovery | — (those forms are hidden without it; simple auth does not use it) |

IMAP host/port/username/password, the full LLM endpoint URL/model/API key and the poll interval are configured in **Settings → Email Alert Sync**. Local settings are stored in `~/.config/money-watch/settings.json`; cloud settings belong to the signed-in Owner in Postgres. The poll interval controls the local daemon; Vercel uses the schedule in `vercel.json`.

---

## Why Supabase, and when you actually need it

Short version: **you do not need Supabase to run this app.** It is a dependency of _cloud mode only_.

Supabase does two jobs in cloud mode, and nothing anywhere else:

1. **Postgres** — the multi-Owner database, replacing the local SQLite file.
2. **Auth** — email/password and Google sign-in, which is what gives each Owner an `owner_id` for the repository layer to scope every query by.

`@supabase/supabase-js` and `@supabase/ssr` appear in `dependencies` because they ship in the same package as the cloud build, but in local mode **they are never loaded**: cloud modules sit behind dynamic `import()`s gated on `isCloudMode()`. A desktop/self-hosted process never constructs a Supabase client, never needs Auth env vars, and never pays for session plumbing it can't use. ([ADR-0007](docs/adr/0007-electron-desktop-is-local-only.md))

The `supabase` CLI in `devDependencies` exists purely so contributors can run `pnpm supabase:start` and execute the Postgres-backed test suite locally against Docker.

**Could you swap Supabase for plain Postgres?** The data layer, yes — it's Drizzle against standard Postgres, and `POSTGRES_URL` accepts any Postgres connection string. You'd need to replace Supabase Auth with something else to produce the Owner identity — or use the built-in `AUTH_PROVIDER=simple` static logins instead.

---

## Automation: imports without typing

Two ways to get transactions in without manual entry. Committed batches save rows with **Imported** trust status: they already appear in the ledger and affect balances (or holdings for stock imports). Confirmation marks them **Confirmed**; flagged rows must first be deleted or their duplicate flags explicitly dismissed. Editing alone does not clear a flag. For bank imports with a closing balance, confirmation also creates a BalanceSnapshot and Reconciliation.

### MCP: let your AI assistant do the data entry

Give a bank statement (CSV/PDF) to an assistant that can read that format and connect to this HTTP MCP endpoint. It can create missing institutions/accounts with your confirmation, preview rows with `stage_import`, then save an ImportBatch with `commit_import`. Staging writes nothing; committing saves reviewable `Imported` rows that already affect balances. Check the parsed rows before confirming them.

Money Watch exposes an MCP server at `/api/mcp` with tools to stage and commit statement imports (`stage_import`, `commit_import`), manage institutions and accounts (`list_institutions`, `create_institution`, `list_accounts`, `create_account`, `resolve_account`), and search recorded bank-account transactions (`search_transactions`). Trading tools are `list_share_trading_accounts`, `create_share_trading_account`, `resolve_share_trading_account`, `stage_stock_import` and `commit_stock_import`.

- **Local / desktop / self-hosted:** no token is needed. The endpoint checks that the `Host` header names localhost/127.0.0.1/[::1] and that any `Origin` is also loopback; it does not authenticate a remote caller. Keep it reachable only locally (use a tunnel to loopback for a remote server). Get the exact URL and a ready-to-paste `mcp.json` from **MCP** in navigation (`/settings/mcp`, also linked from Settings).
- **Cloud-hosted:** generate an MCP access token on that same MCP page (shown once, stored hashed) and send it as `Authorization: Bearer <token>`. ([ADR-0011](docs/adr/0011-mcp-cloud-auth-static-bearer-token.md))

Full client steps for Claude Desktop, Claude Code, and Cursor: [docs/mcp-setup.md](docs/mcp-setup.md). Behavior spec: [docs/specs/import.md](docs/specs/import.md).

### Email Alert Sync: bank alerts become draft transactions

Connect the inbox that receives your bank's debit/credit alerts. A poller sends candidate email sender names and subjects to your configured LLM for classification, then sends the subject/body of messages classified as transaction alerts for extraction. It matches accounts deterministically by institution name and last four digits. Alerts with invalid fields or an unresolved account go to an Unresolved queue for correction; non-transactional messages are ignored.

- **Local:** use an Ollama model running on the same machine to keep LLM processing there. Run the poller alongside the app with `pnpm email-sync:poll`, exporting the same `DATABASE_PATH` if the app uses one. IMAP still connects to your mail provider.
- **Cloud:** configure an OpenAI-compatible LLM + IMAP in **Settings → Email Alert Sync** (IMAP credentials are AES-256 encrypted with `EMAIL_SYNC_ENCRYPTION_KEY`), and add `CRON_SECRET` so Vercel Cron can invoke the poll on the daily schedule in `vercel.json` (`0 8 * * *`).

Email sync is the one place the app itself calls an LLM on your behalf — a deliberate, narrow exception documented in [ADR-0009](docs/adr/0009-email-alert-sync-calls-llm-server-side.md), because there is no human present at fetch time. It is **off by default**, and the host is configurable ([ADR-0013](docs/adr/0013-provider-agnostic-llm-config-with-cloud-only-host-safety.md)): in local mode, use a full endpoint such as `http://localhost:11434/v1/chat/completions` or `http://localhost:11434/api/chat`. The app posts to the configured URL as-is; a bare host URL is insufficient. Hosted cloud polling requires a publicly reachable LLM endpoint.

Details: [docs/cron-setup.md](docs/cron-setup.md) · behavior spec: [docs/specs/email-alert-sync.md](docs/specs/email-alert-sync.md).

---

## Privacy and data ownership

Local mode stores the ledger on the machine running the app. Cloud mode stores it in the deployment's Postgres database. Optional email sync and your chosen AI assistant introduce additional data recipients.

### In local / self-hosted mode

- **Your ledger is stored in SQLite.** Choose the file with `DATABASE_PATH` or Settings. Stop the app and poller before copying it for a consistent backup. Email credentials/settings live separately in `~/.config/money-watch/settings.json` in plaintext. Money Watch supplies no file-sync or conflict-resolution mechanism; backup/version history depends on your storage provider.
- **No application account or login.** A Next.js HTTP server still runs, including inside the desktop app. Local mode has no per-user access controls.
- **No application analytics or crash-reporting integration is configured.** Core local ledger workflows do not call a bank or LLM. This is not a network-isolation guarantee: Next.js has framework telemetry, and builds download the Google font. Use `NEXT_TELEMETRY_DISABLED=1` to disable Next.js telemetry. Email sync contacts the configured IMAP and LLM hosts; an external AI assistant has its own data handling.
- **No bank credentials, ever.** Money Watch never asks for online-banking logins and has no screen-scraping or aggregator integration. It reads statements you already have and alert emails your bank already sent you.
- **The local MCP endpoint validates loopback Host/Origin headers.** Restrict network access to it as well; those headers are not remote-client authentication.
- **Statement files never touch the app.** With MCP import, your AI assistant reads the PDF/CSV itself and sends the app structured rows. Money Watch never receives the file.

### In cloud mode

- **One dataset, one Owner, no sharing.** There is no household/shared-access feature; Owners are isolated from each other by design.
- **Financial repository operations are scoped to `owner_id`**, with cross-owner regression tests. Cron credential enumeration and bearer-token-to-Owner lookup intentionally operate across Owners. The app connects as a table-owning role that bypasses the RLS policies defined in migrations; isolation relies on the repository layer. See [ADR-0006](docs/adr/0006-drop-rls-for-app-layer-owner-filtering.md), which supersedes [ADR-0005](docs/adr/0005-cloud-tier-owner-isolation-via-rls.md).
- **Cloud IMAP usernames/passwords are encrypted on save** with AES-256-GCM, keyed by `EMAIL_SYNC_ENCRYPTION_KEY` outside the database. Legacy plaintext credentials remain readable; the LLM API key is stored without this application-layer encryption. ([ADR-0012](docs/adr/0012-imap-credentials-encrypted-at-rest-with-app-layer-key.md))
- **Host-safety checks:** IMAP hosts are checked against private/loopback address ranges on both tiers. LLM endpoints are checked in hosted cloud requests and cron; local mode and loopback-hosted Settings/Check now allow local Ollama. LLM DNS checks do not pin the subsequent HTTP connection to the resolved address. ([ADR-0013](docs/adr/0013-provider-agnostic-llm-config-with-cloud-only-host-safety.md))
- **Desktop packaging isolates the usual cloud configuration.** It temporarily removes standard Next.js dotenv files, unsets selected cloud environment variables and checks staged artifacts for dotenv files. It does not scrub arbitrary inherited environment variables.

### The AI boundary, stated plainly

| Feature | Who calls an LLM | What it sees |
| --- | --- | --- |
| MCP statement import | **Your** chosen assistant/provider | The statement file you gave it. The app never receives the file — only structured rows. |
| MCP transaction search | **Your** chosen assistant/provider | Recorded transaction details returned by `search_transactions`, scoped to the connected Owner in cloud mode. |
| Email alert sync | **The app itself**, server-side | Candidate sender names/subjects for classification, then subjects/bodies classified as transaction alerts, sent to the LLM host **you** configured. |

The LLM client logs full request and response bodies to server output, including failed HTTP responses. Those logs can contain email text and extracted financial details.

---

## Languages

English, Simplified Chinese (中文), and Arabic (العربية, right-to-left) — switch anytime from the header language icon or **Settings → Language**. The choice is stored in the `pw-locale` cookie. Amounts stay in each Account's own currency; only the surrounding copy translates.

Adding or fixing translations: copy lives in `src/i18n/messages/{en,zh,ar}.ts`. English is the source catalog — `zh.ts`/`ar.ts` are typed against its keys, so add the key to `en.ts` first (a missing translation is a compile error, which is the point), then mirror it in the other two.

---

## Architecture

### Layout

```
src/
├─ app/              Next.js App Router — routes, Server Components, Server Actions
│  ├─ api/mcp/       MCP server (statement + stock-trade import tools)
│  ├─ api/cron/      Cloud email-sync cron entry point
│  ├─ settings/      DB path, email sync config, MCP token management
│  └─ login/         Cloud auth screens (redirect home in local mode)
├─ domain/           Pure domain logic — reconciliation, FX, holdings, discrepancy resolution.
│                    No database, no framework. Fully unit-testable.
├─ db/
│  ├─ schema.ts      Drizzle schema — SQLite tier
│  ├─ repositories/ SQLite repository implementations
│  ├─ postgres/      Parallel Postgres schema + repositories for the cloud tier
│  └─ repository-factory.ts   The tier-selection seam
├─ email-sync/       IMAP fetch, classifier, LLM client, host-safety guards
├─ i18n/             en/zh/ar message catalogs + translator (cookie-selected locale)
├─ desktop/          Electron bootstrap helpers (DB path, app URL, migrate-on-start)
└─ config/           Deployment mode, DB path resolution, settings.json, env parsing

electron/main.cjs    Desktop shell — hosts a BrowserWindow only
drizzle/             Generated SQLite migrations (never hand-edited)
postgres/migrations/ Cloud-tier SQL migrations
docs/                CODEMAP, specs, ADRs, setup guides
```

### Shared financial UI, separate storage implementations

The local and cloud implementations share these foundations:

1. **Drizzle ORM** — separate SQLite and Postgres schemas use the same ORM and domain model.
2. **A repository layer** (`src/db/repositories`) — route handlers and UI never touch Drizzle or SQL directly, so there's exactly one place to swap implementations.
3. **A configurable DB path** — never hardcoded.

The financial screens and Server Actions use common repository ports. Cloud mode adds Owner identity and Postgres implementations; authentication, settings and email-sync orchestration also contain mode-specific behavior.

```
        Server Components / Server Actions      ← shared financial workflows
                       │
              repository-factory.ts             ← selects storage implementation
                 ┌─────┴─────┐
      SQLite repositories   Postgres repositories
             │                      │
      better-sqlite3          Postgres (Supabase or other host)
      (DATABASE_PATH)         (owner-scoped queries)
```

### Engineering conventions worth knowing

- **Money is integer minor units, always.** Floats for money are forbidden repo-wide — a hard requirement for correct multi-currency reconciliation.
- **Server Actions, not a REST API.** ([ADR-0002](docs/adr/0002-server-actions-not-rest-api.md))
- **Typed domain errors thrown by domain/db code; route handlers and actions are the boundary that maps them to user-visible messages** (see `src/app/domain-error-text.ts`).
- **Translatable UI copy lives in `src/i18n/messages/`.** Server Actions return localized message keys. Some inline labels and repository error details remain English-only.
- **CSS uses logical properties** (`margin-inline-start`, `text-align: start`) and explicit RTL overrides for Arabic.
- **Tests are colocated `*.test.ts`**, and database tests run against a *real* temp-file SQLite database (and a real local Postgres for the cloud tier) rather than mocks — SQLite is fast enough that mocking isn't worth the divergence risk.
- **Mobile-first UI.** Server Components + Server Actions, no client-side state library. Touch-first controls and a narrow-viewport pass are the completion bar (see `docs/agents/mobile-ux.md`).
- **Key architectural decisions have ADRs**, including superseded decisions. [ADR-0006](docs/adr/0006-drop-rls-for-app-layer-owner-filtering.md) supersedes [ADR-0005](docs/adr/0005-cloud-tier-owner-isolation-via-rls.md) and says so in the first paragraph.

### Documentation map

| Document | What's in it |
| --- | --- |
| [docs/CODEMAP.md](docs/CODEMAP.md) | Module-by-module map: boundaries, data flows, current status, known gaps |
| [docs/specs/](docs/specs) | Per-feature behavioural specs (accounts, transactions, transfers, fixed deposits, reconciliation, import, email sync, share trading, UI) |
| [docs/adr/](docs/adr) | Architecture decision records, including superseded ones |
| [docs/mcp-setup.md](docs/mcp-setup.md) · [docs/cron-setup.md](docs/cron-setup.md) | Operational setup guides |
| [AGENTS.md](AGENTS.md) | Operating instructions for AI coding agents working in this repo |

---

## Develop

```bash
pnpm install                 # install dependencies
DEPLOYMENT_MODE=local pnpm exec next dev  # local SQLite browser mode
pnpm electron:dev            # desktop shell, from source
pnpm dev                     # cloud mode (Postgres + configured auth; see Option C)

pnpm test                    # full Vitest suite (includes Postgres/Auth integration tests)
pnpm test src/domain/transfer.test.ts   # single file — preferred while iterating
pnpm typecheck               # tsc --noEmit
pnpm lint                    # eslint via next lint
```

Database tests run against a real temp-file SQLite database. **Postgres and Auth tests need a local Supabase stack** (`pnpm supabase:start`, requires Docker) — everything else runs with no services at all.

**Schema changes:** edit `src/db/schema.ts` and regenerate with Drizzle Kit — never hand-edit files in `drizzle/`. Cloud-tier changes go in `postgres/migrations/` as ordered SQL. `pnpm dev`/`pnpm start` apply them before starting; run `pnpm prepare:cloud-database` explicitly before Vercel deployment.

---

## Build & release

```bash
pnpm build                   # production Next.js build for the selected environment
pnpm electron:start          # build, then run the desktop app against the production build
pnpm electron:package        # desktop installers into dist/electron/
pnpm release                 # tests → typecheck → package → GitHub Release → Vercel deploy
```

`pnpm release` accepts `--skip-tests`, `--skip-typecheck`, `--skip-electron`, `--skip-github`, `--skip-vercel`.

Packaging defaults to macOS `.dmg`/`.zip` **and Windows NSIS `.exe`** on macOS, or Linux `.AppImage` **and Windows `.exe`** on Linux. Override targets with, for example, `pnpm exec bash scripts/package-electron.sh mac` on macOS or `pnpm exec bash scripts/package-electron.sh linux` on Linux. Cross-building Windows requires Rosetta on Apple Silicon or Wine on Linux. macOS uses ad-hoc signing when no Developer ID identity is available; signing/notarization depends on build credentials. Windows executable signing is disabled. Check each release for its signing status.

The packaging script temporarily stashes standard Next.js dotenv files, restores them on exit, unsets selected cloud variables during the build and checks staged outputs for dotenv files. Run it from a clean environment; it does not remove arbitrary shell-supplied secrets. Builds fetch the Google font and packaging dependencies.

`pnpm release` also needs authenticated GitHub CLI (`gh`) and Vercel access, plus any platform packaging prerequisites. It creates or updates the version-tagged GitHub release and deploys to production; it does not run lint or Postgres migrations.

A Vercel deployment registers the daily email-sync cron from `vercel.json`. Polling also requires `CRON_SECRET`, `EMAIL_SYNC_ENCRYPTION_KEY` and per-Owner IMAP/LLM settings. Details: [docs/cron-setup.md](docs/cron-setup.md).

---

## Project status and known gaps

An actively developed personal project, published in the open. Stated honestly:

**Implemented:** local and cloud financial workflows for ledger entries, transfers, fixed deposits, reconciliation, share trading and imports; Electron wraps local mode. Cloud uses Postgres with Supabase Auth (email/password and Google, when configured) or static `simple` logins, plus bearer-token MCP access. Local database-path settings and development seeding are local-only.

**Known gaps, deliberately:**

- **No local ↔ cloud migration tool.** Moving a dataset between tiers is a future decision, not an assumed one.
- **Nothing auto-starts the local email-sync poller** — you run `pnpm email-sync:poll` yourself today.
- **The MCP endpoint has no OAuth flow**, so hosted AI clients that require dynamic client registration can't connect ([ADR-0008](docs/adr/0008-mcp-endpoint-adds-scoped-oauth-for-remote-clients.md) proposes it).
- **Some labels and error text remain English-only.** Repository errors pass through `src/app/domain-error-text.ts` untranslated, and some components still contain inline English labels.
- **Share trading is quantity tracking only:** no fractional shares, cash legs, cost basis, market valuation or reconciliation; email sync does not import broker trade confirmations.
- **No billing, no multi-user datasets, no sharing** — out of scope by design.

[docs/CODEMAP.md](docs/CODEMAP.md) keeps a running, unflattering list of gaps as they open and close.

---

## FAQ

<details>
<summary><b>Does this connect to my bank?</b></summary><br>

No — and it will never ask for online-banking credentials. There's no Plaid/Yodlee/screen-scraping integration in the codebase. It works from artifacts you already have: statements you download (imported with AI assistance over MCP) and the alert emails your bank already sends you (IMAP sync). That's a deliberate product choice, not a missing feature.
</details>

<details>
<summary><b>Is my financial data sent anywhere?</b></summary><br>

Core local ledger workflows store your data in SQLite without a bank or LLM connection. Email sync, your external assistant, framework telemetry and build-time downloads have separate network behavior; see [Privacy and data ownership](#privacy-and-data-ownership).

In cloud mode, data is stored in the deployment's Postgres database. If you use someone else's hosted instance, that operator controls the database and server logs. Email sync sends data to its configured IMAP/LLM services; keeping LLM processing on your own machine requires a local installation and local model.
</details>

<details>
<summary><b>Do I need Supabase to use this?</b></summary><br>

No. Supabase is a **cloud-mode-only** dependency (Postgres + Auth). The desktop app and self-hosted local mode never load the Supabase SDK at all — cloud modules are dynamic-imported behind `isCloudMode()`. Local mode needs no accounts, no keys, and no `.env` file. And even in cloud mode, `AUTH_PROVIDER=simple` gets you multi-user logins with no Supabase Auth at all.
</details>

<details>
<summary><b>Which mode should I pick?</b></summary><br>

**Local/desktop** if you want your ledger on your own disk and you mostly use one machine — this is the default posture the project was built around. **Self-hosted** if you want it on your own server or NAS. **Cloud** if you want to reach the same data from a phone and a laptop without syncing a file yourself, and you're comfortable running a Supabase project (or any Postgres).
</details>

<details>
<summary><b>Can the desktop app use cloud mode?</b></summary><br>

No, by design. The Electron shell forces `DEPLOYMENT_MODE=local`, exposes no storage-mode switch, and cloud SDK modules are never loaded there. Cloud is a browser concern. The reasoning — and what reversing it would cost — is in [ADR-0007](docs/adr/0007-electron-desktop-is-local-only.md).
</details>

<details>
<summary><b>How do I back up my data? Where does it live?</b></summary><br>

**Local:** stop the app and email poller, then copy the SQLite file. Browser mode defaults to `./money-watch.db`; Electron defaults to appData/`Money-Watch/money-watch.db`, unless an environment or saved Settings path overrides it. Back up `~/.config/money-watch/settings.json` separately if you need email settings; it contains plaintext secrets. A synced folder is external storage, not a supported concurrent-write sync protocol: close all writers before syncing/copying and avoid simultaneous use on multiple machines. **Cloud:** use your Postgres provider's backups and back up `EMAIL_SYNC_ENCRYPTION_KEY` separately; losing it prevents decryption of encrypted IMAP credentials.
</details>

<details>
<summary><b>Can I move my data from local to cloud (or back)?</b></summary><br>

There is no built-in migration tool. The tiers have separate SQLite/Postgres schemas, and cloud records also need an Owner identity; copying the SQLite file into cloud mode does not migrate the data.
</details>

<details>
<summary><b>Can my spouse and I share one dataset?</b></summary><br>

There is no household or shared-access feature. Cloud mode isolates one dataset per Owner and cannot grant another login access to it. Local mode has no login or person-level isolation: anyone with access to that running instance uses the same dataset.
</details>

<details>
<summary><b>Why integer minor units instead of decimals?</b></summary><br>

Amounts such as 0.1 cannot always be represented exactly as binary floating-point fractions. Money Watch parses decimal input into safe-integer minor units and stores/sums those integers for ledger balances. Currency precision is defined in `src/domain/currency.ts`; realised FX rates are derived numeric ratios.
</details>

<details>
<summary><b>Does the AI see my bank statements?</b></summary><br>

With MCP import, your assistant reads the statement under its own privacy terms and sends Money Watch structured rows, not the original document. Email sync sends candidate sender names/subjects and classified alert bodies to the configured LLM ([ADR-0009](docs/adr/0009-email-alert-sync-calls-llm-server-side.md)). In local mode, a same-machine Ollama endpoint keeps that LLM processing local.
</details>

<details>
<summary><b>Do I have to use the AI features at all?</b></summary><br>

No. Both are opt-in. Institutions, accounts, transactions, transfers, fixed deposits, trades and reconciliations can be managed manually. Import batches are created by the import paths; you do not need them for the manual workflows.
</details>

<details>
<summary><b>Which currencies are supported?</b></summary><br>

Accounts accept three-letter currency codes. Precision currently uses zero decimal places for JPY/KRW, three for BHD/KWD/OMR, and two for every other code; there is no complete ISO currency validation/precision table. Each Account has one currency. Cross-currency Transfers derive the realised rate from the amounts you enter; there is no market-rate feed or consolidated cross-currency valuation.
</details>

<details>
<summary><b>Why Server Actions instead of a REST API?</b></summary><br>

The server-rendered financial UI uses Server Actions for mutations and repository ports for storage access. SQLite and Postgres implementations share those ports, while cloud authentication supplies the Owner identity. MCP and email-sync routes provide separate HTTP entry points. See [ADR-0002](docs/adr/0002-server-actions-not-rest-api.md).
</details>

---

## Contributing

Issues and pull requests are welcome. Before opening a PR:

1. Read [AGENTS.md](AGENTS.md) — it's the working agreement for this repo (surgical diffs, tests first, match existing patterns), and it applies to humans as much as to AI agents.
2. Check [docs/CODEMAP.md](docs/CODEMAP.md) for module boundaries, and update it in the same change if you move, rename, or re-scope a module.
3. Update this README in the same PR if your change touches anything it documents — commands, env vars, deployment modes, privacy posture, features, prerequisites, or known gaps.
4. Run `pnpm test`, `pnpm typecheck`, and `pnpm lint` before pushing.
5. Money stays in integer minor units; data access stays behind the repository layer; the DB path stays configurable. These three are non-negotiable.

Possible contributions: bank-alert parser fixtures, a local↔cloud migration tool, or improvements to release signing/notarization. Discuss scope in an issue first.

## License

[PolyForm Noncommercial 1.0.0](LICENSE). Free for personal and other noncommercial use. Commercial use — including selling the software, offering it as a paid hosted service, or using it in revenue-generating business operations — requires a separate commercial license. Contact the maintainer via a GitHub issue to arrange one.

---

<div align="center">
<sub>Built with Next.js, TypeScript, Drizzle, SQLite, Supabase, and Electron.<br/>
<b>Independent verification over trust.</b></sub>
</div>
