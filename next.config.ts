import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : '';

const securityHeaders = [
  // Prevent search engines from following DNS prefetch links; minor privacy improvement
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // Enforce HTTPS for 2 years including subdomains (only effective over HTTPS)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Prevent clickjacking — equivalent to CSP frame-ancestors 'none' for older browsers
  { key: 'X-Frame-Options', value: 'DENY' },
  // Prevent MIME-type sniffing attacks
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Limit referrer information sent to cross-origin destinations
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Restrict browser features not needed by this app
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      // Default to same-origin only
      "default-src 'self'",
      // Next.js requires unsafe-inline (hydration scripts) and unsafe-eval (Turbopack dev HMR)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Tailwind + CSS-in-JS require unsafe-inline styles
      "style-src 'self' 'unsafe-inline'",
      // Images from Supabase Storage, data URIs, and blobs (e.g. camera/file preview)
      `img-src 'self' ${supabaseHostname ? `https://${supabaseHostname}` : ''} data: blob:`,
      // Geist fonts are self-hosted by Next.js (downloaded at build time)
      "font-src 'self'",
      // XHR/fetch: app's own origin + Supabase REST/Realtime
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co${supabaseHostname ? ` https://${supabaseHostname}` : ''}`,
      // Blob URLs for media (e.g. audio/video upload previews)
      "media-src 'self' blob:",
      // Service worker scope
      "worker-src 'self' blob:",
      // Block all iframes — prevents clickjacking (CSP equivalent of X-Frame-Options: DENY)
      "frame-ancestors 'none'",
      // Only allow forms to submit to this app or PayFast payment pages
      "form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za",
      // Prevent base tag hijacking
      "base-uri 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: 'https',
            hostname: supabaseHostname,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
