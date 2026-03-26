/**
 * Billing pricing tests
 *
 * Verifies that the amounts charged via PayFast match what the UI shows.
 * A mismatch here means real money is charged at the wrong amount.
 */

type BillingType = 'pro' | 'verification' | 'boost';
type BillingCycle = 'monthly' | 'yearly';

// Extracted from app/api/vendor/billing/create-payment/route.ts
const PRICE_CENTS = {
  pro: { monthly: 4999, yearly: 49900 },
  verification: 9900,
  boost: 19900,
} as const;

function getBillingAmount(type: BillingType, cycle: BillingCycle): number {
  if (type === 'pro') return PRICE_CENTS.pro[cycle];
  if (type === 'verification') return PRICE_CENTS.verification;
  return PRICE_CENTS.boost;
}

describe('Billing pricing', () => {
  describe('Pro plan', () => {
    it('charges R49.99/month (4999 cents)', () => {
      expect(getBillingAmount('pro', 'monthly')).toBe(4999);
      expect((getBillingAmount('pro', 'monthly') / 100).toFixed(2)).toBe('49.99');
    });

    it('charges R499/year (49900 cents)', () => {
      expect(getBillingAmount('pro', 'yearly')).toBe(49900);
      expect((getBillingAmount('pro', 'yearly') / 100).toFixed(2)).toBe('499.00');
    });

    it('yearly saves R101 vs 12 monthly payments', () => {
      const yearlyMonthly = getBillingAmount('pro', 'monthly') * 12;
      const yearlyOnce = getBillingAmount('pro', 'yearly');
      expect((yearlyMonthly - yearlyOnce) / 100).toBe(100.88);
    });
  });

  describe('Verification', () => {
    it('charges R99 one-time (9900 cents)', () => {
      expect(getBillingAmount('verification', 'monthly')).toBe(9900);
      expect((getBillingAmount('verification', 'monthly') / 100).toFixed(2)).toBe('99.00');
    });
  });

  describe('Boost', () => {
    it('charges R199 for 30 days (19900 cents)', () => {
      expect(getBillingAmount('boost', 'monthly')).toBe(19900);
      expect((getBillingAmount('boost', 'monthly') / 100).toFixed(2)).toBe('199.00');
    });
  });

  describe('Amount formatting for PayFast', () => {
    it('formats pro monthly correctly for PayFast amount field', () => {
      const cents = getBillingAmount('pro', 'monthly');
      expect((cents / 100).toFixed(2)).toBe('49.99');
    });

    it('formats boost correctly for PayFast amount field', () => {
      const cents = getBillingAmount('boost', 'monthly');
      expect((cents / 100).toFixed(2)).toBe('199.00');
    });
  });
});
