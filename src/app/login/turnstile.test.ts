import { describe, expect, it, vi } from "vitest";

import {
  readCaptchaToken,
  runWhenTurnstileApiReady,
  TURNSTILE_RESPONSE_FIELD
} from "@/app/login/turnstile";

describe("readCaptchaToken", () => {
  it("returns a trimmed token from the Turnstile response field", () => {
    const formData = new FormData();
    formData.set(TURNSTILE_RESPONSE_FIELD, "  token-abc  ");
    expect(readCaptchaToken(formData)).toBe("token-abc");
  });

  it("returns an empty string when the field is missing", () => {
    expect(readCaptchaToken(new FormData())).toBe("");
  });
});

/**
 * Cloudflare api.js throws this when turnstile.ready() is used after loading with
 * async/defer (Next.js Script afterInteractive, and our own script.async = true).
 */
function cloudflareReadyThatEnforcesNoAsync(scriptIsAsyncOrDefer: boolean) {
  return (callback: () => void) => {
    if (scriptIsAsyncOrDefer) {
      throw new Error(
        "[Cloudflare Turnstile] Remove async/defer from the Turnstile api.js script tag before using turnstile.ready()."
      );
    }
    callback();
  };
}

describe("runWhenTurnstileApiReady", () => {
  it("does not call ready() (avoids Cloudflare's async/defer TurnstileError)", () => {
    const run = vi.fn();
    const ready = vi.fn(cloudflareReadyThatEnforcesNoAsync(true));
    const api = { ready };

    expect(() => runWhenTurnstileApiReady(api, run)).not.toThrow();
    expect(ready).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledOnce();
  });

  it("still runs the callback when ready() is absent", () => {
    const run = vi.fn();
    runWhenTurnstileApiReady({}, run);
    expect(run).toHaveBeenCalledOnce();
  });
});
