import { describe, expect, it, vi } from "vitest";

import {
  FORM_OPTIONS_TAGS,
  formOptionsCacheKey,
  formOptionsScope,
  invalidateFormOptions,
  scopedFormOptionsTag
} from "@/app/form-options-cache";

describe("formOptionsScope", () => {
  it("uses the Owner id in cloud so two Owners never share a cached list", () => {
    expect(formOptionsScope("owner-a", "/ignored.db")).toBe("owner-a");
  });

  it("uses the resolved database path locally so switching files cannot reuse stale options", () => {
    const firstScope = formOptionsScope(null, "/data/one.db");
    const secondScope = formOptionsScope(null, "/data/two.db");

    expect(firstScope).toMatch(/^local:[a-f0-9]{64}$/);
    expect(secondScope).toMatch(/^local:[a-f0-9]{64}$/);
    expect(firstScope).not.toBe(secondScope);
  });
});

describe("formOptionsCacheKey", () => {
  it("includes the entity and Owner scope so keys cannot collide across lists or tenants", () => {
    expect(formOptionsCacheKey("institutions", "owner-a")).toEqual([
      "form-options",
      "institutions",
      "owner-a"
    ]);
    expect(formOptionsCacheKey("accounts", "local")).toEqual([
      "form-options",
      "accounts",
      "local"
    ]);
  });
});

describe("invalidateFormOptions", () => {
  it("revalidates every supplied tag only for the current Owner", async () => {
    const revalidate = vi.fn();

    await invalidateFormOptions(
      [FORM_OPTIONS_TAGS.institutions, FORM_OPTIONS_TAGS.accounts],
      { getCurrentOwnerId: async () => "owner-a", revalidate }
    );

    expect(revalidate).toHaveBeenCalledWith("form-options:institutions:owner-a");
    expect(revalidate).toHaveBeenCalledWith("form-options:accounts:owner-a");
    expect(revalidate).toHaveBeenCalledTimes(2);
  });

  it("builds the same scoped tags that cache reads and mutations share", () => {
    expect(FORM_OPTIONS_TAGS.institutions).toBe("form-options:institutions");
    expect(FORM_OPTIONS_TAGS.accounts).toBe("form-options:accounts");
    expect(FORM_OPTIONS_TAGS.fixedDeposits).toBe("form-options:fixed-deposits");
    expect(
      scopedFormOptionsTag(FORM_OPTIONS_TAGS.fixedDeposits, "owner-a")
    ).toBe("form-options:fixed-deposits:owner-a");
  });
});
