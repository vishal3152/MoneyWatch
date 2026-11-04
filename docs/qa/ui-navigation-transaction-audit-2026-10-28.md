# UI navigation and transaction audit — 2026-10-28

## Scope and environment

Manual browser audit of the signed-in Money Watch cloud UI at `http://localhost:3000`, using the existing Sample Bank data. This audit exercised the primary ledger and portfolio workflows and checked their resulting screens. It did not exercise destructive delete flows, live email polling, generated MCP credentials, or import confirmation because those require additional confirmation, credentials, or source batches.

## Navigation map

```text
Dashboard /
├── Accounts by currency
│   ├── Institution details → /institutions/[id]
│   │   ├── Add Account → /accounts/new
│   │   ├── Add Fixed Deposit → /fixed-deposits/new
│   │   └── Add Share Trading Account → /share-trading-accounts/new
│   ├── Account details → /accounts/[id]
│   │   ├── Edit / Delete Account
│   │   ├── Add income or expense → /accounts/[id]/transactions/new
│   │   ├── Add transfer → /transfers/new?sourceAccountId=...
│   │   └── Reconcile → /accounts/[id]/reconcile → /reconciliations/[id]
│   ├── Fixed Deposit details → /fixed-deposits/[id]
│   │   ├── Top up / Withdraw → /transfers/new with a lifecycle purpose
│   │   └── Related opening and lifecycle Transfers
│   └── Share Trading Account details → /share-trading-accounts/[id]
│       └── Add stock transaction → /share-trading-accounts/[id]/stock-transactions/new
├── Add menu
│   ├── Add Institution → /institutions/new
│   ├── Add Fixed Deposit → /fixed-deposits/new
│   └── Add Share Trading Account → /share-trading-accounts/new
├── Add Account (Accounts section) → /accounts/new
├── Add transfer → /transfers/new → /transfers/[id]
├── Imports → /imports (email and MCP batches; stock imports have their own route)
├── Settings → /settings (locale and email alert sync)
└── MCP → /settings/mcp (endpoint, token generation, client config)

Entity management routes documented in `docs/specs/ui.md` also include Institution and Account edit/delete, manual Transaction edit/delete, Transfer edit/delete, and import review/confirm/undo.
```

## Executed checks

| Step | Workflow and observed result | Verdict |
| --- | --- | --- |
| 1 | Opened Dashboard, Imports, Settings, and MCP from the app shell. All rendered. Dashboard initially showed its loading fallback, then completed after an extended wait; it was slow but did not remain stuck. | Pass |
| 2 | Added one AED income row (1,000.00) and one AED expense row (125.00) in a single submission. Both appeared in the Account ledger and Dashboard recent transactions with the correct signs. Computed AED balance increased by 875.00, from 12,248.25 to 13,123.25. | Pass |
| 3 | Submitted a blank transaction batch, then a partially filled row with amount 42.75 and no description. Empty batch was rejected; partial row showed “Description is required.” and preserved the entered amount. | Pass |
| 4 | Created a cross-currency Transfer from Everyday Account (100 AED) to Travel Account (100 USD). Detail showed both legs and realized FX rate 1. Dashboard later showed the corresponding −100 AED and +100 USD ledger rows. | Pass |
| 5 | Created an AED Fixed Deposit with 500.00 principal, 4.50% rate, and one-year term, with “Debit linked Account now” selected. Detail showed Open status, correct dates and linked Account, plus the automatic Opening deposit Transfer. | Pass |
| 6 | Reconciled Everyday Account against 12,500.00 AED. Detail compared it to 12,523.25 AED computed balance and showed the expected −23.25 AED difference. Resolved the Discrepancy as “Disputed with Institution”; the ledger was left unchanged. | Pass |
| 7 | Created a USD Share Trading Account. Bought 5 MSFT shares at 400.00 USD, then sold 2 at 410.00 USD. The detail showed both trades and net holdings of 3 shares; Dashboard showed one holding. | Pass |
| 8 | Inspected institution management, institution detail, dashboard Add menu, institution-level Add menu, Account ledger search, email-sync settings, and MCP setup. The ledger search returned the matching expense after its short update delay. | Pass / partial |
| 9 | Switched to Arabic and inspected the RTL Settings screen. Found header actions overlapping the brand; switched back to English to confirm the English header was unaffected. | Defect found and fixed |
| 10 | Submitted a two-row transaction batch with a valid-looking AED 77.00 row and an AED 15.00 row missing its description. The form showed the validation error and retained inputs; returning to the Account showed the balance unchanged at 12,523.25 AED, so the batch was atomic. | Pass |
| 11 | Tried to sell 4 MSFT shares while holding 3. The UI rejected it, but the Share Trading spec explicitly allows a negative net holding because earlier history may be incomplete. The manual create, edit, and batch paths had an extra restriction that MCP imports did not. Removed that inconsistent guard; isolated action tests now verify single, edited, and batch sells can produce a negative holding. I did not submit the successful sale through the signed-in browser UI. | Spec mismatch found and fixed; isolated persistence verified |
| 12 | The stock batch restoration test and TypeScript typecheck passed. The complete test suite passed after the fixes: 162 files and 1,252 tests. | Pass |
| 13 | Submitted an incomplete transaction batch with one otherwise valid row. Validation preserved the input and the Account balance did not change, confirming batch atomicity. | Pass |

