import { describe, expect, it } from "vitest";

import { canCreateTransfer } from "@/app/transfer-availability";

describe("canCreateTransfer", () => {
  it("requires two distinct Accounts or an Account and an Open Fixed Deposit", () => {
    expect(canCreateTransfer(0, 0)).toBe(false);
    expect(canCreateTransfer(0, 1)).toBe(false);
    expect(canCreateTransfer(1, 0)).toBe(false);
    expect(canCreateTransfer(2, 0)).toBe(true);
    expect(canCreateTransfer(1, 1)).toBe(true);
  });
});
