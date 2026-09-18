/**
 * @file route.ts
 * @description Public endpoint that replaces the old "create a pending order at
 * cart checkout" step. It validates and prices the submission exactly as
 * POST /api/orders used to, but parks the result in `checkout_sessions`
 * instead of `orders`. The `orders` row is only created when the customer
 * actually pays (see /api/paypal/capture-order, /api/checkout-sessions/[id]/ath)
 * or explicitly commits to cash (/api/checkout-sessions/[id]/cash).
 *
 * Key invariants:
 * - No `orders` row is written here, ever.
 * - Sessions expire after 24h (DB default) and are harmless if abandoned.
 * - Rate-limited in src/proxy.ts like the old orders endpoint.
 * - Uses `createAdminClient()` (bypasses RLS) — unauthenticated write path.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { prepareOrder, sessionToOrderView, type CheckoutSessionRow } from '@/lib/checkout'

/**
 * POST /api/checkout-sessions — validate + price a cart and open a checkout session.
 * Body: same shape POST /api/orders accepted.
 * Returns { sessionId, order } (order = checkout view model) with status 201.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const admin = await createAdminClient()

    const result = await prepareOrder(admin, body)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    const { data: session, error } = await admin
      .from('checkout_sessions')
      .insert({
        campaign_id: result.prepared.campaign_id,
        email: result.prepared.email,
        payload: result.prepared,
      })
      .select('*')
      .single()

    if (error || !session) {
      console.error('Error creating checkout session:', error)
      return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 })
    }

    // Housekeeping: abandoned checkouts hold personal data (name, email, phone,
    // address) for people who never became customers. Purge long-expired ones
    // opportunistically — no cron needed, and it never blocks the response.
    admin
      .from('checkout_sessions')
      .delete()
      .eq('status', 'open')
      .lt('expires_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .then(({ error }) => { if (error) console.error('checkout_sessions purge failed:', error) })

    return NextResponse.json(
      { sessionId: session.id, order: sessionToOrderView(session as CheckoutSessionRow) },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
