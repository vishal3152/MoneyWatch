const CURRENCY_FLAGS: Record<string, { country: string; flag: string }> = {
  AED: { country: "United Arab Emirates", flag: "🇦🇪" },
  USD: { country: "United States", flag: "🇺🇸" },
  INR: { country: "India", flag: "🇮🇳" }
};

export function CurrencyFlag({ currencyCode }: { currencyCode: string }) {
  const currencyFlag = CURRENCY_FLAGS[currencyCode];

  if (!currencyFlag) {
    return (
      <span className="pw-currency-code-badge" aria-hidden="true">
        {currencyCode}
      </span>
    );
  }

  return (
    <span className="pw-currency-flag" aria-hidden="true" title={`${currencyFlag.country} flag`}>
      {currencyFlag.flag}
    </span>
  );
}
