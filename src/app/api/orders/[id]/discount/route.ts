/**
 * @file route.ts
 * @description Public endpoint for applying or removing a discount code on a pending order.
 * No authentication required — customers apply discounts at checkout using their order ID.
 *
 * Still needed after "pay before order": pending orders that already exist
 * (cash commitments, older orders paid later via link) are discounted here.
 * New checkouts use /api/checkout-sessions/[id]/discount. Both share the
 * validator in src/lib/discounts.ts.
 *
 * Key invariants:
 * - Only unpaid (payment_status = 'pending') orders can have a discount applied or removed.
 * - Applying: calculates discount_amount and sets total_amount = base − discount_amount.
 * - Removing (discount_code: null): restores total_amount by adding back discount_amount.
 * - Uses createAdminClient() (bypasses RLS) because no user session is present.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { validateDiscountForTarget, computeDiscountAmount } from '@/lib/discounts'

const ORDER_SELECT = '*, order_items(id, shirt_size, quantity, catalog_item_name, unit_price, subtotal, created_at)'

/**
 * PATCH /api/orders/[id]/discount — apply or remove a discount code on an order.
 * Body: { discount_code: string | null }
 * Response: { order: Order } with updated totals
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { discount_code } = await request.json()

  const admin = await createAdminClient()

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, payment_status, total_amount, discount_code, discount_amount, institution_type, school_name, organization_name, company_name')
    .eq('id', id)
    .single()

  if (orderError || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.payment_status !== 'pending') {
    return NextResponse.json({ error: 'Cannot apply discount to a paid order' }, { status: 400 })
  }

  // Pre-discount total (a previously applied discount is restored first)
  const baseTotal = (order.total_amount || 0) + (order.discount_amount || 0)

  let patch: { discount_code: string | null; discount_amount: number; total_amount: number }
  if (discount_code === null || discount_code === '') {
    patch = { discount_code: null, discount_amount: 0, total_amount: baseTotal }
  } else {
    const result = await validateDiscountForTarget(admin, String(discount_code), order)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    const discountAmount = computeDiscountAmount(result.discount, baseTotal)
    patch = { discount_code: result.discount.code, discount_amount: discountAmount, total_amount: Math.max(0, baseTotal - discountAmount) }
  }

  const { data: updatedRaw, error: updateError } = await admin
    .from('orders')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(ORDER_SELECT)
    .single()

  if (updateError || !updatedRaw) {
    console.error('Error updating discount:', updateError)
    return NextResponse.json({ error: 'Failed to apply discount' }, { status: 500 })
  }

  const { order_items, ...rest } = updatedRaw as typeof updatedRaw & { order_items: unknown[] }
  return NextResponse.json({ order: { ...rest, items: order_items || [] } })
}
