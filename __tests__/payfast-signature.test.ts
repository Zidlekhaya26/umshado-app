/**
 * PayFast signature verification tests
 *
 * The verifySignature function is the critical security check on the webhook.
 * A wrong implementation lets anyone fake a payment completion.
 */

import crypto from 'crypto';

// Extracted from app/api/vendor/billing/webhook/route.ts (pure function, no side effects)
function verifySignature(
  data: Record<string, string>,
  passphrase: string,
  signature: string,
): boolean {
  const filtered = { ...data };
  delete filtered.signature;
  const paramString = Object.entries(filtered)
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
    .join('&');
  const withPassphrase = passphrase
    ? `${paramString}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`
    : paramString;
  const computed = crypto.createHash('md5').update(withPassphrase).digest('hex');
  return computed === signature;
}

function makeSignature(data: Record<string, string>, passphrase: string): string {
  const paramString = Object.entries(data)
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
    .join('&');
  const withPassphrase = passphrase
    ? `${paramString}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`
    : paramString;
  return crypto.createHash('md5').update(withPassphrase).digest('hex');
}

const PASSPHRASE = 'test-passphrase';

const SAMPLE_PARAMS: Record<string, string> = {
  merchant_id: '12345678',
  merchant_key: 'abc123',
  m_payment_id: 'intent-uuid-123',
  amount: '49.99',
  item_name: 'uMshado Pro Subscription',
  payment_status: 'COMPLETE',
  pf_payment_id: 'pf_111',
  custom_str1: 'vendor-uuid',
  custom_str2: 'pro',
};

describe('PayFast signature verification', () => {
  it('accepts a valid signature with passphrase', () => {
    const sig = makeSignature(SAMPLE_PARAMS, PASSPHRASE);
    expect(verifySignature({ ...SAMPLE_PARAMS, signature: sig }, PASSPHRASE, sig)).toBe(true);
  });

  it('accepts a valid signature without passphrase', () => {
    const sig = makeSignature(SAMPLE_PARAMS, '');
    expect(verifySignature({ ...SAMPLE_PARAMS, signature: sig }, '', sig)).toBe(true);
  });

  it('rejects a tampered amount', () => {
    const sig = makeSignature(SAMPLE_PARAMS, PASSPHRASE);
    const tampered = { ...SAMPLE_PARAMS, amount: '0.01', signature: sig };
    expect(verifySignature(tampered, PASSPHRASE, sig)).toBe(false);
  });

  it('rejects a tampered payment status', () => {
    const sig = makeSignature(SAMPLE_PARAMS, PASSPHRASE);
    const tampered = { ...SAMPLE_PARAMS, payment_status: 'FAILED', signature: sig };
    expect(verifySignature(tampered, PASSPHRASE, sig)).toBe(false);
  });

  it('rejects a completely fabricated signature', () => {
    const fakeSig = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    expect(verifySignature({ ...SAMPLE_PARAMS, signature: fakeSig }, PASSPHRASE, fakeSig)).toBe(false);
  });

  it('rejects wrong passphrase', () => {
    const sig = makeSignature(SAMPLE_PARAMS, PASSPHRASE);
    expect(verifySignature({ ...SAMPLE_PARAMS, signature: sig }, 'wrong-passphrase', sig)).toBe(false);
  });

  it('ignores the signature field itself when computing hash', () => {
    const sig = makeSignature(SAMPLE_PARAMS, PASSPHRASE);
    // Params with signature field included — should still verify correctly
    const withSig = { ...SAMPLE_PARAMS, signature: sig };
    expect(verifySignature(withSig, PASSPHRASE, sig)).toBe(true);
  });
});
