# AGENTS.md

Drop-in operating instructions for coding agents. Read this file before every task.

**Working code only. Finish the job. Plausibility is not correctness.**


---

## 0. Non-negotiables

These rules override everything else in this file when in conflict:

1. **No flattery, no filler.** Skip openers like "Great question", "You're absolutely right", "Excellent idea", "I'd be happy to". Start with the answer or the action.
2. **Disagree when you disagree.** If the user's premise is wrong, say so before doing the work. Agreeing with false premises to be polite is the single worst failure mode in coding agents.
3. **Never fabricate.** Not file paths, not commit hashes, not API names, not test results, not library functions. If you don't know, read the file, run the command, or say "I don't know, let me check."
4. **Stop when confused.** If the task has two plausible interpretations, ask. Do not pick silently and proceed.
5. **Touch only what you must.** Every changed line must trace directly to the user's request. No drive-by refactors, reformatting, or "while I was in there" cleanups.

---

## 1. Before writing code

**Goal: understand the problem and the codebase before producing a diff.**

- State your plan in one or two sentences before editing. For anything non-trivial, produce a numbered list of steps with a verification check for each.
- Before non-trivial changes, read `docs/CODEMAP.md`. Update it in the same change when adding, removing, renaming, or moving a module, or when changing a module's responsibility, public interface, dependency direction, major data flow, or test location.
- Keep `docs/CODEMAP.md` a map: one line per module stating where it lives, what it owns, and any non-obvious constraint. Never record what changed, what it used to do, or which gap closed — that goes in the commit message, spec, or ADR.
- Update `README.md` in the same change whenever the change alters something it states: setup or run commands, env vars, deployment modes, privacy/data-handling posture, user-facing features, prerequisites, release artifacts, or known gaps. It is the project's public face — a stale README is a bug, not a chore.
- Read the files you will touch. Read the files that call the files you will touch.
- Match existing patterns in the codebase. If the project uses pattern X, use pattern X, even if you'd do it differently in a greenfield repo.
- Surface assumptions out loud: "I'm assuming you want X, Y, Z. If that's wrong, say so." Do not bury assumptions inside the implementation.

---

## 2. Writing code: simplicity first

**Goal: the minimum code that solves the stated problem.**

- No features beyond what was asked.
- Follow Test driven development approach. Use tdd skill.
- No abstractions for single-use code. No configurability, flexibility, or hooks that were not requested.
- No error handling for impossible scenarios. Handle the failures that can actually happen.
- If the solution runs 200 lines and could be 50, rewrite it before showing it.
- If you find yourself adding "for future extensibility", stop. Future extensibility is a future decision.
- Bias toward deleting code over adding code. Shipping less is almost always better.

The test: would a senior engineer reading the diff call this overcomplicated? If yes, simplify.

---
# Frontend Design

**Mobile-first** is a hard UI standard. Read `docs/agents/mobile-ux.md` before building, changing, or verifying any screen — touch-first controls, thumb reach, preserved input, and a narrow-viewport pass are the completion bar.
---

## 3. Surgical changes

**Goal: clean, reviewable diffs. Change only what the request requires.**

- Do not "improve" adjacent code, comments, formatting, or imports that are not part of the task.
- Do not refactor code that works just because you are in the file.
- Do not delete pre-existing dead code unless asked. If you notice it, mention it in the summary.
- Do clean up orphans created by your own changes (unused imports, variables, functions your edit made obsolete).
- Match the project's existing style exactly: indentation, quotes, naming, file layout.

If a line doesn't trace to the request, revert it.

---

## 4. Goal-driven execution

**Goal: define success as something you can verify, then loop until verified.**

Rewrite vague asks into verifiable goals before starting:

- "Add validation" becomes "Write tests for invalid inputs (empty, malformed, oversized), then make them pass."
- "Fix the bug" becomes "Write a failing test that reproduces the reported symptom, then make it pass."
- "Refactor X" becomes "Ensure the existing test suite passes before and after, and no public API changes."
- "Make it faster" becomes "Benchmark the current hot path, identify the bottleneck with profiling, change it, show the benchmark is faster."

For every task:

1. State the success criteria before writing code.
2. Write the verification (test, script, benchmark, screenshot diff) where practical.
3. Run the verification. Read the output. Do not claim success without checking.
4. If the verification fails, fix the cause, not the test.

---

## 5. Tool use and verification

