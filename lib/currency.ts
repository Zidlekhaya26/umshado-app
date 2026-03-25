export type Currency = 'ZAR' | 'USD' | 'BWP' | 'GBP' | 'EUR';

export type ExchangeRates = {
  // rates relative to base currency (ZAR)
  [key in Currency]?: number;
};

const SYMBOL: Record<Currency, string> = {
  ZAR: 'R',
  USD: '$',
  BWP: 'P',
  GBP: '£',
  EUR: '€',
};

const LOCALE: Record<Currency, string> = {
  ZAR: 'en-ZA',
  USD: 'en-US',
  BWP: 'en-BW',
  GBP: 'en-GB',
  EUR: 'de-DE',
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
      currency: currency,
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

/**
 * Format a budget amount WITHOUT currency conversion.
 * Budget items are stored in the user's chosen currency at time of entry.
 * We only apply the symbol — no exchange rate math.
 * Falls back to ZAR if no currency is provided.
 */
export function formatBudget(amount: number, currency: Currency = 'ZAR'): string {
  try {
    return new Intl.NumberFormat(LOCALE[currency], {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount).replace(/[A-Z]{3}/, SYMBOL[currency]);
  } catch {
    return `${SYMBOL[currency]}${Math.round(amount).toLocaleString()}`;
  }
}
