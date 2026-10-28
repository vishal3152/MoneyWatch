import Link from "next/link";
import type { Metadata } from "next";
import { IconArrowsLeftRight, IconPlus } from "@tabler/icons-react";

import { DashboardAddMenu } from "@/app/components/dashboard-add-menu";
import { MarketingLanding } from "@/app/components/marketing-landing";
import { PageHeader, SectionHeader } from "@/app/components/design-system";
import { InstitutionsBrowser } from "@/app/components/institutions-browser";
import { TransferAvailabilityAction } from "@/app/components/transfer-availability-action";
import { CurrencyFlag } from "@/app/components/currency-flag";
import { resolveSystemMessage } from "@/app/components/system-message";
import { SystemMessageBanner } from "@/app/components/system-message-banner";
import { canCreateTransfer } from "@/app/transfer-availability";
import { computeCurrencyTotals, type CurrencyTotalEntry } from "@/domain/currency-totals";
import { DISPLAY_LOCALE, formatGroupedCurrencyAmount } from "@/app/format-money";
import { getLocale, getTranslator } from "@/i18n/server";
import { getMarketingMetadata } from "@/app/marketing-metadata";
import { isCloudMode } from "@/config/deployment-mode";
import { getCurrentOwnerId } from "@/lib/cloud-auth/current-owner";
import {
  getAccountRepository,
  getFixedDepositRepository,
  getInstitutionRepository,
  getShareTradingAccountRepository,
  getTransactionRepository
} from "@/db/repository-factory";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return getMarketingMetadata(await getLocale());
}