## Thirty edge cases executed

The cases below were run through the repository's SQLite/Postgres-backed Vitest suite, which was run in full after the fixes (162 files, 1,252 tests passed). “No write” means the test checked the isolated test database. The browser audit separately exercised the visible screens and rejected-form behavior. Successful financial UI submissions after the earlier walkthrough were not repeated; the positive and state-transition cases below use isolated test databases.

| # | Edge case and expected state | Result / test coverage |
| ---: | --- | --- |
| 1 | Malformed or overflowing transaction amount is rejected with no ledger row. | Pass — `accounts/[id]/transactions/new/actions.test.ts`, malformed/overflow case |
| 2 | Negative unsigned transaction amount is rejected and points to the Type selector. | Pass — same action suite, negative amount case |
| 3 | Blank transaction description rejects the row. | Pass — same action suite, empty description case |
| 4 | Expense category supplied for Income is rejected. | Pass — same action suite, category-kind mismatch case |
| 5 | Income stores a positive minor-unit amount and its category. | Pass — same action suite, Confirmed Income case |
| 6 | Expense stores a negative minor-unit amount and its category. | Pass — same action suite, Confirmed Expense case |
| 7 | Repeated transaction submission with the same idempotency key does not duplicate the row. | Pass — same action suite, duplicate key case |
| 8 | Transfer leg with both target references set or neither set is rejected. | Pass — `transfers/new/actions.test.ts`, both-set/neither-set case |
| 9 | Transfer from an Account to itself is rejected. | Pass — same transfer action suite, same Account case |
| 10 | Fixed Deposit withdrawal to an Account other than its linked payout Account is rejected. | Pass — same transfer action suite, linked Account case |
| 11 | Account-to-Account Transfer creates both linked ledger projections. | Pass — same transfer action suite, paired ledger case |
| 12 | Fixed Deposit top-up increases principal while leaving the lifecycle Open. | Pass — same transfer action suite, top-up case |
| 13 | Fixed Deposit withdrawal one minor unit above principal is rejected. | Pass — same transfer action suite, over-principal case |
| 14 | Same-currency Transfer legs with unequal amounts are rejected. | Pass — `transfer-repository.test.ts`, same-currency mismatch case |
| 15 | Opening Transfer whose amount differs from original principal is rejected. | Pass — same repository suite, opening amount mismatch case |
| 16 | Matured Fixed Deposit cannot be used as a Transfer source. | Pass — same repository suite, matured source case |
| 17 | Fixed Deposit withdrawal sent to a non-linked Account is rejected by the repository even if the action/UI is bypassed. | Pass — same repository suite, linked payout invariant case |
| 18 | Partial Fixed Deposit withdrawal reduces principal without closing it. | Pass — same repository suite, partial withdrawal case |
| 19 | Full pre-maturity withdrawal sets `PrematurelyClosed`. | Pass — same repository suite, early full withdrawal case |
| 20 | Full withdrawal on the maturity date sets `Matured`. | Pass — same repository suite, maturity-day case |
| 21 | Backdated withdrawal that exceeds principal at that historical point rolls back the Transfer and ledger projection. | Pass after fix — new `rejects a backdated withdrawal that exceeds principal at that point in history` case |
| 22 | Stock quantity zero, fractional quantity, and negative price are rejected. | Pass — stock transaction action and domain quantity tests |
| 23 | Mixed-case scrip code is normalized to uppercase in the persisted stock ledger. | Pass — stock create action test |
| 24 | Manual, edited, and batch Sell transactions may create negative net holdings, as the spec requires. | Pass after fix — stock create, edit, and batch action tests |
| 25 | A fully exited company remains at zero holdings, and Imported trades count toward holdings. | Pass — `domain/holdings.test.ts`, zero and imported holdings cases |
| 26 | Invalid reconciliation balance is rejected without writing. | Pass — `accounts/[id]/reconcile/actions.test.ts`, invalid balance case |
| 27 | Matching reconciliation creates no Discrepancy. | Pass — same action suite, matching balance case |
| 28 | Mismatching reconciliation records the signed `reported - computed` difference. | Pass — same action suite, signed discrepancy case |
| 29 | If Reconciliation creation fails after snapshot input, no orphan BalanceSnapshot remains. | Pass after fix — same action suite, forced ID-collision rollback case |
| 30 | Correcting a Discrepancy atomically creates its Adjustment; missing Discrepancy rolls back, and an already-resolved one cannot be overwritten. | Pass — `reconciliation-repository.test.ts`, atomic resolution, rollback, and already-resolved cases |

