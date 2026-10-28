import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TransferAvailabilityAction } from "@/app/components/transfer-availability-action";

describe("transfer availability action", () => {
  it("renders an accessible, tappable explanation trigger when transfers are unavailable", () => {
    const html = renderToStaticMarkup(createElement(TransferAvailabilityAction, {
      className: "pw-dashboard-action-secondary",
      helpText: "Add an Account to enable transfers.",
      label: "Add transfer"
    }));

    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain(" disabled");
    expect(html).toContain('role="tooltip"');
    expect(html).toContain("Add an Account to enable transfers.");
  });

  it("renders a normal link when transfers are available", () => {
    const html = renderToStaticMarkup(createElement(TransferAvailabilityAction, {
      className: "pw-dashboard-action-secondary",
      href: "/transfers/new",
      helpText: "Add an Account to enable transfers.",
      label: "Add transfer"
    }));

    expect(html).toContain('href="/transfers/new"');
    expect(html).not.toContain('role="tooltip"');
  });
});
