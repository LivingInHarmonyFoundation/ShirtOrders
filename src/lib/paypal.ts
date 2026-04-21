/**
 * @file paypal.ts
 * @description SERVER-ONLY module. Provides helpers for the PayPal REST API.
 *
 * IMPORTANT: Never import this file from client components or pages — it
 * reads PAYPAL_CLIENT_SECRET, which must not be exposed to the browser.
 *
 * Exports: getPayPalToken, BASE_URL.
 *
 * The active environment (sandbox vs. live) is controlled by the
 * NEXT_PUBLIC_PAYPAL_MODE env var ("live" → production endpoint; anything
 * else → sandbox).
 */

// ─── Environment Configuration ────────────────────────────────

/**
 * BASE_URL — PayPal REST API base URL selected by NEXT_PUBLIC_PAYPAL_MODE.
 * Exported so other server modules can construct endpoint URLs without
 * duplicating this logic.
 */
const BASE_URL = process.env.NEXT_PUBLIC_PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

// ─── Authentication ───────────────────────────────────────────

/**
 * getPayPalToken — fetches a short-lived OAuth 2.0 access token from PayPal
 * using the client_credentials grant. Credentials are read from env vars:
 *   - NEXT_PUBLIC_PAYPAL_CLIENT_ID (public client ID)
 *   - PAYPAL_CLIENT_SECRET (secret — server-only)
 *
 * Throws if PayPal does not return an access_token (e.g. invalid credentials
 * or network error). Callers should request a fresh token per API call since
 * tokens are short-lived and not cached here.
 */
export async function getPayPalToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })

  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to obtain PayPal access token')
  return data.access_token
}

export { BASE_URL }