type HomePageProps = {
  searchParams: Promise<{ message?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const cloudMode = isCloudMode();
  const ownerId = cloudMode ? await getCurrentOwnerId() : null;
  const { t, plural } = await getTranslator();

  if (cloudMode && ownerId === null) {
    return <MarketingLanding t={t} />;
  }

  const { message } = await searchParams;
  const systemMessage = resolveSystemMessage(message, t);
  const [
    institutions,
    accounts,
    fixedDeposits,
    shareTradingAccountSummaries,
    transactionRepository
  ] = await Promise.all([
    getInstitutionRepository().then((repo) => repo.listAll()),
    getAccountRepository().then((repo) => repo.listAll()),
    getFixedDepositRepository().then((repo) => repo.listAll()),
    getShareTradingAccountRepository().then((repo) => repo.listAllWithHoldingCounts()),
    getTransactionRepository()
  ]);
  if (institutions.length === 0) {
    return (
      <main className="pw-main">
        <section className="pw-dashboard pw-onboarding" aria-labelledby="onboarding-heading">
          {systemMessage ? <SystemMessageBanner message={systemMessage} /> : null}
          <PageHeader
            id="onboarding-heading"
            eyebrow={t("dashboard.setup.welcome")}
            title={t("dashboard.setup.heading")}
            description={t("dashboard.setup.description")}
          />
          <Link className="pw-button pw-onboarding-action" href="/institutions/new">
            <IconPlus className="pw-dashboard-action-icon" aria-hidden="true" stroke={1.8} />
            {t("dashboard.addInstitution")}
          </Link>
          <p className="pw-onboarding-sequence">{t("dashboard.setup.sequence")}</p>
        </section>
      </main>
    );
  }

  const shareTradingAccounts = shareTradingAccountSummaries.map((summary) => summary.account);
  const transferAvailable = canCreateTransfer(
    accounts.length,
    fixedDeposits.filter((fixedDeposit) => fixedDeposit.status === "Open").length
  );
  const accountIds = accounts.map((account) => account.id);
  // One batched round trip each for balances and recent rows. Holding counts
  // arrived with the ShareTradingAccounts above, so the dashboard never loads
  // a full stock ledger merely to count distinct scrips.
  const [balanceTotals, recentTransactions] = await Promise.all([
    transactionRepository.sumAmountsByAccountIds(accountIds),
    transactionRepository.listRecentByAccountIds(accountIds, 6)
  ]);
  const balanceByAccountId = new Map(
    balanceTotals.map((total) => [total.accountId, total.balanceMinor] as const)
  );
  const accountSummaries = new Map(
    accounts.map((account) => [
      account.id,
      { balance: balanceByAccountId.get(account.id) ?? 0 }
    ])
  );
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const holdingCountByShareTradingAccountId = new Map(
    shareTradingAccountSummaries.map((summary) => [summary.account.id, summary.holdingCount])
  );

  const currencyTotalEntries: CurrencyTotalEntry[] = [
    ...accounts.map((account) => ({
      currencyCode: account.currencyCode,
      amountMinor: accountSummaries.get(account.id)!.balance,
      kind: "account" as const
    })),
    ...fixedDeposits.map((fixedDeposit) => ({
      currencyCode: fixedDeposit.currencyCode,
      amountMinor: fixedDeposit.principalMinor,
      kind: "fixedDeposit" as const
    }))
  ];
  const currencyTotals = computeCurrencyTotals(currencyTotalEntries);

  const institutionGroups = institutions.map((institution) => ({
    institution: { id: institution.id, name: institution.name },
    accounts: accounts
      .filter((account) => account.institutionId === institution.id)
      .map((account) => ({
        id: account.id,
        name: account.name,
        accountNumber: account.accountNumber,
        currencyCode: account.currencyCode,
        balanceMinor: accountSummaries.get(account.id)!.balance
      })),
    fixedDeposits: fixedDeposits
      .filter((fixedDeposit) => fixedDeposit.institutionId === institution.id)
      .map((fixedDeposit) => ({
        id: fixedDeposit.id,
        name: fixedDeposit.name,
        accountNumber: fixedDeposit.accountNumber,
        currencyCode: fixedDeposit.currencyCode,
        principalMinor: fixedDeposit.principalMinor
      })),
    shareTradingAccounts: shareTradingAccounts
      .filter((shareTradingAccount) => shareTradingAccount.institutionId === institution.id)
      .map((shareTradingAccount) => {
        const holdingCount = holdingCountByShareTradingAccountId.get(shareTradingAccount.id) ?? 0;
        return {
          id: shareTradingAccount.id,
          name: shareTradingAccount.name,
          accountNumber: shareTradingAccount.accountNumber,
          currencyCode: shareTradingAccount.currencyCode,
          holdingText: plural("count.holdings", holdingCount)
        };
      })
  }));

  return (
    <main className="pw-main">
      <section className="pw-dashboard">
        <PageHeader
          eyebrow={t("dashboard.welcomeBack")}
          title={t("dashboard.heading")}
          actions={
            <>
              <div className="pw-dashboard-top-actions">
                <DashboardAddMenu />
                <TransferAvailabilityAction
                  className="pw-dashboard-action-secondary"
                  containerClassName="pw-dashboard-transfer-action pw-transfer-action"
                  href={transferAvailable ? "/transfers/new" : undefined}
                  helpText={accounts.length === 0
                    ? t("dashboard.transferNeedsAccount")
                    : t("dashboard.transferNeedsCounterparty")}
                  icon={<IconArrowsLeftRight aria-hidden="true" className="pw-dashboard-action-icon" stroke={1.8} />}
                  label={t("dashboard.addTransfer")}
                />
              </div>
              <div className="pw-dashboard-date">
                <time dateTime={new Date().toISOString().slice(0, 10)}>
                  {new Intl.DateTimeFormat("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "Asia/Dubai"
                  }).format(new Date())}
                </time>
              </div>
            </>
          }
        />
        {systemMessage ? <SystemMessageBanner message={systemMessage} /> : null}

        {currencyTotals.length > 0 ? (
          <section className="pw-section pw-currency-totals" aria-labelledby="currency-totals-heading">
            <h2 className="pw-visually-hidden" id="currency-totals-heading">{t("dashboard.currencyTotals.heading")}</h2>
            <ul className="pw-currency-total-grid">
              {currencyTotals.map((total) => (
                <li
                  key={total.currencyCode}
                  className={
                    total.totalMinor < 0
                      ? "pw-currency-total-card pw-currency-total-card--negative"
                      : "pw-currency-total-card"
                  }
                >
                  <span className="pw-currency-total-topline">
                    <CurrencyFlag currencyCode={total.currencyCode} />
                    <span className="pw-currency-total-code">{total.currencyCode}</span>
                    <span className="pw-currency-total-meta">{t("dashboard.balanceLabel")}</span>
                  </span>
                  <span
                    className={
                      total.totalMinor < 0
                        ? "pw-currency-total-value pw-currency-total-value--negative"
                        : "pw-currency-total-value"
                    }
                  >
                    {formatGroupedCurrencyAmount(total.totalMinor, total.currencyCode)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <InstitutionsBrowser
          groups={institutionGroups}
          currencyCodes={Array.from(new Set([
            ...currencyTotals.map((total) => total.currencyCode),
            ...shareTradingAccounts.map((account) => account.currencyCode)
          ])).sort()}
          addShareTradingAccountLabel={t("dashboard.addShareTradingAccount")}
          accountsHeading={t("dashboard.accountsHeading")}
          manageInstitutionsLabel={t("dashboard.manageInstitutions")}
          institutionLabel={t("dashboard.institutionColumn")}
          accountLabel={t("dashboard.accountColumn")}
          balanceLabel={t("dashboard.balanceColumn")}
          shareTradingHeading={t("institutions.detail.shareTradingAccounts")}
          holdingsLabel={t("shareTrading.detail.holdings")}
          noAccountsLabel={t("institutions.detail.noAccounts")}
          noShareTradingAccountsLabel={t("institutions.detail.noShareTradingAccounts")}
          searchAccountsLabel={t("dashboard.searchAccounts")}
          searchAccountsPlaceholder={t("dashboard.searchAccountsPlaceholder")}
          clearSearchLabel={t("dashboard.clearAccountSearch")}
          noSearchResultsLabel={t("dashboard.noAccountSearchResults")}
          accountActionsLabel={t("dashboard.accountActions")}
          addIncomeLabel={t("dashboard.addIncome")}
          addExpenseLabel={t("dashboard.addExpense")}
          closeActionsLabel={t("select.done")}
          currencyNames={{ AED: t("currency.AED"), USD: t("currency.USD"), INR: t("currency.INR") }}
        />

        <section
          className="pw-section pw-recent-transactions"
          aria-labelledby="recent-transactions-heading"
        >
          <SectionHeader id="recent-transactions-heading" title={t("dashboard.recentTransactions")} />
          {recentTransactions.length === 0 ? (
            <p className="pw-empty">{t("dashboard.recentTransactionsEmpty")}</p>
          ) : (
            <div className="pw-transactions-table" role="table" aria-label={t("dashboard.recentTransactions")}>
              <div className="pw-transactions-head" role="row">
                <span role="columnheader">{t("dashboard.dateColumn")}</span>
                <span role="columnheader">{t("dashboard.descriptionColumn")}</span>
                <span role="columnheader">{t("dashboard.accountColumn")}</span>
                <span role="columnheader">{t("dashboard.amountColumn")}</span>
              </div>
              {recentTransactions.map((transaction) => {
                const account = accountsById.get(transaction.accountId);
                if (!account) {
                  return null;
                }
                const date = new Date(transaction.occurredAt).toLocaleDateString(DISPLAY_LOCALE, { dateStyle: "medium" });
                return (
                  <Link className="pw-transaction-row" href={`/accounts/${account.id}`} key={transaction.id} prefetch={false} role="row">
                    <time role="cell" dateTime={new Date(transaction.occurredAt).toISOString()}>{date}</time>
                    <span className="pw-transaction-description" role="cell">{transaction.description}</span>
                    <span className="pw-transaction-account" role="cell">{account.name}</span>
                    <span className={transaction.amountMinor > 0 ? "pw-item-amount pw-item-amount--positive" : transaction.amountMinor < 0 ? "pw-item-amount pw-item-amount--negative" : "pw-item-amount"} role="cell">
                      {`${transaction.amountMinor > 0 ? "+ " : ""}${formatGroupedCurrencyAmount(transaction.amountMinor, account.currencyCode)}`}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

      </section>
    </main>
  );
}
