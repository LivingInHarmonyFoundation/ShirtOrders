/**
 * @file route.ts
 * @description Retired public order-submission endpoint.
 *
 * Until Sep 2026 the cart POSTed here and an `orders` row was created BEFORE
 * payment, which produced hundreds of "pending sin pago" rows and duplicate
 * orders from customers re-ordering instead of paying. Orders are now created
 * only at payment time:
 *   POST /api/checkout-sessions            → validate + price (no order row)
 *   POST /api/paypal/capture-order         → order born paid
 *   POST /api/checkout-sessions/[id]/ath   → staff, order born paid
 *   POST /api/checkout-sessions/[id]/cash  → explicit cash commitment (pending)
 *
 * Kept as a 410 so any stale client bundle gets a clear error instead of a 404.
 * The validation/pricing logic lives in src/lib/checkout.ts.
 */
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint has moved. Please reload the page and try again.' },
    { status: 410 }
  )
}
