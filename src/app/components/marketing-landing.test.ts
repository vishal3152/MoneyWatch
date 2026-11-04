import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createTranslator, getCatalog } from "@/i18n/translator";
import { MarketingLanding } from "@/app/components/marketing-landing";
import { getMarketingMetadata } from "@/app/marketing-metadata";

describe("MarketingLanding", () => {
  it("explains the product and offers a clear path into the app", () => {
    const translator = createTranslator("en", getCatalog("en"));
    const html = renderToStaticMarkup(createElement(MarketingLanding, { t: translator.t }));

    expect(html).toContain("Know what you have. Trust every balance.");
    expect(html).toContain("personal finance tracker");
    expect(html).toContain("Money spread across banks and currencies is hard to keep straight");
    expect(html).toContain("against the bank&#x27;s reported numbers");
    expect(html).toContain("Use AI to prepare transactions");
    expect(html).toContain('href="/login"');
    expect(html).toContain("Sign in to Money Watch");
    expect(html).toContain('href="https://github.com/vishal3152/Money-Watch"');
    expect(html).toContain("Run it yourself");
    expect(html).toContain('src="/marketing/dashboard-demo.png"');
    expect(html).toContain("sample data");
  });

  it("explains statement import and email sync in plain language", () => {
    const translator = createTranslator("en", getCatalog("en"));
    const html = renderToStaticMarkup(createElement(MarketingLanding, { t: translator.t }));

    expect(html).toContain("Upload a statement — skip the data entry");
    expect(html).toContain("Connect an assistant like Claude or Cursor to prepare statement imports and answer questions about your Money Watch records");
    expect(html).toContain("Ask about the transactions you have recorded");
    expect(html).toContain("Search by account, date, description, category, or money in and out");
    expect(html).toContain("matching recorded transaction details are returned to your connected assistant");
    expect(html).toContain("Money Watch receives the organized transactions, not the original file");
    expect(html).toContain("Turn bank alert emails into draft transactions");
    expect(html).toContain("No online banking password required");
    expect(html).toContain("Review every draft before it becomes part of your ledger");
    expect(html).not.toContain("MCP");
  });

  it("states the local hosted privacy boundaries without overpromising", () => {
    const translator = createTranslator("en", getCatalog("en"));
    const html = renderToStaticMarkup(createElement(MarketingLanding, { t: translator.t }));

    expect(html).toContain("Self-hosted");
    expect(html).toContain("Run it as a desktop app, or host it on your own server");
    expect(html).toContain("single SQLite file");
    expect(html).toContain("No account or login in local mode");
    expect(html).toContain("No trackers, analytics, or crash reporting in the app");
    expect(html).toContain("Money Watch never asks for your online banking login");
    expect(html).toContain("Local mode makes no network calls unless you enable email sync");
    expect(html).toContain("On a local hosted install");
    expect(html).toContain("a local Ollama model for email sync");
    expect(html).toContain("Email alert text goes to the LLM host you configure");
    expect(html).toContain("Unclear matches wait for you instead of being guessed");
    expect(html).not.toContain("matches the right account");
  });

  it("provides localized search metadata for each supported language", () => {
    const english = getMarketingMetadata("en");
    const chinese = getMarketingMetadata("zh");
    const arabic = getMarketingMetadata("ar");

    expect(english.title).toContain("Multi-Currency Personal Finance Tracker");
    expect(english.description).toContain("Reconcile every balance");
    expect(chinese.title).toContain("多币种");
    expect(chinese.description).toContain("核对每个余额");
    expect(arabic.title).toContain("متعدد العملات");
    expect(arabic.description).toContain("طابق كل رصيد");
  });
});
