import type { NextConfig } from "next";

/**
 * Security response headers applied to every route. These are defense-in-depth:
 * - X-Frame-Options / frame-ancestors: block clickjacking (esp. /admin/login).
 * - X-Content-Type-Options: stop MIME sniffing.
 * - Referrer-Policy: don't leak full URLs to third parties.
 * - Permissions-Policy: disable powerful APIs the app never uses.
 * - HSTS: force HTTPS for a year (Netlify already serves HTTPS).
 * CSP is intentionally report-friendly and allows the inline/eval that Next.js +
 * the PayPal SDK require; tighten later with nonces if needed.
 */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
};

export default nextConfig;
