import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("package-electron.sh", () => {
  const script = readFileSync("scripts/package-electron.sh", "utf8");

  it("unsets NEXT_PUBLIC_TURNSTILE_SITE_KEY so captcha is not inlined into the desktop bundle", () => {
    expect(script).toMatch(/env[\s\S]*?-u NEXT_PUBLIC_TURNSTILE_SITE_KEY[\s\S]*?pnpm build/);
  });
});
