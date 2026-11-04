# Money Watch

**Know exactly where your money is — to the paise.**

Money Watch is a local-first personal finance tracker. Record bank accounts, transactions, transfers, fixed deposits, and share trades. Reconcile every account against its real statement balance. Import from bank alerts automatically. Your data lives in a SQLite file you control — no bank logins, no cloud required.

> **Coolest trick:** upload a bank statement (CSV/PDF) to your favourite AI assistant — Claude, Cursor, or any MCP-compatible client — and it sets up the missing institution and account (with your confirmation) and files every transaction as a reviewable draft. Zero data entry. See [MCP: let your AI assistant do the data entry](#mcp-let-your-ai-assistant-do-the-data-entry).

## What it does

- **Accounts & institutions** — group bank accounts under institutions, with per-currency balances.
- **Transfers** — atomic two-leg transfers with realized FX rates, including fixed-deposit open/top-up/withdrawal flows.
- **Reconciliation** — snapshot an account, diff against the statement, resolve every discrepancy with an adjustment. Nothing silently drifts.
- **Fixed deposits** — lifecycle-tracked principal with opening debits and full transfer history.
- **Share trading** — holdings and trade ledgers per trading account, plus CSV-style stock import batches.
- **Imports** — paste statements through the MCP endpoint, or let bank email alerts flow in automatically with suspected-duplicate gating.
- **Three locales** — English, Simplified Chinese, Arabic (RTL).

## 60-second start (local, SQLite)

Prerequisites: **Node.js 22 LTS** and **pnpm**.

```bash
pnpm install
DEPLOYMENT_MODE=local pnpm exec next dev
```

Open [http://localhost:3000](http://localhost:3000). The `./paisa-watch.db` file is created and migrated automatically on first run. That's it — no accounts, no keys, no Docker.

## Run it your way

Three setups, same codebase. Pick one.

### A. Local — this machine, SQLite (simplest)

```bash
pnpm install
DEPLOYMENT_MODE=local pnpm exec next dev
```

Data lives in `./paisa-watch.db` — point `DATABASE_PATH` at a Dropbox/iCloud-synced folder and your data follows you. No login, no keys, no Docker. Prefer a native window? `pnpm electron:dev` runs the same app as a desktop app (DB migrates on start); `pnpm electron:start` runs it against a production build.

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
4. The daily email-sync cron (`/api/cron/email-sync`) registers itself from `vercel.json` — just add `CRON_SECRET` (≥32 chars) to Vercel env first. Details: `docs/cron-setup.md`.
5. Skip Supabase Auth? Set `AUTH_PROVIDER=simple` + `AUTH_USERS=email:password,…` — static logins, no external provider, no password reset (see `docs/adr/0015-*`).

For local Postgres dev: `pnpm supabase:start` spins up a local Supabase stack and applies migrations.

## Automation: imports without typing

Two ways to get transactions in without manual entry. Both produce **drafts** — nothing enters your ledger until you review and confirm it. Suspected duplicates are flagged, and confirmation is blocked until you resolve them.

### MCP: let your AI assistant do the data entry

Just upload your bank statement to Claude, Cursor, or any MCP-compatible client — no forms to fill. The assistant reads the statement, creates the institution and account when they don't exist yet (only with your explicit confirmation), and files every transaction as a draft import for you to review and confirm. Nothing enters your ledger until you say so.

Money Watch exposes an MCP server at `/api/mcp` with tools to stage statement imports (`stage_import`, `commit_import`), manage accounts, and search recorded transactions (`search_transactions`).

- **Local / desktop / self-hosted:** loopback is the trust boundary — no token needed. Get the exact URL and a ready-to-paste `mcp.json` from **Settings → Connect AI Assistant** in the running app.
- **Cloud-hosted:** generate an MCP access token on that same settings page (shown once, stored as a hash) and send it as `Authorization: Bearer <token>`.

Full client steps for Claude Desktop, Claude Code, and Cursor: [docs/mcp-setup.md](docs/mcp-setup.md).

### Email Alert Sync: bank alerts become draft transactions

Connect the inbox that receives your bank's debit/credit alerts. A poller classifies each email, structures it with your configured LLM, matches it to an account by bank name + last digits, and files anything unclear in an Unresolved queue for you to fix — never guessed.

- **Local:** use a local Ollama model and your alert text never leaves your machine. Run the poller alongside the app with `pnpm email-sync:poll`.
- **Cloud:** configure an OpenAI-compatible LLM + IMAP in **Settings → Email Alert Sync** (IMAP passwords are AES-256 encrypted with `EMAIL_SYNC_ENCRYPTION_KEY`), and add `CRON_SECRET` so the daily Vercel Cron in `vercel.json` can run the poll.

Details: [docs/cron-setup.md](docs/cron-setup.md) · behavior spec: [docs/specs/email-alert-sync.md](docs/specs/email-alert-sync.md).

## Languages

English, Simplified Chinese, and Arabic (RTL) — switch anytime from the header language icon or **Settings → Language**. The choice is stored in the `pw-locale` cookie.

Adding or fixing translations: copy lives in `src/i18n/messages/{en,zh,ar}.ts`. English is the source catalog — `zh.ts`/`ar.ts` are typed against its keys, so add the key to `en.ts` first (a missing translation is a compile error, which is the point), then mirror it in the other two.

## Environment

All config lives in `.env.local` (never committed — see `env.example`). The ones you'll actually touch:

| Variable | When | Default |
|---|---|---|
| `DEPLOYMENT_MODE` | Always | `local` = SQLite, `cloud` = Postgres |
| `DATABASE_PATH` | Local, to move the DB (e.g. a synced folder) | `./paisa-watch.db` |
| `POSTGRES_URL` | Cloud | Local Supabase URL |
| `AUTH_PROVIDER` | Cloud without Supabase | `supabase`; set `simple` for static `AUTH_USERS` |
| `AUTH_USERS` | `AUTH_PROVIDER=simple` | — (comma-separated `email:password`) |
| `EMAIL_SYNC_ENCRYPTION_KEY` | Email Alert Sync in cloud | — (generate: `openssl rand -base64 32`) |
| `CRON_SECRET` | Cloud cron email sync | — (min 32 chars) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloud login captcha | — (email login hidden without it) |

## Develop

```bash
pnpm test              # full suite (Vitest, real temp-file SQLite — no mocks)
pnpm test <path>       # one file while iterating
pnpm typecheck         # tsc --noEmit
pnpm lint              # next lint
```

Contributions welcome — bug reports and small, focused PRs beat big ones. Before opening one: read [AGENTS.md](AGENTS.md) (workflow rules), check [docs/CODEMAP.md](docs/CODEMAP.md) for where your change belongs, keep money in integer minor units, and make sure `pnpm test`, `pnpm typecheck`, and `pnpm lint` are all green.

Three rules that will save you review rounds:

1. **Money is integer minor units** (paise/cents) — never floats.
2. **Routes talk to repositories** (`src/db/repositories/*`), never to Drizzle directly.
3. **Never hardcode the DB path** — always read `DATABASE_PATH`.

## Where things live

- `src/app` — Next.js routes, Server Actions, UI components.
- `src/domain` — pure logic (balances, FX, reconciliation); no DB, no framework.
- `src/db` — Drizzle schema + SQLite repositories; `src/db/postgres` mirrors them for cloud.
- `src/email-sync`, `src/i18n`, `src/desktop`, `electron/` — alert ingestion, locales, Electron helpers, desktop shell.
- `docs/specs/` — feature behavior per area; `docs/adr/` — why it's built this way; `docs/CODEMAP.md` — the full module map. Start there before non-trivial changes.

## Deploy & tiers

Local, desktop, self-hosted, cloud — one codebase, with the database behind a repository seam: SQLite (`better-sqlite3`) below, Postgres above. The only cloud concessions are Drizzle, the repository layer, and a configurable DB path. No auth, tenancy, or sync-protocol code exists outside what the cloud tier needs.

## License

PolyForm-Noncommercial-1.0.0 (see the `license` field in `package.json`). Note: the repo doesn't currently ship a `LICENSE` file — one should be added to make the terms explicit.
