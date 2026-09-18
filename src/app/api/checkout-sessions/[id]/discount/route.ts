/**
 * @file route.ts
 * @description Apply or remove a discount code on an OPEN checkout session.
 * Public — the session UUID is the capability token. Same rules as the legacy
 * /api/orders/[id]/discount (shared validator in src/lib/discounts.ts); the
 * difference is that nothing is written to `orders` — only the session payload
 * totals change, and PayPal create-order reads the discounted total from there.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCheckoutSession, isSessionExpired, sessionToOrderView, withDiscount, type CheckoutSessionRow } from '@/lib/checkout'
import { validateDiscountForTarget, computeDiscountAmount } from '@/lib/discounts'

/**
 * PATCH /api/checkout-sessions/[id]/discount
 * Body: { discount_code: string | null }  (null/'' removes the discount)
 * Response: { order } — refreshed checkout view model
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { discount_code } = await request.json()

  const admin = await createAdminClient()
  const session = await getCheckoutSession(admin, id)
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (session.status !== 'open') return NextResponse.json({ error: 'Cannot apply discount to a completed order' }, { status: 400 })
  if (isSessionExpired(session)) return NextResponse.json({ error: 'Checkout session expired' }, { status: 410 })

  let payload = session.payload
  if (discount_code === null || discount_code === '') {
    payload = withDiscount(payload, null)
  } else {
    const result = await validateDiscountForTarget(admin, String(discount_code), payload)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    payload = withDiscount(payload, {
      code: result.discount.code,
      amount: computeDiscountAmount(result.discount, payload.base_total),
    })
  }

  const { data: updated, error } = await admin
    .from('checkout_sessions')
    .update({ payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'open')
    // WHY: optimistic lock — if the session changed since we read it (a concurrent
    // discount call or a completion claim) do not overwrite it; the client re-reads.
    .eq('updated_at', session.updated_at)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('Error updating session discount:', error)
    return NextResponse.json({ error: 'Failed to apply discount' }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: 'Checkout changed, please refresh and try again' }, { status: 409 })
  }

  return NextResponse.json({ order: sessionToOrderView(updated as CheckoutSessionRow) })
}
