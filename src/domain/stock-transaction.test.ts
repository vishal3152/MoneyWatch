import { describe, expect, it } from "vitest";

import {
  InvalidStockQuantityError,
  parseWholeShareQuantity
} from "@/domain/stock-transaction";

describe("parseWholeShareQuantity", () => {
  it("parses a positive whole-number string", () => {
    expect(parseWholeShareQuantity("10")).toBe(10);
  });

  it("accepts the largest safe whole-share quantity", () => {
    expect(parseWholeShareQuantity("9007199254740991")).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("rejects a quantity outside the safe integer range", () => {
    expect(() => parseWholeShareQuantity("9007199254740993")).toThrow(InvalidStockQuantityError);
  });

  it("rejects zero", () => {
    expect(() => parseWholeShareQuantity("0")).toThrow(InvalidStockQuantityError);
  });

  it("rejects a fractional quantity", () => {
    expect(() => parseWholeShareQuantity("10.5")).toThrow(InvalidStockQuantityError);
  });

  it("rejects a negative quantity", () => {
    expect(() => parseWholeShareQuantity("-10")).toThrow(InvalidStockQuantityError);
  });

  it("rejects non-numeric input", () => {
    expect(() => parseWholeShareQuantity("ten")).toThrow(InvalidStockQuantityError);
  });
});
