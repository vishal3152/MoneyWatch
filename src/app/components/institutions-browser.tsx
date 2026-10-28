"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { IconChevronDown, IconDotsVertical, IconMinus, IconPlus, IconSearch, IconX } from "@tabler/icons-react";

import { SectionHeader } from "@/app/components/design-system";
import { DashboardAddMenu } from "@/app/components/dashboard-add-menu";
import { CurrencyFlag } from "@/app/components/currency-flag";
import { formatGroupedCurrencyAmount } from "@/app/format-money";

export type AccountListItem = {
  id: string;
  name: string;
  accountNumber: string | null;
  currencyCode: string;
  balanceMinor: number;
};

export type FixedDepositListItem = {
  id: string;
  name: string;
  accountNumber: string | null;
  currencyCode: string;
  principalMinor: number;
};

export type ShareTradingAccountListItem = {
  id: string;
  name: string;
  accountNumber: string | null;
  currencyCode: string;
  holdingText: string;
};

type InstitutionGroup = {
  institution: { id: string; name: string };
  accounts: AccountListItem[];
  fixedDeposits: FixedDepositListItem[];
  shareTradingAccounts: ShareTradingAccountListItem[];
};

export function InstitutionsBrowser({
  groups,
  currencyCodes,
  addShareTradingAccountLabel,
  accountsHeading,
  manageInstitutionsLabel,
  institutionLabel,
  accountLabel,
  balanceLabel,
  shareTradingHeading,
  holdingsLabel,
  noAccountsLabel,
  noShareTradingAccountsLabel,
  searchAccountsLabel,
  searchAccountsPlaceholder,
  clearSearchLabel,
  noSearchResultsLabel,
  accountActionsLabel,
  addIncomeLabel,
  addExpenseLabel,
  closeActionsLabel,
  currencyNames
}: {
  groups: InstitutionGroup[];
  currencyCodes: string[];
  addShareTradingAccountLabel: string;
  accountsHeading: string;
  manageInstitutionsLabel: string;
  institutionLabel: string;
  accountLabel: string;
  balanceLabel: string;
  shareTradingHeading: string;
  holdingsLabel: string;
  noAccountsLabel: string;
  noShareTradingAccountsLabel: string;
  searchAccountsLabel: string;
  searchAccountsPlaceholder: string;
  clearSearchLabel: string;
  noSearchResultsLabel: string;
  accountActionsLabel: string;
  addIncomeLabel: string;
  addExpenseLabel: string;
  closeActionsLabel: string;
  currencyNames: Record<string, string>;
}) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const hasSearchMatches = !query || groups.some((group) => [
    ...group.accounts,
    ...group.fixedDeposits,
    ...group.shareTradingAccounts
  ].some((item) => `${item.name} ${item.accountNumber ?? ""}`.toLocaleLowerCase().includes(query)));
  return (
    <>
      {[false, true].map((isTrading) => {
        const headingId = isTrading ? "dashboard-share-trading-heading" : "dashboard-accounts-heading";
        const sectionCurrencies = currencyCodes.filter((currencyCode) =>
          groups.some((group) => (isTrading
            ? group.shareTradingAccounts
            : [...group.accounts, ...group.fixedDeposits]
          ).some((account) => account.currencyCode === currencyCode))
        );

        return (
          <section className={`pw-section pw-dashboard-accounts${isTrading ? " pw-dashboard-trading-accounts" : ""}`} aria-labelledby={headingId} key={headingId}>
            <SectionHeader
              id={headingId}
              title={isTrading ? (
                <>
                  {shareTradingHeading}
                  <Link
                    className="pw-dashboard-inline-add"
                    href="/share-trading-accounts/new"
                    aria-label={addShareTradingAccountLabel}
                    title={addShareTradingAccountLabel}
                  >
                    <IconPlus aria-hidden="true" stroke={1.8} />
                  </Link>
                </>
              ) : (
                <>
                  {accountsHeading}
                  <DashboardAddMenu type="account" iconOnly />
                </>
              )}
              action={isTrading ? (
                null
              ) : (
                <div className="pw-account-header-actions">
                  <label className="pw-dashboard-account-search">
                    <span className="pw-visually-hidden">{searchAccountsLabel}</span>
                    <IconSearch aria-hidden="true" stroke={1.8} />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.currentTarget.value)}
                      placeholder={searchAccountsPlaceholder}
                    />
                    {search ? (
                      <button type="button" aria-label={clearSearchLabel} onClick={() => setSearch("")}>
                        <IconX aria-hidden="true" stroke={1.8} />
                      </button>
                    ) : null}
                  </label>
                </div>
              )}
            />
            {!isTrading ? (
              <Link className="pw-account-manage-link" href="/institutions">
                {manageInstitutionsLabel}
              </Link>
            ) : null}
            {sectionCurrencies.length === 0 ? (
              <p className="pw-empty">{isTrading ? noShareTradingAccountsLabel : noAccountsLabel}</p>
            ) : null}
            {sectionCurrencies.map((currencyCode) => {
              const rows = groups.flatMap((group) => [
                ...(isTrading ? [] : group.accounts)
                  .filter((account) => account.currencyCode === currencyCode)
                  .map((account) => ({
                    id: account.id,
                    href: `/accounts/${account.id}`,
                    institution: group.institution.name,
                    institutionHref: `/institutions/${group.institution.id}`,
                    account: account.name,
                    number: account.accountNumber,
                    amount: formatGroupedCurrencyAmount(account.balanceMinor, currencyCode),
                    kind: "account"
                  })),
                ...(isTrading ? [] : group.fixedDeposits)
                  .filter((deposit) => deposit.currencyCode === currencyCode)
                  .map((deposit) => ({
                    id: deposit.id,
                    href: `/fixed-deposits/${deposit.id}`,
                    institution: group.institution.name,
                    institutionHref: `/institutions/${group.institution.id}`,
                    account: deposit.name,
                    number: deposit.accountNumber,
                    amount: formatGroupedCurrencyAmount(deposit.principalMinor, currencyCode),
                    kind: "fixedDeposit"
                  })),
                ...(isTrading ? group.shareTradingAccounts : [])
                  .filter((tradingAccount) => tradingAccount.currencyCode === currencyCode)
                  .map((tradingAccount) => ({
                    id: tradingAccount.id,
                    href: `/share-trading-accounts/${tradingAccount.id}`,
                    institution: group.institution.name,
                    institutionHref: `/institutions/${group.institution.id}`,
                    account: tradingAccount.name,
                    number: tradingAccount.accountNumber,
                    amount: tradingAccount.holdingText,
                    kind: "shareTrading"
                  }))
              ]).filter((row) => !query || `${row.account} ${row.number ?? ""}`.toLocaleLowerCase().includes(query));
              if (query && rows.length === 0) {
                return null;
              }
              const currencyTotal = [
                ...groups.flatMap((group) => group.accounts)
                  .filter((account) => account.currencyCode === currencyCode)
                  .map((account) => account.balanceMinor),
                ...groups.flatMap((group) => group.fixedDeposits)
                  .filter((deposit) => deposit.currencyCode === currencyCode)
                  .map((deposit) => deposit.principalMinor)
              ].reduce((sum, amount) => sum + amount, 0);

              return (
                <details className="pw-account-currency" key={currencyCode} open={Boolean(query) || rows.length <= 8}>
                  <summary className="pw-account-currency-heading">
                    <CurrencyFlag currencyCode={currencyCode} />
                    <strong>{currencyNames[currencyCode] ?? currencyCode}</strong>
                    {!isTrading ? (
                      <span className="pw-account-currency-total">
                        <span>Total</span> {formatGroupedCurrencyAmount(currencyTotal, currencyCode)}
                      </span>
                    ) : null}
                    <IconChevronDown aria-hidden="true" className="pw-account-currency-chevron" stroke={1.8} />
                  </summary>
                  <div className="pw-account-table" role="table" aria-label={`${currencyCode} ${isTrading ? shareTradingHeading : accountsHeading}`}>
                    <div className="pw-account-table-head" role="row">
                      <span role="columnheader">{institutionLabel}</span>
                      <span role="columnheader">{accountLabel}</span>
                      <span role="columnheader">{isTrading ? holdingsLabel : `${balanceLabel} (${currencyCode})`}</span>
                    </div>
                    {rows.map((row) => (
                      <div className="pw-account-table-row" key={`${row.kind}-${row.id}`} role="row">
                        <span className="pw-account-institution" role="cell">
                          <Link href={row.institutionHref} prefetch={false}>{row.institution}</Link>
                        </span>
                        <span className="pw-account-name" role="cell">
                          <Link className="pw-account-link" href={row.href} prefetch={false}>{row.account}</Link>
                          {row.number ? <small>•••• {row.number.slice(-4)}</small> : null}
                        </span>
                        <span className="pw-account-balance" role="cell">{row.amount}</span>
                        {row.kind === "account" ? (
                          <AccountQuickActions
                            accountId={row.id}
                            accountName={row.account}
                            accountNumber={row.number}
                            actionsLabel={accountActionsLabel}
                            incomeLabel={addIncomeLabel}
                            expenseLabel={addExpenseLabel}
                            closeLabel={closeActionsLabel}
                          />
                        ) : <span className="pw-account-chevron" aria-hidden="true">›</span>}
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
            {!isTrading && query && !hasSearchMatches ? <p className="pw-empty">{noSearchResultsLabel}</p> : null}
          </section>
        );
      })}
    </>
  );
}

function AccountQuickActions({
  accountId,
  accountName,
  accountNumber,
  actionsLabel,
  incomeLabel,
  expenseLabel,
  closeLabel
}: {
  accountId: string;
  accountName: string;
  accountNumber: string | null;
  actionsLabel: string;
  incomeLabel: string;
  expenseLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const incomeRef = useRef<HTMLAnchorElement>(null);
  const label = `${accountName}${accountNumber ? ` •••• ${accountNumber.slice(-4)}` : ""}`;

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (window.matchMedia("(max-width: 640px)").matches) {
      closeRef.current?.focus();
    } else {
      incomeRef.current?.focus();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])") ?? [])
        .filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  function showActions(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({
      top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 112)),
      right: window.innerWidth - rect.right
    });
    setOpen(true);
  }

  return (
    <span className="pw-account-actions-cell" role="cell">
      <button
        ref={triggerRef}
        className="pw-account-actions-trigger"
        type="button"
        aria-label={`${label}: ${actionsLabel}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={showActions}
      >
        <IconDotsVertical aria-hidden="true" stroke={1.8} />
      </button>
      {open ? createPortal(
        <div className="pw-account-actions-layer">
          <button className="pw-account-actions-backdrop" type="button" aria-label={closeLabel} onClick={() => setOpen(false)} />
          <section
            ref={dialogRef}
            className="pw-account-actions-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            style={{ "--pw-account-menu-top": `${position.top}px`, "--pw-account-menu-right": `${position.right}px` } as CSSProperties}
          >
            <header>
              <h2 id={titleId}>{label}</h2>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)}>{closeLabel}</button>
            </header>
            <Link ref={incomeRef} href={`/accounts/${accountId}/transactions/new?kind=Income`}>
              <IconPlus aria-hidden="true" stroke={1.8} /> {incomeLabel}
            </Link>
            <Link href={`/accounts/${accountId}/transactions/new?kind=Expense`}>
              <IconMinus aria-hidden="true" stroke={1.8} /> {expenseLabel}
            </Link>
          </section>
        </div>,
        document.body
      ) : null}
    </span>
  );
}
