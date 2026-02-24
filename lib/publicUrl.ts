export function getPublicBaseUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl && /^https?:\/\//i.test(appUrl)) return appUrl.replace(/\/$/, '');

  // If running in a browser, prefer the current origin when it's
  // a stable public domain (not localhost, and not a Vercel preview).
  if (typeof window !== 'undefined') {
    try {
      const origin = window.location.origin.replace(/\/$/, '');
      if (!origin.includes('localhost') && !origin.includes('vercel.app')) return origin;
    } catch (e) {
      // ignore
    }
  }

  // Prefer the configured public URL, then a Vercel-provided domain (useful
  // when deployed on Vercel), then a canonical production domain. This makes
  // invite links use the app's actual deployment domain like
  // `umshado-app.vercel.app` when available.
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    const cleaned = vercelUrl.replace(/\/$/, '');
    return cleaned.startsWith('http') ? cleaned : `https://${cleaned}`;
  }

  // Production fallback
  if (process.env.NODE_ENV === 'production') return 'https://umshado.app';

  // Development fallback
  return 'http://localhost:3000';
}
