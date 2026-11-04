// Decimal places per ISO currency code. Only exceptions are listed here;
// every other currency defaults to 2 (paise/cents) below.
const MINOR_UNIT_EXPONENTS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3
};

// Exponent for converting between minor and major units: major =
// minor / 10 ** exponent. Unknown codes assume 2 rather than throwing,
// so display math never crashes on a new currency.
export function getMinorUnitExponent(currencyCode: string): number {
  return MINOR_UNIT_EXPONENTS[currencyCode] ?? 2;
}
