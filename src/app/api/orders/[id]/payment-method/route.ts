/**
 * @file route.ts
 * @description Public endpoint for recording a non-PayPal payment choice at checkout.
 * No authentication required — the order UUID is the capability token.
 *
 * Two behaviors:
 * - 'cash': records intent only; the order STAYS pending until the admin collects
 *   the cash and marks it paid.
 * - 'ath_movil': STAFF ORDERS ONLY (enforced server-side). The staff member confirms
 *   in person that the client's ATH Móvil payment was received, so the order is
 *   marked paid immediately (payment_status=paid + date_paid) with audit entries.
 *   Non-staff orders get 403 — this must never let a regular customer self-mark
 *   their order as paid.
 *
 * Key invariants:
 * - Only orders still in 'pending' payment_status can be updated; others return 409.
 * - Uses `createAdminClient()` (bypasses RLS) because no user session is available.
 * - PayPal captures go through /api/paypal/* — never through here.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const ALLOWED_METHODS = ['cash', 'ath_movil'] as const

// ─── POST /api/orders/[id]/payment-method ─────────────────────

/**
 * POST /api/orders/[id]/payment-method — record payment choice for a pending order.
 * Public endpoint — no auth required.
 * Body: { payment_method: 'cash' | 'ath_movil' }
 * Returns { success: true } on success or an error response.
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
    .select('id, payment_status, institution_type')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.payment_status !== 'pending') {
    return NextResponse.json({ error: 'Order is no longer pending' }, { status: 409 })
  }

  if (payment_method === 'ath_movil') {
    // Staff-only: the staff member verifies the ATH transfer in person.
    if (order.institution_type !== 'staff') {
      return NextResponse.json({ error: 'ATH Móvil is only available for staff orders' }, { status: 403 })
    }

    const { error } = await admin
      .from('orders')
      .update({ payment_method: 'ath_movil', payment_status: 'paid', date_paid: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })

    // Audit trail — mirrors what the admin PATCH would have written.
    await admin.from('audit_logs').insert([
      { order_id: id, field_changed: 'payment_status', old_value: 'pending', new_value: 'paid', changed_by: 'staff-checkout' },
      { order_id: id, field_changed: 'payment_method', old_value: null, new_value: 'ath_movil', changed_by: 'staff-checkout' },
    ])

    return NextResponse.json({ success: true })
  }

  // cash — intent only; stays pending until the admin collects
  const { error } = await admin
    .from('orders')
    .update({ payment_method })
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })

  return NextResponse.json({ success: true })
}
