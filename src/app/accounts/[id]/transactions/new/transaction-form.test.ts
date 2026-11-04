import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { jsx } from "react/jsx-runtime";
import { describe, expect, it } from "vitest";

import { TransactionForm } from "@/app/accounts/[id]/transactions/new/transaction-form";
import { LocaleProvider } from "@/i18n/client";
import { getCatalog } from "@/i18n/translator";

describe("TransactionForm", () => {
  it("marks edit mode so the desktop single/batch swap keeps the edit form visible", () => {
    const html = renderToStaticMarkup(jsx(LocaleProvider, {
      locale: "en",
      catalog: getCatalog("en"),
      children: createElement(TransactionForm, {
        accountId: "acc-1",
        currencyCode: "INR",
        returnTo: "/imports/batch-1",
        initialValues: {
          transactionId: "line-1",
          kind: "Expense",
          category: "Utilities",
          amount: "3.00",
          description: "SMS Alert Charges 08-2026",
          occurredAt: "2026-10-01T00:00"
        }
      })
    }));

    // Edit pages render only the single form; without the edit modifier the
    // desktop container-query swap hides it and only the delete link remains.
    expect(html).toContain("pw-transaction-entry--edit");
    expect(html).toContain("pw-transaction-single");
    expect(html).not.toContain("pw-transaction-batch");
  });
});