- Prefer running the code to guessing about the code. If a test suite exists, run it. If a linter exists, run it. If a type checker exists, run it.
- When debugging, address root causes, not symptoms. Suppressing the error is not fixing the error.
- For UI changes, verify **mobile-first** (`docs/agents/mobile-ux.md`): screenshot the primary workflow at a narrow viewport before and after; describe the diff.
- For manual UI/QA or UI test-case writing, also run a **product coherence** pass (`docs/agents/product-qa.md`): competing affordances and lifecycle gates are bugs even when the ADR documents the underlying purpose enum.
- When reading logs, errors, or stack traces, read the whole thing. Half-read traces produce wrong fixes.

---

## 6. Session hygiene

- Context is the constraint. Long sessions with accumulated failed attempts perform worse than fresh sessions with a better prompt.
- After two failed corrections on the same issue, stop. Summarize what you learned and ask the user to reset the session with a sharper prompt.
- Use subagents (Claude Code: "use subagents to investigate X") for exploration tasks that would otherwise pollute the main context with dozens of file reads.

---

## 8. When to ask, when to proceed

**Ask before proceeding when:**
- The request has two plausible interpretations or two viable implementation approaches, and the choice materially affects the output — present the tradeoffs rather than picking one silently.
- The change touches something you've been told is load-bearing, versioned, or has a migration path.
- You need a credential, a secret, or a production resource you don't have access to.
- The user's stated goal and the literal request appear to conflict.

**Proceed without asking when:**
- The task is trivial and reversible (typo, rename a local variable, add a log line).
- The ambiguity can be resolved by reading the code or running a command.
- The user has already answered the question once in this session.

---

## 9. Self-improvement loop

**This file is living. Keep it short by keeping it honest.**

After every session where the agent did something wrong:

1. Ask: was the mistake because this file lacks a rule, or because the agent ignored a rule?
2. If lacking: add the rule under "Project Learnings" below, written as concretely as possible ("Always use X for Y" not "be careful with Y").
3. If ignored: the rule may be too long, too vague, or buried. Tighten it or move it up.
4. Every few weeks, prune. For each line, ask: "Would removing this cause the agent to make a mistake?" If no, delete. Bloated AGENTS.md files get ignored wholesale.

Boris Cherny (creator of Claude Code) keeps his team's file around 100 lines. Under 300 is a good ceiling. Over 500 and you are fighting your own config.

---

## 10. Project context

**Fill this in per project. Keep it specific. Delete sections that don't apply.**

