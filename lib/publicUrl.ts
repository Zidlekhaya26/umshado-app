export function getPublicBaseUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl && /^https?:\/\//i.test(appUrl)) return appUrl.replace(/\/$/, '');

  // Avoid using Vercel preview URLs as public invite links — they can
  // require extra authentication for preview deployments. If no
  // explicit `NEXT_PUBLIC_APP_URL` is provided, prefer a sensible
  // production domain or localhost for development.
  if (process.env.NODE_ENV === 'production') {
    return 'https://umshado.app';
  }

  // Development fallback
  return 'http://localhost:3000';
}
