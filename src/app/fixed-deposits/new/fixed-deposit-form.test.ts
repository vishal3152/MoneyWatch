import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { jsx } from "react/jsx-runtime";
import { describe, expect, it } from "vitest";

import { FixedDepositForm } from "@/app/fixed-deposits/new/fixed-deposit-form";
import { LocaleProvider } from "@/i18n/client";
import { getCatalog } from "@/i18n/translator";

describe("FixedDepositForm", () => {
  it("offers a direct way to add an Account when the selected Institution has none", () => {
    const html = renderToStaticMarkup(jsx(LocaleProvider, {
      locale: "en",
      catalog: getCatalog("en"),
      children: createElement(FixedDepositForm, {
        institutions: [{ id: "inst-1", name: "Bank One" }],
        accounts: [],
        initialInstitutionId: "inst-1"
      })
    }));

    expect(html).toContain('href="/accounts/new?institutionId=inst-1"');
  });
});
