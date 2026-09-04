import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// ─── In-memory rate limiter ───────────────────────────────────
// Sliding window per IP. Resets on cold start (acceptable for low-traffic deployments).
// Map: ip → array of request timestamps (ms)
const rateLimitStore = new Map<string, number[]>()

const RATE_LIMITED_ROUTES: Record<string, { limit: number; windowMs: number }> = {
  '/api/orders':                       { limit: 8,  windowMs: 60_000 }, // 8 orders/min
  '/api/discount-codes/validate':      { limit: 15, windowMs: 60_000 }, // 15 checks/min
  '/api/orders/[id]/discount':         { limit: 15, windowMs: 60_000 }, // 15 code applies/min (brute-force guard)
  '/api/paypal/create-order':          { limit: 10, windowMs: 60_000 }, // 10/min
  '/api/paypal/capture-order':         { limit: 10, windowMs: 60_000 }, // 10/min
}

/**
 * Maps a concrete request path to its canonical rate-limit key. Dynamic segments
 * are normalised so e.g. /api/orders/<uuid>/discount collapses to the [id] key.
 */
function rateLimitKeyForPath(pathname: string): string | null {
  if (pathname in RATE_LIMITED_ROUTES) return pathname
  if (/^\/api\/orders\/[^/]+\/discount$/.test(pathname)) return '/api/orders/[id]/discount'
  return null
}

function isRateLimited(ip: string, route: string): boolean {
  const config = RATE_LIMITED_ROUTES[route]
  if (!config) return false

  const key = `${ip}:${route}`
  const now = Date.now()
  const timestamps = (rateLimitStore.get(key) ?? []).filter(t => now - t < config.windowMs)
  timestamps.push(now)
  rateLimitStore.set(key, timestamps)

  // Evict old keys to prevent unbounded growth (keep store under ~5k entries)
  if (rateLimitStore.size > 5000) {
    const oldest = rateLimitStore.keys().next().value
    if (oldest) rateLimitStore.delete(oldest)
  }

  return timestamps.length > config.limit
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ─── Rate limiting on sensitive public endpoints (POST + PATCH) ──
  const rlKey = rateLimitKeyForPath(pathname)
  if (rlKey && (request.method === 'POST' || request.method === 'PATCH')) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'

    if (isRateLimited(ip, rlKey)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        { status: 429 }
      )
    }
  }

  // ─── Auth middleware (admin routes) ──────────────────────────
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAdminRoute = pathname.startsWith('/admin') &&
    !pathname.startsWith('/admin/login')

  if (isAdminRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  // NOTE: deliberately NO redirect away from /admin/login when a session exists.
  // On a shared computer that redirect silently bounced a second admin into the
  // first admin's dashboard, making it look like only one admin could ever log
  // in. The login page itself now shows "signed in as X" with an explicit
  // choice: continue to the dashboard, or sign out and log in as someone else.

  return supabaseResponse
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/orders',
    '/api/orders/:id/discount',
    '/api/discount-codes/validate',
    '/api/paypal/create-order',
    '/api/paypal/capture-order',
  ],
}
