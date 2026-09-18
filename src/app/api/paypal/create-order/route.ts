/**
 * @file route.ts
 * @description Creates a PayPal checkout order. Public endpoint — no authentication
 * required (the customer calls this when they choose PayPal at checkout).
 *
 * Two inputs are accepted:
 * - `{ sessionId }` — the normal flow since "pay before order": the amount comes
 *   from the checkout session's server-priced payload and reference_id is the
 *   session id. No `orders` row exists yet.
 * - `{ orderId }`  — legacy: a pending `orders` row (older orders paid later via
 *   the emailed link / resume banner). reference_id is the order_number.
 *
 * Key invariants:
 * - `getPayPalToken` and `BASE_URL` come from `@/lib/paypal` which is server-only —
 *   it contains the PayPal client secret and must never be imported client-side.
 * - Uses `createAdminClient()` (bypasses RLS) because no user session is available.
 * - Returns a `paypalOrderId` that the client passes to the PayPal JS SDK to open the
 *   checkout flow, then submits to /api/paypal/capture-order.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPayPalToken, BASE_URL } from '@/lib/paypal'
import { getCheckoutSession, isSessionExpired } from '@/lib/checkout'

async function createPayPalOrder(referenceId: string, amount: number): Promise<string | null> {
  const token = await getPayPalToken()
  const res = await fetch(`${BASE_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: referenceId,
        amount: { currency_code: 'USD', value: Number(amount).toFixed(2) },
      }],
    }),
  })
  const paypalOrder = await res.json()
  if (!res.ok || !paypalOrder.id) {
    console.error('PayPal create-order error:', paypalOrder)
    return null
  }
  return paypalOrder.id as string
}

/**
 * POST /api/paypal/create-order — create a PayPal checkout order. Public endpoint.
 * Body: { sessionId: string } | { orderId: string }
 * Returns { paypalOrderId: string } — the PayPal order ID to pass to the JS SDK.
 */
export async function POST(request: NextRequest) {
  try {
    const { orderId, sessionId } = await request.json()
    if (!orderId && !sessionId) return NextResponse.json({ error: 'sessionId or orderId required' }, { status: 400 })

    const admin = await createAdminClient()

    // ── Checkout session (no order row yet) ──
    if (sessionId) {
      const session = await getCheckoutSession(admin, String(sessionId))
      if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      if (session.status !== 'open') return NextResponse.json({ error: 'Checkout already completed' }, { status: 409 })
      if (isSessionExpired(session)) return NextResponse.json({ error: 'Checkout session expired' }, { status: 410 })
      if (!(session.payload.total_amount > 0)) return NextResponse.json({ error: 'Nothing to charge' }, { status: 400 })

      const paypalOrderId = await createPayPalOrder(session.id, session.payload.total_amount)
      if (!paypalOrderId) return NextResponse.json({ error: 'Failed to create PayPal order' }, { status: 500 })

      // Diagnostics only — the capture step binds by reference_id + amount.
      await admin.from('checkout_sessions').update({ paypal_order_id: paypalOrderId }).eq('id', session.id)
      return NextResponse.json({ paypalOrderId })
    }

    // ── Legacy: existing pending order ──
    const { data: order } = await admin
      .from('orders')
      .select('id, total_amount, order_number, payment_status')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.payment_status !== 'pending') {
      return NextResponse.json({ error: 'Order is no longer pending' }, { status: 409 })
    }

    const paypalOrderId = await createPayPalOrder(order.order_number, order.total_amount)
    if (!paypalOrderId) return NextResponse.json({ error: 'Failed to create PayPal order' }, { status: 500 })
    return NextResponse.json({ paypalOrderId })
  } catch (err) {
    console.error('PayPal create-order exception:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