### Stack
- Language and version: TypeScript, Node.js 22 LTS
- Framework(s): Next.js 15 (App Router) — UI + Server Actions; Electron wraps that same Next.js app for desktop shipping
- Package manager: pnpm
- Runtime / deployment target: local browser (`next dev` / `next start`) or desktop (`electron:dev` / `electron:start`) against a local SQLite file; designed to also run self-hosted (Docker, user's own server/NAS) and, later, as a hosted multi-tenant service — same codebase, DB layer swapped/extended, not rewritten. See "Design principle" below.
- Desktop shell: Electron hosts a `BrowserWindow` only; Next.js and `better-sqlite3` run in a Node child process (do not load native SQLite modules inside the Electron process). Entry: `electron/main.cjs`. Unpackaged scripts unset `ELECTRON_RUN_AS_NODE` on the parent (Cursor and similar hosts often set it and break Electron APIs). Packaged builds spawn Next/prepare with `ELECTRON_RUN_AS_NODE=1` on `process.execPath` (`better-sqlite3` ≥13 platform prebuilds).

### Database
- SQLite via `better-sqlite3`, schema and queries through Drizzle ORM.
- DB file location is set by the `DATABASE_PATH` env var, never hardcoded — this is what lets a user point it at a Dropbox/iCloud-synced folder for the local/self-hosted tier. The Electron shell defaults `DATABASE_PATH` to `paisa-watch.db` under appData/`Paisa-Watch` when unset, and runs migrations via `scripts/prepare-database.ts` before starting Next.
- Drizzle is used (not a SQLite-only driver) specifically because it also targets Postgres with the same schema/query model — the path to a hosted multi-tenant backend is a driver swap, not a rewrite.

### Commands
- Install: `pnpm install`
- Build: `pnpm build`
- Test (all): `pnpm test`
- Test (single file): `pnpm test <path>`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Run locally (browser): `pnpm dev`
- Run locally (desktop): `pnpm electron:dev`
- Run desktop against a production Next build: `pnpm electron:start`

Prefer single-file or single-test runs during iteration. Full suites are for the final verification pass.

### Layout
- Source lives in: `src/app` (Next.js routes/UI), `src/domain` (pure domain logic — reconciliation, FX, discrepancy resolution), `src/db` (Drizzle schema + repositories), `src/desktop` (Electron bootstrap helpers: DB path, app URL, migrate-on-start), `electron/main.cjs` (desktop shell)
- Tests live in: colocated `*.test.ts` next to the file under test
- Do not modify: `drizzle/` (generated migrations — edit `src/db/schema.ts` and regenerate, don't hand-edit migration files)

### Conventions specific to this repo
- Naming: domain entity names match `CONTEXT.md` exactly (Account, Transaction, Transfer, FixedDeposit, Reconciliation, Discrepancy, Adjustment, BalanceSnapshot, Institution) — do not introduce synonyms the CONTEXT.md "Avoid" lists rule out.
- Import style: ES modules, TS path aliases (`@/domain/...`, `@/db/...`) over relative `../../..` chains.
- Error handling pattern: domain/db code throws typed errors; API route handlers are the boundary that catches and maps them to responses.
- Testing pattern and framework: Vitest; integration-style tests against a real temp-file SQLite DB rather than mocking the DB layer (SQLite is fast enough that mocking isn't worth the divergence risk).
- Data access: routes and domain logic go through the repository layer (`src/db/repositories/*`), never call Drizzle directly from a route handler — this is the seam for the future hosted/multi-tenant backend.
- Money: all amounts stored and computed as integer minor units (paise/cents), never floats — required for correct multi-currency reconciliation.

### Design principle: local-first, hosted-ready
Build only the local/self-hosted version now. Do not add auth, multi-tenancy, or a sync protocol speculatively. The only concessions made today for the future hosted tier are: (1) DB access goes through Drizzle, not a SQLite-only API, (2) DB access goes through a repository layer, not inline queries, (3) the DB file path is configurable, not hardcoded. Anything beyond these three is a future decision, per §2. `docs/adr/0008-mcp-endpoint-adds-scoped-oauth-for-remote-clients.md` proposes one narrow future exception for the public MCP endpoint — not yet built, revisit when that work starts.

### Forbidden
- Floats for money — always integer minor units.
- Direct Drizzle/SQL calls from route handlers or UI code — go through `src/db/repositories`.
- Hardcoding the DB file path — always read `DATABASE_PATH`.
- Building auth, tenancy, or cloud-sync code now — out of scope until the hosted phase actually starts. `docs/adr/0008-mcp-endpoint-adds-scoped-oauth-for-remote-clients.md` proposes a single-purpose future exception scoped to the public MCP endpoint only.

---

## 11. Project Learnings

**Accumulated corrections. This section is for the agent to maintain, not just the human.**

When the user corrects your approach, append a one-line rule here before ending the session. Write it concretely ("Always use X for Y"), never abstractly ("be careful with Y"). If an existing line already covers the correction, tighten it instead of adding a new one. Remove lines when the underlying issue goes away (model upgrades, refactors, process changes).

- For links styled as buttons, verify hover foreground and background together; the global `a:hover` rule can override the default label color and make it match the button background.
- For UI QA / test cases: Spec PASS is not enough — also fail **competing affordances** (same job offered on a generic form and a dedicated CTA) and **lifecycle gates** exposed as peer dropdown options; see `docs/agents/product-qa.md`.
- Validation errors must preserve submitted form field values (React 19 form reset); use `withPersistedFormState` from `src/app/form-persistence.ts`.
- For financial QA fixes, derive expected behavior from the feature spec and run matching SQLite and Postgres regressions; history replay changes must cover equal timestamps and concurrent submissions.
- Always use `<DecimalInput>` (or `sanitizeDecimalInput`) for money/rate fields so letters cannot be typed; plain `inputMode="decimal"` alone is not enough.
- When mirroring an existing screen's list/ledger markup for a new screen, read the full render (the actual `<li>`/item structure), not just the top of the file, and `grep` `src/app/globals.css` for every class you're about to reuse. `.pw-list > li > a, .pw-list > li > span` only applies its flex layout to a direct `<a>`/`<span>` child of `<li>` — content placed straight inside `<li>`, or under an invented class that isn't in globals.css, silently renders unstyled. This is invisible to typecheck, tests, and a text-grep of rendered HTML; a screenshot (or reading the CSS rule itself) is the only thing that catches it.

---

## Agent skills

_Merged in from this repo's `setup-matt-pocock-skills` configuration — read by the Matt Pocock engineering skills (`to-tickets`, `to-spec`, `domain-modeling`, `code-review`, etc.)._

### Issue tracker

Issues live in GitHub Issues (uses the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
