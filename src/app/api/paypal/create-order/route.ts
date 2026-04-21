/**
 * @file route.ts
 * @description Creates a PayPal checkout order for an existing app order. Public endpoint —
 * no authentication required (the customer calls this when they choose PayPal at checkout).
 *
 * Key invariants:
 * - Only creates a PayPal order for app orders that are still in 'pending' payment_status.
 * - `getPayPalToken` and `BASE_URL` come from `@/lib/paypal` which is server-only —
 *   it contains the PayPal client secret and must never be imported client-side.
 * - Uses `createAdminClient()` (bypasses RLS) because no user session is available.
 * - Returns a `paypalOrderId` that the client passes to the PayPal JS SDK to open the
 *   checkout flow, then submits to /api/paypal/capture-order.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPayPalToken, BASE_URL } from '@/lib/paypal'

// ─── POST /api/paypal/create-order ───────────────────────────

/**
 * POST /api/paypal/create-order — create a PayPal checkout order. Public endpoint.
 * Body: { orderId: string }  (our internal order UUID)
 * Returns { paypalOrderId: string } — the PayPal order ID to pass to the JS SDK.
 */
export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json()
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

    const admin = await createAdminClient()

    // Verify the order exists and is still awaiting payment
    const { data: order } = await admin
      .from('orders')
      .select('id, total_amount, order_number, payment_status')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.payment_status !== 'pending') {
      return NextResponse.json({ error: 'Order is no longer pending' }, { status: 409 })
    }

    const token = await getPayPalToken()

    const res = await fetch(`${BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: order.order_number,
          amount: {
            currency_code: 'USD',
            value: Number(order.total_amount).toFixed(2),
          },
        }],
      }),
    })

    const paypalOrder = await res.json()
    if (!res.ok || !paypalOrder.id) {
      console.error('PayPal create-order error:', paypalOrder)
      return NextResponse.json({ error: 'Failed to create PayPal order' }, { status: 500 })
    }

    return NextResponse.json({ paypalOrderId: paypalOrder.id })
  } catch (err) {
    console.error('PayPal create-order exception:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
