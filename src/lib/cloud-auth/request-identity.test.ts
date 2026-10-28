import { describe, expect, it } from "vitest";

import {
  OWNER_EMAIL_HEADER,
  OWNER_ID_HEADER,
  readRequestIdentity,
  withVerifiedRequestIdentity
} from "@/lib/cloud-auth/request-identity";

describe("withVerifiedRequestIdentity", () => {
  it("overwrites identity headers supplied by the client", () => {
    const incoming = new Headers({
      [OWNER_ID_HEADER]: "forged-owner",
      [OWNER_EMAIL_HEADER]: "attacker@example.com",
      accept: "text/x-component"
    });

    const forwarded = withVerifiedRequestIdentity(incoming, {
      ownerId: "verified-owner",
      email: "owner@example.com"
    });

    expect(readRequestIdentity(forwarded)).toEqual({
      ownerId: "verified-owner",
      email: "owner@example.com"
    });
    expect(forwarded.get("accept")).toBe("text/x-component");
  });

  it("round-trips emails outside the header byte range", () => {
    const forwarded = withVerifiedRequestIdentity(new Headers(), {
      ownerId: "verified-owner",
      email: "अमित@example.com"
    });

    expect(readRequestIdentity(forwarded)).toEqual({
      ownerId: "verified-owner",
      email: "अमित@example.com"
    });
  });

  it("strips client identity headers when no session was verified", () => {
    const incoming = new Headers({
      [OWNER_ID_HEADER]: "forged-owner",
      [OWNER_EMAIL_HEADER]: "attacker@example.com"
    });

    expect(readRequestIdentity(withVerifiedRequestIdentity(incoming, null))).toBeNull();
  });
});
