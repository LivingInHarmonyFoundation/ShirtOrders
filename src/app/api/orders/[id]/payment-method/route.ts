/**
 * @file route.ts
 * @description Public endpoint for a customer to record their cash payment intent.
 * No authentication required — a customer selects Cash at checkout, and this endpoint
 * stores the payment_method on their pending order.
 *
 * Key invariants:
 * - Only 'cash' is an allowed payment method via this endpoint; PayPal is handled
 *   by the /api/paypal/* routes.
 * - Only orders still in 'pending' payment_status can be updated; completed or failed
 *   orders return 409.
 * - Uses `createAdminClient()` (bypasses RLS) because no user session is available.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const ALLOWED_METHODS = ['cash'] as const

// ─── POST /api/orders/[id]/payment-method ─────────────────────

/**
 * POST /api/orders/[id]/payment-method — record payment method for a pending order.
 * Public endpoint — no auth required.
 * Body: { payment_method: 'cash' }
 * Returns { success: true } on success or an error response.
 *
 * Note: this endpoint only records intent (cash). Actual PayPal captures go through
 * /api/paypal/capture-order.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { payment_method } = await request.json()

  if (!ALLOWED_METHODS.includes(payment_method)) {
    return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
  }

  const admin = await createAdminClient()

  const { data: order } = await admin
    .from('orders')
    .select('id, payment_status')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.payment_status !== 'pending') {
    return NextResponse.json({ error: 'Order is no longer pending' }, { status: 409 })
  }

  await admin
    .from('orders')
    .update({ payment_method })
    .eq('id', id)

  return NextResponse.json({ success: true })
}
