<div align="center">

<img src="public/brand/logo-lockup.svg" alt="Money Watch" width="320" />

# Money Watch

**Know exactly where your money is — to the paise.**

Money Watch is a personal system of record for money held across multiple institutions and currencies — built to _verify_ balances, not just display them.

[Try the live demo](https://money-watch-me.vercel.app/) · [Run it locally](#a-local--this-machine-sqlite-simplest) · [Self-host it](#b-self-hosted--your-server-or-nas-sqlite) · [Cloud mode](#c-cloud-hosted--vercel--supabase-postgres-multi-user) · [Architecture](#architecture) · [FAQ](#faq)

</div>

---

## Why this exists

Every budgeting app starts from the same assumption: **the number your bank shows you is the truth.** It downloads that number, categorises it, draws a pie chart, and calls the job done.

If you hold money at several institutions, in several currencies, that assumption quietly fails. A wire arrives with a different FX rate than quoted. A fee lands that nobody told you about. A fixed deposit matures into the wrong account. The bank's number is still "correct" — it just no longer matches what _should_ be there, and nothing in your tooling is designed to notice.

**Money Watch is built the other way around.** You keep your own ledger. Periodically you capture what the bank _claims_ your balance is, and the app formally compares it against what your ledger computes. The difference is a first-class record — a `Discrepancy` — that you must explicitly resolve as _corrected-my-record_ or _disputed-with-bank_, or leave open. Corrections are never silent edits to history; they are `Adjustment` records, visibly distinct from real bank activity.

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
| **Institutions & Accounts** | Group accounts under institutions, each account denominated in a single currency (INR, USD, SGD, AED — anything). |
| **Transactions** | A full ledger per account. Every transaction carries a trust status — `Confirmed` (you entered or reviewed it) or `Imported` (came from an automated feed, not yet reviewed). |
| **Transfers** | A transfer between two accounts is **one entity with two legs**, not two disconnected transactions. Cross-currency transfers carry the **FX rate actually realised** — not an assumed market rate — so a bad rate is itself a signal. ([ADR-0001](docs/adr/0001-transfer-as-single-entity-with-realized-fx-rate.md)) |
| **Fixed Deposits** | Term deposits with lifecycle-tracked principal, including fixed-deposit open/top-up/withdrawal flows. |
| **Reconciliation** | Capture a `BalanceSnapshot` (what the bank says) and run a `Reconciliation` against the computed ledger balance. Any mismatch becomes a `Discrepancy` that must be resolved explicitly — as an `Adjustment`, as a dispute, or left open. |
| **Share trading** | Holdings and trade ledgers per trading account, plus stock import batches. |
| **Imports** | Stage statements through the MCP endpoint, or let bank email alerts flow in automatically. Both produce **drafts** — nothing enters your ledger until you review and confirm it. Suspected duplicates are flagged, and confirmation is blocked until you resolve them. |
| **Multi-currency by construction** | Every amount is stored and computed as **integer minor units** (paise/cents). No floats touch money anywhere in the codebase. |
| **Three locales** | English, Simplified Chinese (中文) and Arabic (العربية, right-to-left). |

---

## Run it your way

Three setups, same codebase. Pick one.

### A. Local — this machine, SQLite (simplest)

**Prerequisites:** [Node.js 22 LTS](https://nodejs.org) and [pnpm](https://pnpm.io/installation).

```bash
pnpm install
DEPLOYMENT_MODE=local pnpm exec next dev
# → http://localhost:3000
```

That's the entire setup. **No `.env` file is required for local mode** — the `./paisa-watch.db` file is created and migrated automatically on first run. No accounts, no keys, no Docker. Point `DATABASE_PATH` at a Dropbox/iCloud/Syncthing folder and your data follows you.

Prefer a native window? **Download the installer — no build needed:** the [latest release](https://github.com/vishal3152/MoneyWatch/releases/latest) ships a macOS `.dmg`/`.zip` (Apple Silicon) and a Windows `.exe` installer (`v0.1.0` today). Or run it from source: `pnpm electron:dev` starts the desktop app, `pnpm electron:start` runs it against a production build (the database migrates on start either way). **The Electron desktop app is always local** — it forces `DEPLOYMENT_MODE=local`, has no storage-mode switch, and never loads the Supabase SDK. ([ADR-0007](docs/adr/0007-electron-desktop-is-local-only.md))

> ⚠️ **Heads-up:** the `dev` and `start` scripts in `package.json` are wired for **cloud** mode (they run the Postgres migration step and set `DEPLOYMENT_MODE=cloud`). For local SQLite mode in a browser, use `pnpm exec next dev` / `pnpm exec next start` as shown above.

**Want data to look at?** A deterministic demo fixture (10 institutions, 100 accounts across INR/USD/AED, 100 fixed deposits, 600 transactions, 600 transfers) ships in the repo:

```bash
DEPLOYMENT_MODE=local pnpm exec next dev   # start the app
# open http://localhost:3000/dev/seed, then click "Load seed data"
```

The seeder refuses to run if any seed institution already exists, and is disabled in production builds. See [scripts/demo-data/README.md](scripts/demo-data/README.md).

### B. Self-hosted — your server or NAS, SQLite

You run the box; nothing leaves it. Single user, no auth provider needed.

```bash
pnpm install
pnpm build
DATABASE_PATH=/data/money-watch.db PORT=3000 DEPLOYMENT_MODE=local pnpm exec next start
```

- Put `DATABASE_PATH` on a persistent (ideally backed-up or synced) volume.
- Serve behind your reverse proxy of choice; the app itself is plain HTTP on `PORT`.
- Optional: bank-alert email sync runs as a sidecar — `pnpm email-sync:poll` (reads its settings from the app's settings file; nothing starts it automatically, so add it to systemd/supervisor if you want it always on).
- Want multiple users on your own hardware without Supabase? Run cloud mode against any Postgres with `AUTH_PROVIDER=simple` and a static `AUTH_USERS` list instead (see below).

### C. Cloud-hosted — Vercel + Supabase Postgres (multi-user)

Each person signs in and sees only their own data (owner-scoped at the app layer).

1. Create a Supabase project; grab its URL + publishable key.
2. Copy `env.example` to `.env.local` and set `DEPLOYMENT_MODE=cloud`, `POSTGRES_URL` (use the Session pooler URI, port 5432), and the Supabase keys.
3. `pnpm dev` to run it locally against cloud infra — or deploy: link the project (`pnpm exec vercel link`), set the same env vars in **Vercel → Project → Settings → Environment Variables** (`DEPLOYMENT_MODE=cloud` plus the keys above), then `vercel deploy --prod` or `pnpm release`.
4. The daily email-sync cron (`/api/cron/email-sync`) registers itself from `vercel.json` — just add `CRON_SECRET` (≥32 chars) to Vercel env first. Details: [docs/cron-setup.md](docs/cron-setup.md).
5. Skip Supabase Auth? Set `AUTH_PROVIDER=simple` + `AUTH_USERS=email:password,…` — static logins, no external provider, no password reset (see [docs/adr/0015-*](docs/adr/0015-simple-email-password-auth-as-supabase-alternative.md)).

For local Postgres dev: `pnpm supabase:start` spins up a local Supabase stack and applies migrations.

---

## Environment

All config lives in `.env.local` (never committed — see `env.example`). The ones you'll actually touch:

| Variable | When | Default |
|---|---|---|
| `DEPLOYMENT_MODE` | Always | `local` = SQLite, `cloud` = Postgres |
| `DATABASE_PATH` | Local, to move the DB (e.g. a synced folder) | `./paisa-watch.db` |
| `POSTGRES_URL` | Cloud | Local Supabase URL |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cloud with Supabase Auth | — |
| `AUTH_PROVIDER` | Cloud without Supabase | `supabase`; set `simple` for static `AUTH_USERS` |
| `AUTH_USERS` | `AUTH_PROVIDER=simple` | — (comma-separated `email:password`) |
| `EMAIL_SYNC_ENCRYPTION_KEY` | Email Alert Sync in cloud | — (generate: `openssl rand -base64 32`) |
| `CRON_SECRET` | Cloud cron email sync | — (min 32 chars) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloud login captcha | — (email login hidden without it) |

Per-Owner IMAP host/port/username/password, LLM base URL/model/API key and the poll interval are **not** environment variables — they're configured in the app's **Settings → Email Alert Sync** screen (stored in `~/.config/money-watch/settings.json` locally, or the Owner's Postgres row in cloud mode).

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

Two ways to get transactions in without manual entry. Both produce **drafts** — nothing enters your ledger until you review and confirm it. Suspected duplicates are flagged, and confirmation is blocked until you resolve them.

### MCP: let your AI assistant do the data entry

Upload a bank statement (CSV/PDF) to Claude, Cursor, or any MCP-compatible client — no forms to fill. The assistant reads the statement, sets up the missing institution and account (with your confirmation), and files every transaction as a reviewable draft. Zero data entry.

Money Watch exposes an MCP server at `/api/mcp` with tools to stage statement imports (`stage_import`, `commit_import`), manage institutions and accounts (`list_institutions`, `create_institution`, `list_accounts`, `create_account`, `resolve_account`), search recorded transactions (`search_transactions`), and the same set for share-trading accounts and stock imports.

- **Local / desktop / self-hosted:** loopback is the trust boundary — no token needed. Non-loopback requests are rejected. Get the exact URL and a ready-to-paste `mcp.json` from the **Settings → Connect AI Assistant** section in the running app.
- **Cloud-hosted:** generate an MCP access token on that same settings page (shown once, stored hashed) and send it as `Authorization: Bearer <token>`. ([ADR-0011](docs/adr/0011-mcp-cloud-auth-static-bearer-token.md))

Full client steps for Claude Desktop, Claude Code, and Cursor: [docs/mcp-setup.md](docs/mcp-setup.md). Behavior spec: [docs/specs/import.md](docs/specs/import.md).

### Email Alert Sync: bank alerts become draft transactions

Connect the inbox that receives your bank's debit/credit alerts. A poller classifies each email, structures it with your configured LLM, matches it to an account deterministically by bank name + last digits (never guessed), and files anything unclear in an Unresolved queue for you to fix.

- **Local:** use a local Ollama model and your alert text never leaves your machine. Run the poller alongside the app with `pnpm email-sync:poll`.
- **Cloud:** configure an OpenAI-compatible LLM + IMAP in **Settings → Email Alert Sync** (IMAP credentials are AES-256 encrypted with `EMAIL_SYNC_ENCRYPTION_KEY`), and add `CRON_SECRET` so the daily Vercel Cron in `vercel.json` can run the poll.

Email sync is the one place the app itself calls an LLM on your behalf — a deliberate, narrow exception documented in [ADR-0009](docs/adr/0009-email-alert-sync-calls-llm-server-side.md), because there is no human present at fetch time. It is **off by default**, and the host is configurable ([ADR-0013](docs/adr/0013-provider-agnostic-llm-config-with-cloud-only-host-safety.md)): point it at `http://localhost:11434` and no email content leaves your machine.

Details: [docs/cron-setup.md](docs/cron-setup.md) · behavior spec: [docs/specs/email-alert-sync.md](docs/specs/email-alert-sync.md).

---

## Privacy and data ownership

This project takes a specific position: **your financial ledger is yours, and the default posture is that nothing leaves your machine.**

### In local / self-hosted mode

- **Your data is a single SQLite file.** You choose where it lives (`DATABASE_PATH`, or the in-app Settings screen). Point it at a Dropbox/iCloud/Syncthing folder and you get sync and versioned backups for free. Back it up by copying one file.
- **No account, no login, no server.** There is no sign-up flow to opt out of, because there is nothing to sign up to.
- **No telemetry, no analytics, no crash reporting, no phone-home.** The app makes no outbound network requests at all unless _you_ configure email alert sync.
- **No bank credentials, ever.** Money Watch never asks for online-banking logins and has no screen-scraping or aggregator integration. It reads statements you already have and alert emails your bank already sent you.
- **The MCP import endpoint is loopback-only.** Non-loopback requests are rejected — on the local tier, "same machine" _is_ the trust boundary.
- **Statement files never touch the app.** With MCP import, your AI assistant reads the PDF/CSV itself and sends the app structured rows. Money Watch never receives the file.

### In cloud mode

- **One dataset, one Owner, no sharing.** There is no household/shared-access feature; Owners are isolated from each other by design.
- **Every query filters by `owner_id` in the repository layer**, and every repository method has a dedicated cross-owner isolation test — each one was verified by deliberately breaking the filter and watching the test go red before being trusted. Row-Level Security policies remain defined in the migrations but are deliberately dormant; the honest reasoning (and its cost trade-off, ~250ms × 6 round trips per call) is written up in [ADR-0006](docs/adr/0006-drop-rls-for-app-layer-owner-filtering.md), which supersedes [ADR-0005](docs/adr/0005-cloud-tier-owner-isolation-via-rls.md).
- **IMAP credentials are encrypted at rest** with AES-256-GCM, keyed by `EMAIL_SYNC_ENCRYPTION_KEY` — an env var that deliberately lives _outside_ the database it protects. ([ADR-0012](docs/adr/0012-imap-credentials-encrypted-at-rest-with-app-layer-key.md))
- **SSRF guards on user-supplied hosts.** IMAP hostnames are blocked from resolving to localhost/private/link-local/metadata addresses on _both_ tiers; the LLM base URL gets the same guard in cloud mode only — precisely so a local install can point at `http://localhost:11434` for Ollama. ([ADR-0013](docs/adr/0013-provider-agnostic-llm-config-with-cloud-only-host-safety.md))
- **Cloud credentials never get baked into the desktop build.** The Electron packaging script stashes every `.env*` file out of the tree before building and asserts none made it into the packaged app.

### The AI boundary, stated plainly

| Feature | Who calls an LLM | What it sees |
| --- | --- | --- |
| MCP statement import | **Your** assistant, with **your** subscription | The statement file you gave it. The app never receives the file — only structured rows. |
| Email alert sync | **The app itself**, server-side | The text of bank alert emails it fetched, sent to the host **you** configured. |

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
│  └─ login/         Cloud-only auth screens (absent in local mode)
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

### The three seams that made cloud mode a driver swap, not a rewrite

This project was built local-first, but three decisions were made *ahead of need* — and only three:

1. **Drizzle ORM, not a SQLite-only driver** — the same schema and query model targets Postgres.
2. **A repository layer** (`src/db/repositories`) — route handlers and UI never touch Drizzle or SQL directly, so there's exactly one place to swap implementations.
3. **A configurable DB path** — never hardcoded.

Everything else (auth, tenancy, sync) was deliberately *not* built until the cloud tier actually started. When it did, adding it meant a second set of repository implementations behind the same ports — **not a single new screen and not one rewritten Server Action.**

```
        Server Components / Server Actions      ← identical in both modes
                       │
              repository-factory.ts             ← the only mode-aware seam
                 ┌─────┴─────┐
      SQLite repositories   Postgres repositories
             │                      │
      better-sqlite3          Supabase Postgres
      (DATABASE_PATH)         (owner-scoped queries)
```

### Engineering conventions worth knowing

- **Money is integer minor units, always.** Floats for money are forbidden repo-wide — a hard requirement for correct multi-currency reconciliation.
- **Server Actions, not a REST API.** ([ADR-0002](docs/adr/0002-server-actions-not-rest-api.md))
- **Typed domain errors thrown by domain/db code; route handlers and actions are the boundary that maps them to user-visible messages** (see `src/app/domain-error-text.ts`).
- **UI copy lives in `src/i18n/messages/`, never inline in a component.** Server Actions return message *keys*, so validation logic stays language-agnostic and its tests assert stable keys rather than English prose.
- **CSS uses logical properties** (`margin-inline-start`, `text-align: start`) so Arabic mirrors from the stylesheet rather than from a second set of rules.
- **Tests are colocated `*.test.ts`**, and database tests run against a *real* temp-file SQLite database (and a real local Postgres for the cloud tier) rather than mocks — SQLite is fast enough that mocking isn't worth the divergence risk.
- **Mobile-first UI.** Server Components + Server Actions, no client-side state library. Touch-first controls and a narrow-viewport pass are the completion bar (see `docs/agents/mobile-ux.md`).
- **Every architectural decision has an ADR**, including the reversed ones. [ADR-0006](docs/adr/0006-drop-rls-for-app-layer-owner-filtering.md) supersedes [ADR-0005](docs/adr/0005-cloud-tier-owner-isolation-via-rls.md) and says so in the first paragraph.

### Documentation map

| Document | What's in it |
| --- | --- |
| [docs/CODEMAP.md](docs/CODEMAP.md) | Module-by-module map: boundaries, data flows, current status, known gaps |
| [docs/specs/](docs/specs) | Per-feature behavioural specs (accounts, transactions, transfers, fixed deposits, reconciliation, import, email sync, share trading, UI) |
| [docs/adr/](docs/adr) | 16 architecture decision records, including superseded ones |
| [docs/mcp-setup.md](docs/mcp-setup.md) · [docs/cron-setup.md](docs/cron-setup.md) | Operational setup guides |
| [AGENTS.md](AGENTS.md) | Operating instructions for AI coding agents working in this repo |

---

## Develop

```bash
pnpm install                 # install dependencies
pnpm exec next dev           # local SQLite mode in a browser
pnpm electron:dev            # desktop shell, from source
pnpm dev                     # cloud mode (needs Supabase — see Option C)

pnpm test                    # full Vitest suite (160+ colocated test files)
pnpm test src/domain/fx.test.ts   # single file — preferred while iterating
pnpm typecheck               # tsc --noEmit
pnpm lint                    # eslint via next lint
```

Database tests run against a real temp-file SQLite database. **Postgres and Auth tests need a local Supabase stack** (`pnpm supabase:start`, requires Docker) — everything else runs with no services at all.

**Schema changes:** edit `src/db/schema.ts` and regenerate with Drizzle Kit — never hand-edit files in `drizzle/`. Cloud-tier changes go in `postgres/migrations/` as ordered SQL and are applied automatically on the next boot.

---

## Build & release

```bash
pnpm build                   # production Next.js build
pnpm electron:start          # build, then run the desktop app against the production build
pnpm electron:package        # desktop installers into dist/electron/
pnpm release                 # tests → typecheck → package → GitHub Release → Vercel deploy
```

`pnpm release` accepts `--skip-tests`, `--skip-typecheck`, `--skip-electron`, `--skip-github`, `--skip-vercel`.

The Electron packaging builds whichever platforms the host can produce: macOS `.dmg` + `.zip` on a Mac; a Windows `.exe` installer (NSIS) and a Linux `.AppImage` on Linux. Pass target platforms explicitly (`pnpm exec bash scripts/package-electron.sh mac linux win`) to override the default. All desktop builds are currently **unsigned** — on macOS, right-click the app → **Open** → **Open** on first launch (or build it yourself with `pnpm electron:package` to produce the identical artifact).

The packaging script takes desktop privacy seriously: it moves every `.env*` file out of the project root before building and **asserts none made it into the packaged tree**, so cloud credentials can't be accidentally inlined into a desktop binary via `NEXT_PUBLIC_*`.

The daily email-sync cron registers itself from `vercel.json` — just add `CRON_SECRET` to Vercel env first. Details: [docs/cron-setup.md](docs/cron-setup.md).

---

## Project status and known gaps

An actively developed personal project, published in the open. Stated honestly:

**Working today:** the full local tier (ledger, transfers, fixed deposits, reconciliation/discrepancy/adjustment, share trading, MCP import, email sync), the Electron desktop app, and the cloud tier — every screen and Server Action runs against Postgres, with Supabase Auth (or static `simple` logins), sign-in/sign-up/Google OAuth, and MCP token auth.

**Known gaps, deliberately:**

- **No local ↔ cloud migration tool.** Moving a dataset between tiers is a future decision, not an assumed one.
- **Nothing auto-starts the local email-sync poller** — you run `pnpm email-sync:poll` yourself today.
- **The MCP endpoint has no OAuth flow**, so hosted AI clients that require dynamic client registration can't connect ([ADR-0008](docs/adr/0008-mcp-endpoint-adds-scoped-oauth-for-remote-clients.md) proposes it).
- **Some error text is English-only in every language.** Errors thrown below the UI layer reach the screen untranslated through `src/app/domain-error-text.ts`. Everything the UI and Server Actions author themselves is translated.
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

In local mode, with email sync off: **no outbound network requests at all.** No telemetry, no analytics, no crash reporting. Your ledger is a SQLite file on your disk.

In cloud mode, your data is in **your** Supabase project (or your own Postgres). Turning on email sync adds calls to the IMAP and LLM hosts *you* configure — and you can point the LLM at a local Ollama instance so nothing leaves your machine. See [Privacy and data ownership](#privacy-and-data-ownership).
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

**Local:** one SQLite file. Running from source defaults to `./paisa-watch.db`; the desktop app uses its app-data directory. Copy the file, or set `DATABASE_PATH` (or the Settings screen) to a Dropbox/iCloud/Syncthing folder and get sync plus versioned backups for free. **Cloud:** it's your Supabase project (or Postgres) — use its backups. Also back up `EMAIL_SYNC_ENCRYPTION_KEY` separately; losing it makes saved IMAP credentials unrecoverable.
</details>

<details>
<summary><b>Can I move my data from local to cloud (or back)?</b></summary><br>

Not with a built-in tool yet — it's an explicit known gap. Both tiers use the same Drizzle schema shape, so a migration script is tractable; it just hasn't been written, and writing it speculatively would violate the project's own rule about not building ahead of need.
</details>

<details>
<summary><b>Can my spouse and I share one dataset?</b></summary><br>

No. Every dataset belongs to exactly one Owner, in both tiers — no household mode, no shared access, no per-record permissions. Cloud mode is multi-*Owner* (many isolated people on one deployment), never multi-*user-per-dataset*.
</details>

<details>
<summary><b>Why integer minor units instead of decimals?</b></summary><br>

Because floating-point arithmetic silently loses cents, and this app's entire purpose is detecting sub-unit mismatches between two independently computed balances. A reconciliation engine built on floats would generate phantom discrepancies and mask real ones. Every amount in the codebase is an integer of paise/cents; floats for money are forbidden.
</details>

<details>
<summary><b>Does the AI see my bank statements?</b></summary><br>

With MCP import, **your** assistant reads the file and sends the app structured rows — Money Watch itself never receives the document. With email sync, the app does send bank-alert email text to the LLM host you configured, which is the one deliberate exception ([ADR-0009](docs/adr/0009-email-alert-sync-calls-llm-server-side.md)); point it at a local Ollama server if you'd rather that stayed on your machine.
</details>

<details>
<summary><b>Do I have to use the AI features at all?</b></summary><br>

No. Both are entirely opt-in. Every entity the app models can be entered by hand through the UI; MCP import and email sync are conveniences layered on top, and the app works fully without ever configuring either.
</details>

<details>
<summary><b>Which currencies are supported?</b></summary><br>

Any. Each Account is denominated in a single currency, and cross-currency Transfers carry the FX rate actually realised rather than a looked-up market rate. It's been exercised mostly with INR, USD, SGD and AED.
</details>

<details>
<summary><b>Why Server Actions instead of a REST API?</b></summary><br>

Because a single-Owner app with a server-rendered UI gains nothing from an HTTP contract between its own halves, and pays for it in boilerplate and drift. The seam that actually mattered — swapping the data tier — lives at the repository layer instead, which is precisely what let cloud mode reuse every existing screen. Reasoning in [ADR-0002](docs/adr/0002-server-actions-not-rest-api.md).
</details>

---

## Contributing

Issues and pull requests are welcome. Before opening a PR:

1. Read [AGENTS.md](AGENTS.md) — it's the working agreement for this repo (surgical diffs, tests first, match existing patterns), and it applies to humans as much as to AI agents.
2. Check [docs/CODEMAP.md](docs/CODEMAP.md) for module boundaries, and update it in the same change if you move, rename, or re-scope a module.
3. Update this README in the same PR if your change touches anything it documents — commands, env vars, deployment modes, privacy posture, features, prerequisites, or known gaps.
4. Run `pnpm test`, `pnpm typecheck`, and `pnpm lint` before pushing.
5. Money stays in integer minor units; data access stays behind the repository layer; the DB path stays configurable. These three are non-negotiable.

Good first contributions: additional bank-alert email formats for the parser, a local↔cloud migration script, or publishing signed/notarised desktop builds (all builds are currently unsigned).

## License

PolyForm-Noncommercial-1.0.0 (see the `license` field in `package.json`). Note: the repo doesn't currently ship a `LICENSE` file — one should be added to make the terms explicit.

---

<div align="center">
<sub>Built with Next.js, TypeScript, Drizzle, SQLite, Supabase, and Electron.<br/>
<b>Independent verification over trust.</b></sub>
</div>
