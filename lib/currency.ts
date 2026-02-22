export type Currency = 'ZAR' | 'USD' | 'ZWL';

export type ExchangeRates = {
  // rates relative to base currency (ZAR)
  [key in Currency]?: number;
};

const SYMBOL: Record<Currency, string> = {
  ZAR: 'R',
  USD: '$',
  ZWL: 'Z$'
};

const LOCALE: Record<Currency, string> = {
  ZAR: 'en-ZA',
  USD: 'en-US',
  ZWL: 'en-ZA'
};

export function convertAmount(amountInZar: number, to: Currency, rates?: ExchangeRates) {
  if (!rates || !rates[to]) return amountInZar;
  return amountInZar * rates[to]!;
}

export function formatAmount(amount: number, currency: Currency) {
  // Use Intl.NumberFormat when possible, fall back to manual symbol
  try {
    return new Intl.NumberFormat(LOCALE[currency], {
      style: 'currency',
      currency: currency === 'ZWL' ? 'USD' : currency, // ZWL often unsupported; format with symbol fallback
      maximumFractionDigits: 0
    }).format(amount).replace(/[A-Z]{3}/, SYMBOL[currency]);
  } catch (e) {
    return `${SYMBOL[currency]}${Math.round(amount).toLocaleString()}`;
  }
}

export function formatPrice(amountInZar: number, currency: Currency, rates?: ExchangeRates) {
  const converted = convertAmount(amountInZar, currency, rates);
  return formatAmount(converted, currency);
}
