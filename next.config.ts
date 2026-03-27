import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : '';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' ${supabaseHostname ? `https://${supabaseHostname}` : ''} data: blob:`,
      "font-src 'self'",
      // Added Sentry ingest endpoints to connect-src
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co${supabaseHostname ? ` https://${supabaseHostname}` : ''} https://*.ingest.sentry.io https://*.ingest.us.sentry.io`,
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za",
      "base-uri 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [{ protocol: 'https', hostname: supabaseHostname, pathname: '/storage/v1/object/public/**' }]
      : [],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default withSentryConfig(nextConfig, {
  org: "umshado",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    // Automatically instrument server components, route handlers, etc.
    autoInstrumentServerFunctions: true,
    // Tree-shake Sentry debug code in production
    treeshake: { removeDebugLogging: true },
  },
  // Don't affect bundle size with source map uploads in local dev
  sourcemaps: {
    disable: process.env.NODE_ENV !== 'production',
  },
});
