import { describe, expect, it } from "vitest";

import { isEmailPasswordLoginAvailable } from "@/app/login/email-password-available";

describe("isEmailPasswordLoginAvailable", () => {
  it("is false when the Turnstile site key is missing", () => {
    expect(isEmailPasswordLoginAvailable(null)).toBe(false);
  });

  it("is false when the Turnstile site key is empty", () => {
    expect(isEmailPasswordLoginAvailable("")).toBe(false);
  });

  it("is true when a Turnstile site key is present", () => {
    expect(isEmailPasswordLoginAvailable("0xSiteKey")).toBe(true);
  });
});
