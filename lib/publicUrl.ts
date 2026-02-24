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

  // Avoid using Vercel preview URLs as public invite links — prefer a
  // canonical production domain when NODE_ENV=production, otherwise
  // fall back to localhost for development.
  if (process.env.NODE_ENV === 'production') return 'https://umshado.app';
  return 'http://localhost:3000';
}
