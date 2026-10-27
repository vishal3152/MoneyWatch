export function canCreateTransfer(accountCount: number, openFixedDepositCount: number): boolean {
  return accountCount > 1 || (accountCount > 0 && openFixedDepositCount > 0);
}
