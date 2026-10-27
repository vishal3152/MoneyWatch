import type { StockTransactionType } from "@/domain/stock-transaction";

export type BatchStockTransactionRow = {
  id: number;
  type: StockTransactionType;
  scripCode: string;
  quantity: string;
  price: string;
  description: string;
  occurredAt: string;
};

export function restoreStockTransactionBatchRows(
  values: Record<string, string>
): BatchStockTransactionRow[] {
  const rowCount = Number(values.rowCount);
  if (!Number.isSafeInteger(rowCount) || rowCount < 1) return [];

  return Array.from({ length: rowCount }, (_, index) => {
    const value = (field: string) => values[`${field}.${index}`] ?? "";
    const type = value("type");

    return {
      id: index + 1,
      type: type === "Sell" ? "Sell" : "Buy",
      scripCode: value("scripCode"),
      quantity: value("quantity"),
      price: value("price"),
      description: value("description"),
      occurredAt: value("occurredAt")
    };
  });
}