Additional share-trading coverage from the same full run includes rejecting zero/fractional quantities and negative prices, normalizing symbols to uppercase, retaining fully exited holdings at zero, counting Imported stock transactions in holdings, blocking confirmation while duplicates are unresolved, and accepting sells that produce negative holdings. The latter is newly verified for single-row create, edit, and desktop batch create.

## Defect and fix

In RTL, the sidebar moves to the right, but `.pw-header-actions` was positioned with the physical `right` property. That placed the avatar and language control over the brand. Replacing it with `inset-inline-end` anchors those controls to the inline end, which is the left side in RTL and the right side in LTR. The live Arabic screenshot after the change showed the brand clear on the right and the avatar/language controls on the left. English was restored afterward.

The manual stock Sell path had a holdings guard even though the domain spec and stock-import path permit negative net positions. Removed the guard from create, edit, and batch actions so partial broker histories behave consistently. The batch form restoration helper remains useful for actual validation errors and is covered by its state test; an attempted oversell is no longer supposed to show an error.

Transfer creation previously updated a Fixed Deposit principal incrementally from the current stored balance. A backdated withdrawal could therefore be accepted using a later top-up, leaving history that the edit/delete replay logic would later reject. Creation now recomputes the affected Fixed Deposit from its chronological Transfer history inside the same transaction. The new test proved the old behavior first (the invalid Transfer was accepted), then passed after the fix by confirming no Transfer or Account-side projection was written and principal remained unchanged.

Reconciliation creation previously wrote a BalanceSnapshot and its Reconciliation in separate repository calls. A failure on the second call left an orphan snapshot even though the form reported that reconciliation had not saved. `createWithSnapshot()` now writes the snapshot, reconciliation, and optional discrepancy atomically in SQLite and Postgres. A regression test forces an ID collision at the reconciliation insert and confirms that the new snapshot rolls back too.

## Review follow-up

The independent standards and spec reviews found regressions that the first full test run did not cover. The follow-up checks reproduced and corrected them:

- **Database parity:** the backdated FixedDeposit validation originally covered SQLite alone. Postgres now uses the same replay behavior, with matching rollback coverage.
- **Equal timestamps:** random IDs could order a withdrawal before a same-instant top-up. Both implementations now apply top-ups first at that timestamp. Tests cover creation and subsequent edit/delete replay.
- **Concurrent withdrawals:** moving creation to replay had removed SQLite's in-transaction `Open` check. Two concurrent maturity withdrawals could both credit the Account. Both implementations now recheck lifecycle state within the write transaction; Postgres locks the FixedDeposit row first. Regression tests verify exactly one successful withdrawal and one Account credit.
- **Concurrent edits:** Postgres could deadlock if separate transfer edits acquired foreign-key locks before the state locks. A deterministic overlapping-write test reproduced the failure. Edit/delete paths now lock affected FixedDeposits in sorted order before modifying their Transfer references, and both edits complete successfully.
- **Edits during submission:** restoring submitted rows could overwrite newer edits while a request was pending. The desktop batch inputs now disable during submission. In the live browser, a fractional Sell showed every input disabled while saving, then preserved Sell, MSFT, quantity 1.5, price 400, description, and date while displaying the quantity error. No trade was written.
- **Unsafe stock quantities:** whole-number strings above the safe integer range could be rounded and persisted. The shared parser now rejects them; tests include the largest safe integer and the first overflowing range.
- **Reconciliation consistency:** the existing-snapshot and new-snapshot paths now share their write logic. Additional Postgres tests verify duplicate-ID rollback and owner isolation for the new method.

The narrow-viewport check remains unverified: browser automation exposed no viewport control, and the native browser-control attempt timed out. This is a stated verification limit rather than a passing result.

Final review verification: all 162 test files and 1,261 tests passed, including SQLite, Postgres, and Auth integration cases. ESLint, TypeScript typecheck, and `git diff --check` passed. The earlier sandbox-limited full run was rerun with local test-service access; its connection failures were not treated as application failures or passing tests.

## Performance verification

