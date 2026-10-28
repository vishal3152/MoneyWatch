import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { OWNER_ID_HEADER } from "@/lib/cloud-auth/request-identity";
import { config, middleware } from "@/middleware";

const ORIGINAL_DEPLOYMENT_MODE = process.env.DEPLOYMENT_MODE;
const ORIGINAL_AUTH_PROVIDER = process.env.AUTH_PROVIDER;

afterEach(() => {
  process.env.DEPLOYMENT_MODE = ORIGINAL_DEPLOYMENT_MODE;
  process.env.AUTH_PROVIDER = ORIGINAL_AUTH_PROVIDER;
});

describe("middleware matcher", () => {
  it("runs for dynamic page paths that end in an asset extension", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "/accounts/forged.png" })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: "/institutions/forged.svg" })).toBe(true);
  });

  it("skips Next build assets", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "/_next/static/chunks/app.js" })).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, url: "/_next/image" })).toBe(false);
  });
});

describe("middleware on asset-extension paths", () => {
  it("strips forged identity headers without redirecting", async () => {
    process.env.DEPLOYMENT_MODE = "cloud";
    process.env.AUTH_PROVIDER = "simple";

    const response = await middleware(
      new NextRequest("http://localhost/accounts/forged.png", {
        headers: { [OWNER_ID_HEADER]: "victim-owner" }
      })
    );

    expect(response.headers.get("location")).toBeNull();
    // Next replaces the request headers with exactly this list; omission is removal.
    const forwardedHeaderNames = response.headers.get("x-middleware-override-headers");
    expect(forwardedHeaderNames).not.toBeNull();
    expect(forwardedHeaderNames).not.toContain(OWNER_ID_HEADER);
    expect(response.headers.get(`x-middleware-request-${OWNER_ID_HEADER}`)).toBeNull();
  });
});
