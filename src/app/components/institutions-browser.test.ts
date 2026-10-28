import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { jsx } from "react/jsx-runtime";
import { describe, expect, it } from "vitest";

import { InstitutionsBrowser } from "@/app/components/institutions-browser";
import { LocaleProvider } from "@/i18n/client";
import { getCatalog } from "@/i18n/translator";

const props = {
  groups: [{
    institution: { id: "inst-1", name: "Bank One" },
    accounts: [{ id: "acc-1", name: "Savings", accountNumber: "12345678", currencyCode: "INR", balanceMinor: 12500 }],
    fixedDeposits: [{ id: "fd-1", name: "Deposit", accountNumber: null, currencyCode: "INR", principalMinor: 25000 }],
    shareTradingAccounts: [{ id: "trading-1", name: "Shares", accountNumber: null, currencyCode: "USD", holdingText: "2 holdings" }]
  }],
  currencyCodes: ["INR", "USD"],
  addShareTradingAccountLabel: "Add Share Trading Account",
  accountsHeading: "Accounts",
  manageInstitutionsLabel: "Manage institutions",
  institutionLabel: "Institution",
  accountLabel: "Account",
  balanceLabel: "Balance",
  shareTradingHeading: "Share Trading Accounts",
  holdingsLabel: "Holdings",
  noAccountsLabel: "No Accounts yet.",
  noShareTradingAccountsLabel: "No Share Trading Accounts yet.",
  searchAccountsLabel: "Search accounts",
  searchAccountsPlaceholder: "Account name or number",
  clearSearchLabel: "Clear account search",
  noSearchResultsLabel: "No accounts match your search.",
  accountActionsLabel: "Account actions",
  addIncomeLabel: "Add income",
  addExpenseLabel: "Add expense",
  closeActionsLabel: "Done",
  currencyNames: { INR: "Indian Rupee (INR)", USD: "US Dollar (USD)" }
};

describe("dashboard account sections", () => {
  it("links institution names to their details while keeping separate account links", () => {
    const html = renderToStaticMarkup(jsx(LocaleProvider, { locale: "en", catalog: getCatalog("en"), children: createElement(InstitutionsBrowser, props) }));

    expect(html).toMatch(/<a[^>]*href="\/institutions\/inst-1"[^>]*>Bank One<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/accounts\/acc-1"/);
    expect(html).toMatch(/<a[^>]*href="\/fixed-deposits\/fd-1"/);
    expect(html).not.toMatch(/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/);
    expect(html).toContain("•••• 5678");
  });

  it("keeps childless Institutions out of Accounts and links to Institution management", () => {
    const html = renderToStaticMarkup(jsx(LocaleProvider, {
      locale: "en",
      catalog: getCatalog("en"),
      children: createElement(InstitutionsBrowser, {
        ...props,
        groups: [
          ...props.groups,
          {
            institution: { id: "inst-empty", name: "Empty Bank" },
            accounts: [],
            fixedDeposits: [],
            shareTradingAccounts: []
          }
        ]
      })
    }));

    expect(html).toContain('href="/institutions"');
    expect(html).toContain("Manage institutions");
    expect(html).not.toContain('href="/institutions/inst-empty"');
    expect(html).not.toContain("Empty Bank");
  });

  it("separates trading holdings from cash accounts and links each Add Account to its own form", () => {
    const html = renderToStaticMarkup(jsx(LocaleProvider, { locale: "en", catalog: getCatalog("en"), children: createElement(InstitutionsBrowser, props) }));
    const sections = html.match(/<section\b[\s\S]*?<\/section>/g) ?? [];

    expect(sections).toHaveLength(2);
    expect(sections[0]).toContain("Accounts");
    expect(sections[0]).toContain("Account");
    expect(sections[0]).toContain('aria-haspopup="dialog"');
    expect(sections[0]).toContain('aria-label="Add Account"');
    expect(sections[0]).toContain("Savings");
    expect(sections[0]).toContain("Deposit");
    expect(sections[0]).toContain("INR 375.00");
    expect(sections[0]).not.toContain("Shares");
    expect(sections[0]).not.toContain("USD Accounts");
    expect(sections[1]).toContain('id="dashboard-share-trading-heading">Share Trading Accounts<a');
    expect(sections[1]).toContain('href="/share-trading-accounts/new"');
    expect(sections[1]).toContain('href="/share-trading-accounts/trading-1"');
    expect(sections[1]).toContain("Shares");
    expect(sections[1]).toContain("2 holdings");
    expect(sections[1]).toContain('role="columnheader">Holdings</span>');
    expect(sections[1]).not.toContain("Balance (USD)");
    expect(sections[1]).not.toContain("Total</span>");
    expect(sections[1]).not.toContain("Savings");
  });
});
