import { describe, expect, it } from "vitest";

import { restoreStockTransactionBatchRows } from "@/app/stock-transaction-batch-state";

describe("restoreStockTransactionBatchRows", () => {
  it("restores the selected trade type and values for every submitted row", () => {
    expect(restoreStockTransactionBatchRows({
      rowCount: "2",
      "type.0": "Sell",
      "scripCode.0": "MSFT",
      "quantity.0": "4",
      "price.0": "400",
      "description.0": "QA short position",
      "occurredAt.0": "2026-10-24T11:55",
      "type.1": "Buy",
      "scripCode.1": "AAPL",
      "quantity.1": "1",
      "price.1": "12.50",
      "description.1": "Second row",
      "occurredAt.1": "2026-10-23T09:30"
    })).toEqual([
      {
        id: 1,
        type: "Sell",
        scripCode: "MSFT",
        quantity: "4",
        price: "400",
        description: "QA short position",
        occurredAt: "2026-10-24T11:55"
      },
      {
        id: 2,
        type: "Buy",
        scripCode: "AAPL",
        quantity: "1",
        price: "12.50",
        description: "Second row",
        occurredAt: "2026-10-23T09:30"
      }
    ]);
  });
});
