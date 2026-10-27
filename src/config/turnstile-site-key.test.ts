import { afterEach, describe, expect, it } from "vitest";

import { getTurnstileSiteKey } from "@/config/turnstile-site-key";

const ORIGINAL = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  } else {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = ORIGINAL;
  }
});

describe("getTurnstileSiteKey", () => {
  it("returns null when the site key is unset", () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    expect(getTurnstileSiteKey()).toBeNull();
  });

  it("returns null when the site key is only whitespace", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "   ";
    expect(getTurnstileSiteKey()).toBeNull();
  });

  it("returns the trimmed site key when configured", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "  0xSiteKey  ";
    expect(getTurnstileSiteKey()).toBe("0xSiteKey");
  });
});