Compared HEAD `d0e1e8a` with the final implementation against isolated local Postgres fixtures. Each case used five warmups and forty measured repository operations; fixture setup and cleanup were excluded, and resulting data was checked. Times are milliseconds, median / p95.

| Operation | HEAD | Final | SQL statements |
| --- | ---: | ---: | ---: |
| Account-to-Account Transfer | 5.897 / 11.451 | 5.839 / 6.702 | 7 → 7 |
| FixedDeposit top-up, 10 prior Transfers | 7.865 / 10.624 | 7.799 / 10.454 | 8 → 8 |
| FixedDeposit top-up, 1,000 prior Transfers | 7.256 / 9.055 | 7.920 / 9.093 | 8 → 8 |
| Reconciliation, 1,000 ledger rows | 5.694 / 10.140 | 4.204 / 5.156 | 6 → 5 |

The first implementation replayed full history on every FixedDeposit creation and added two SQL round trips. The final conditional update avoids both round trips and history materialization for chronological appends. Backdated entries retain replay validation. The 1,000-history top-up median increased by 0.664 ms (~9%) locally; p95 was effectively unchanged. This is measured local overhead, not proof of zero cost. The later-transfer existence check can still scan matching history with the current indexes. Remote latency, very large histories, and sustained concurrent throughput were not benchmarked.

Session benchmark harness and raw data: `/private/tmp/paisa-review-performance.cjs` and `/private/tmp/paisa-review-performance-results.json`.

SQLite was measured with 320 paired samples per variant, alternating HEAD/current calls in one process against the same reset file-backed database. Real commits were included; seeding, assertions, migrations, and cleanup were excluded. Times are milliseconds, median / p95.

| Operation | HEAD | Final |
| --- | ---: | ---: |
| Account Transfer | 0.703 / 0.845 | 0.706 / 0.871 |
| FixedDeposit append, 10 prior Transfers | 0.846 / 1.015 | 0.914 / 1.109 |
| FixedDeposit append, 1,000 prior Transfers | 0.820 / 0.956 | 0.969 / 1.130 |
| Backdated FixedDeposit top-up, 1,000 prior Transfers | 0.877 / 1.170 | 6.235 / 6.842 |
| Reconciliation, 10 Transactions | 1.102 / 1.319 | 0.674 / 0.803 |
| Reconciliation, 1,000 Transactions | 5.551 / 5.968 | 5.109 / 5.482 |

Ordinary SQLite Account transfers were effectively unchanged; FixedDeposit appends added 0.068–0.149 ms median, and reconciliation was faster. Backdated creation is materially slower in relative terms (+5.358 ms median at 1,000 Transfers) because it now validates the full history instead of accepting an unchecked delta. This cost is retained for correctness and is explicitly not claimed as zero impact.

SQLite session harness/report: `/private/tmp/paisa-performance-20261024/paired-benchmark.mjs`, `paired-results.json`, and `PERFORMANCE.md`. These measurements used Node 26.8.2; local hardware, storage, and background load affect timings.

## Resulting data used by the checks

- Income: QA salary test, +1,000.00 AED.
- Expense: QA expense test, −125.00 AED.
- Transfer: QA FX transfer, −100.00 AED / +100.00 USD.
- Fixed Deposit: QA deposit test, 500.00 AED principal, 4.50%, opening Transfer recorded.
- Reconciliation: 12,500.00 AED reported vs. 12,523.25 AED computed; Discrepancy resolved as disputed.
- Share Trading Account: QA Brokerage; 5 MSFT bought and 2 sold; net 3 shares.
- Rejected edge cases: incomplete transaction batch (no partial write). The former attempted sale of 4 MSFT while holding 3 was rejected by the old UI implementation; that restriction has since been removed because the spec allows negative net holdings.

These QA entries remain in the current app data so the resulting UI states can be reviewed. Three one-letter `r` expense entries were already present before this audit and were not changed.

## Not exercised / limits

- Import review, confirm, undo, and stock-import review: no import batch was available in the existing account.
- Email sync save and polling: not run because the required mailbox and model credentials were not provided. No credentials were entered.
- MCP token generation: not run because it creates a persistent credential with access to financial records.
- Delete actions and “Correct my record” discrepancy resolution: not run because they permanently remove or add ledger history.
- The screenshots were inspected in the live browser during the audit; the available browser capture interface did not provide a workspace file export, so this report records the visual result rather than embedding screenshot files.
- No ~375 px viewport pass was possible through the available browser controls. The changed desktop rule is overridden by the mobile header’s static positioning, but narrow-viewport behavior still needs a dedicated pass.
- Successful financial transactions were not submitted again through the signed-in UI after the initial walkthrough. Positive persistence and lifecycle cases were instead exercised against isolated test databases.
