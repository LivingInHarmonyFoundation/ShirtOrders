/**
 * @file route.ts
 * @description Public endpoint for applying or removing a discount code on a pending order.
 * No authentication required — customers apply discounts at checkout using their order ID.
 *
 * Key invariants:
 * - Only unpaid (payment_status = 'pending') orders can have a discount applied or removed.
 * - Applying a discount: validates the code (same logic as /api/discount-codes/validate),
 *   calculates discount_amount, and updates total_amount = total_amount - discount_amount.
 * - Removing a discount (discount_code: null): restores total_amount by adding back the
 *   stored discount_amount, then zeroes out discount_code and discount_amount.
 * - Uses createAdminClient() (bypasses RLS) because no user session is present.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// ─── PATCH /api/orders/[id]/discount ─────────────────────────

/**
 * PATCH /api/orders/[id]/discount — apply or remove a discount code on an order.
 * Public endpoint — no auth required.
 * Body: { discount_code: string | null }
 *   - string: apply this discount code (validates it first)
 *   - null: remove the currently applied discount
 * Response: { order: Order } with updated totals
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { discount_code } = await request.json()

  const admin = await createAdminClient()

  // Fetch current order
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, payment_status, total_amount, discount_code, discount_amount, order_items(id, shirt_size, quantity, catalog_item_name, unit_price, subtotal, created_at)')
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.payment_status !== 'pending') {
    return NextResponse.json({ error: 'Cannot apply discount to a paid order' }, { status: 400 })
  }

  // ── Remove discount ────────────────────────────────────────
  if (discount_code === null || discount_code === '') {
    const restoredTotal = (order.total_amount || 0) + (order.discount_amount || 0)

    const { data: updatedRaw, error: updateError } = await admin
      .from('orders')
      .update({
        discount_code: null,
        discount_amount: 0,
        total_amount: restoredTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, order_items(id, shirt_size, quantity, catalog_item_name, unit_price, subtotal, created_at)')
      .single()

    if (updateError) {
      console.error('Error removing discount:', updateError)
      return NextResponse.json({ error: 'Failed to remove discount' }, { status: 500 })
    }

    const { order_items, ...rest } = updatedRaw as typeof updatedRaw & { order_items: unknown[] }
    return NextResponse.json({ order: { ...rest, items: order_items || [] } })
  }

  // ── Apply discount ─────────────────────────────────────────
  // Validate the code
  const { data: discountCode, error: codeError } = await admin
    .from('discount_codes')
    .select('id, code, type, value, expires_at, enabled')
    .ilike('code', String(discount_code).trim())
    .maybeSingle()

  if (codeError) {
    console.error('Error looking up discount code:', codeError)
    return NextResponse.json({ error: 'Failed to validate code' }, { status: 500 })
  }

  if (!discountCode) {
    return NextResponse.json({ error: 'Discount code not found' }, { status: 404 })
  }

  if (!discountCode.enabled) {
    return NextResponse.json({ error: 'Code is disabled' }, { status: 400 })
  }

  if (discountCode.expires_at && new Date(discountCode.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Code has expired' }, { status: 400 })
  }

  // If a discount was already applied, first restore the total before applying the new one
  const baseTotal = (order.total_amount || 0) + (order.discount_amount || 0)

  // Calculate discount amount
  let discountAmount: number
  if (discountCode.type === 'percentage') {
    discountAmount = Math.round(baseTotal * (discountCode.value / 100) * 100) / 100
  } else {
    discountAmount = Math.min(discountCode.value, baseTotal)
  }

  const newTotal = Math.max(0, baseTotal - discountAmount)

  const { data: updatedRaw, error: updateError } = await admin
    .from('orders')
    .update({
      discount_code: discountCode.code,
      discount_amount: discountAmount,
      total_amount: newTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, order_items(id, shirt_size, quantity, catalog_item_name, unit_price, subtotal, created_at)')
    .single()

  if (updateError) {
    console.error('Error applying discount:', updateError)
    return NextResponse.json({ error: 'Failed to apply discount' }, { status: 500 })
  }

  const { order_items, ...rest } = updatedRaw as typeof updatedRaw & { order_items: unknown[] }
  return NextResponse.json({ order: { ...rest, items: order_items || [] } })
}
