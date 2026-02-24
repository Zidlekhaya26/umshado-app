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

  // Avoid using Vercel preview URLs or localhost for public invite links.
  // Prefer a canonical production domain when an explicit `NEXT_PUBLIC_APP_URL`
  // is not provided to ensure links recipients can reach them.
  return 'https://umshado.app';
}
