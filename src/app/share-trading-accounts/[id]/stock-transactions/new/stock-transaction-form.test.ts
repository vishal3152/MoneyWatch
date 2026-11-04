import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { jsx } from "react/jsx-runtime";
import { describe, expect, it } from "vitest";

import { StockTransactionForm } from "@/app/share-trading-accounts/[id]/stock-transactions/new/stock-transaction-form";
import { LocaleProvider } from "@/i18n/client";
import { getCatalog } from "@/i18n/translator";

describe("StockTransactionForm", () => {
  it("marks edit mode so the desktop single/batch swap keeps the edit form visible", () => {
    const html = renderToStaticMarkup(jsx(LocaleProvider, {
      locale: "en",
      catalog: getCatalog("en"),
      children: createElement(StockTransactionForm, {
        shareTradingAccountId: "stc-1",
        currencyCode: "INR",
        initialValues: {
          stockTransactionId: "sline-1",
          type: "Buy",
          scripCode: "RELIANCE",
          quantity: "10",
          price: "2500.00",
          description: "Reliance buy",
          occurredAt: "2026-10-01T10:00"
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
