export type Currency = 'ZAR' | 'USD' | 'BWP';

export type ExchangeRates = {
  // rates relative to base currency (ZAR)
  [key in Currency]?: number;
};

const SYMBOL: Record<Currency, string> = {
  ZAR: 'R',
  USD: '$',
  BWP: 'P'
};

const LOCALE: Record<Currency, string> = {
  ZAR: 'en-ZA',
  USD: 'en-US',
  BWP: 'en-BW'
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
 * Budget items are entered by the user in ZAR and must always display in ZAR,
 * regardless of the user's marketplace currency preference.
 */
export function formatBudget(amount: number): string {
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      maximumFractionDigits: 0,
    }).format(amount).replace(/ZAR/, 'R');
  } catch {
    return `R${Math.round(amount).toLocaleString('en-ZA')}`;
  }
}
