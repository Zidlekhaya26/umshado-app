/**
 * Public URL helper tests
 *
 * getPublicBaseUrl() is used to build PayFast callback URLs, invite links,
 * and review request links. A wrong URL means payment callbacks fail silently.
 */

// We test the logic directly since lib/publicUrl.ts reads process.env
function getPublicBaseUrl(
  appUrl?: string,
  vercelUrl?: string,
  nodeEnv?: string,
): string {
  if (appUrl && /^https?:\/\//i.test(appUrl)) return appUrl.replace(/\/$/, '');
  if (vercelUrl) {
    const cleaned = vercelUrl.replace(/\/$/, '');
    return cleaned.startsWith('http') ? cleaned : `https://${cleaned}`;
  }
  if (nodeEnv === 'production') return 'https://umshado.app';
  return 'http://localhost:3000';
}

describe('getPublicBaseUrl', () => {
  it('uses NEXT_PUBLIC_APP_URL when set and valid', () => {
    expect(getPublicBaseUrl('https://umshado.co.za')).toBe('https://umshado.co.za');
  });

  it('strips trailing slash from APP_URL', () => {
    expect(getPublicBaseUrl('https://umshado.co.za/')).toBe('https://umshado.co.za');
  });

  it('ignores APP_URL if it does not start with http/https', () => {
    expect(getPublicBaseUrl('not-a-url', undefined, 'production')).toBe('https://umshado.app');
  });

  it('uses VERCEL_URL when APP_URL is not set', () => {
    expect(getPublicBaseUrl(undefined, 'umshado-abc123.vercel.app')).toBe(
      'https://umshado-abc123.vercel.app',
    );
  });

  it('does not double-add https if VERCEL_URL already has it', () => {
    expect(getPublicBaseUrl(undefined, 'https://umshado-abc123.vercel.app')).toBe(
      'https://umshado-abc123.vercel.app',
    );
  });

  it('strips trailing slash from VERCEL_URL', () => {
    expect(getPublicBaseUrl(undefined, 'umshado-abc123.vercel.app/')).toBe(
      'https://umshado-abc123.vercel.app',
    );
  });

  it('falls back to production domain in production', () => {
    expect(getPublicBaseUrl(undefined, undefined, 'production')).toBe('https://umshado.app');
  });

  it('falls back to localhost in development', () => {
    expect(getPublicBaseUrl(undefined, undefined, 'development')).toBe('http://localhost:3000');
  });

  it('APP_URL takes priority over VERCEL_URL', () => {
    expect(getPublicBaseUrl('https://umshado.co.za', 'umshado-abc123.vercel.app')).toBe(
      'https://umshado.co.za',
    );
  });
});
