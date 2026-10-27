# Money-Watch — Staged Copy Plan (from Paisa-Watch-1)

Source: `../Paisa-Watch-1` (production-ready). Destination: this repo (started empty).
Method: copy in dependency order, review every file, fix edge cases in this repo only, track in `COPY_TRACKER.md`.
Rule: never edit the source. No commits without an explicit ask. Secrets (`.env.local`) are never copied.

## Goal

Copy production code from `Paisa-Watch-1` into `Money-Watch` in review-gated stages, fixing edge cases found
during review, with a durable tracker of what is copied vs. pending.

## Success Criteria

- `Money-Watch` contains the full production surface of `Paisa-Watch-1` (`src` ~463 files, `electron`,
  `scripts`, `drizzle`, `supabase`, `public`, `packages`, root configs, `docs`), minus deliberately excluded
  build artifacts (`node_modules`, `.next`, `dist`, `*.db`, `.tmp*`).
- `Money-Watch/COPY_TRACKER.md` records every stage as done/pending plus every review fix applied.
- Each stage ends green on that stage's scope: `typecheck`, `lint`, and `vitest run` for touched areas.
- No secrets copied (`.env.local` stays out; only `env.example` pattern is carried over).

## Approach

Copy in dependency order so each stage builds and tests on the last. Each stage: copy files verbatim → read
every copied file for review → apply edge-case fixes in the `Money-Watch` copy only → run focused checks →
update `COPY_TRACKER.md`.

## Steps

1. **Stage 0 — Scaffold + tracker.** Root configs, `.gitignore`, `COPY_TRACKER.md`, this plan. Done.
2. **Stage 1 — Pure foundation.** `src/domain/*`, `src/config/*`, `src/i18n/*`, `src/db/schema.ts`,
   `src/db/postgres/schema.ts`, pure `src/app` helpers (`format-money`, `calendar-date`, `decimal`,
   `form-limits`, `list-pagination`, etc.) with tests. Review: money/decimal rounding, date boundaries,
   currency totals, zod validation gaps.
3. **Stage 2 — Data layer.** `src/db/client.ts`, `errors.ts`, `repository-factory.ts`,
   `src/db/repositories/*`, `src/db/postgres/*`, `drizzle/` migrations + `supabase/` config.
   Review: owner-isolation filters, null/empty handling, migration ordering, connection failures.
4. **Stage 3 — Shared UI + app shell.** `layout.tsx`, `globals.css`, design tokens, `src/app/components/*`,
   `packages/ui/*`, `middleware.ts`, `src/lib/*`. Review: unvalidated props, missing empty/loading/error
   states, auth-gate bypasses.
5. **Stage 4 — Feature routes.** `accounts`, `institutions`, `transfers`, `fixed-deposits`,
   `share-trading-accounts`, `stock-*`, `imports`, `reconciliations`, `settings`, `login/auth`, `dev/seed`,
   `prototype`, each with `actions.ts`, forms, tests. Review: server-action auth checks, duplicate-submit
   guards, transfer/FX invariants, import confirm/dismiss flows.
6. **Stage 5 — Background services + APIs.** `src/email-sync/*`, `src/app/api/*` (mcp, cron, check-now),
   `src/desktop/*`, `src/demo-data/*`, `src/functional-qa/*`. Review: IMAP/LLM host allowlists, cron auth,
   loopback guards, token handling, poll start/stop races.
7. **Stage 6 — Desktop, scripts, assets, docs.** `electron/*`, `scripts/*`, `public/*`, `docs/**/*`.
   Review: packaged path resolution, release script failure modes, missing assets. Final full `typecheck` +
   full `vitest run` + `next lint`, then tracker sign-off.

## Validation Plan

- Per stage: `pnpm typecheck`, `next lint` on touched paths, `vitest run <touched files>` before marking done.
- Stage 6: full `vitest run`, `tsc --noEmit`, production `next build` smoke test.
- Tracker check each stage: every planned file marked copied with its review note.

## Risks / Open Questions

- `Paisa-Watch-1` history shows recent Turnstile/Electron churn; re-verify `package-electron.sh` and
  `electron-after-pack.cjs` on this machine in Stage 6.
- Dual SQLite/Postgres repository pairs must stay in sync; divergences go in the tracker.
- Rename: package `paisa-watch` → `money-watch`, Electron `appId` `app.paisawatch.desktop` →
  `app.moneywatch.desktop` (product name was already "Money Watch"). No behavior changes beyond edge-case fixes.
