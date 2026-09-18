/**
 * @file route.ts
 * @description STAFF ORDERS ONLY. The staff member confirms in person that the
 * client's ATH Móvil transfer was received; the order is created already PAID
 * (payment_method ath_movil, date_paid now) with audit entries.
 *
 * Non-staff sessions get 403 — a regular customer must never be able to create
 * a paid order without money going through PayPal.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCheckoutSession, isSessionExpired } from '@/lib/checkout'
import { completeSession } from '../complete'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await createAdminClient()

  const session = await getCheckoutSession(admin, id)
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (session.payload.institution_type !== 'staff') {
    return NextResponse.json({ error: 'ATH Móvil is only available for staff orders' }, { status: 403 })
  }
  if (session.status === 'completed' && session.order_id) {
    const { data: order } = await admin.from('orders').select('*').eq('id', session.order_id).single()
    return NextResponse.json({ order })
  }
  if (isSessionExpired(session)) return NextResponse.json({ error: 'Checkout session expired' }, { status: 410 })

  const result = await completeSession(admin, session, {
    payment_status: 'paid',
    payment_method: 'ath_movil',
    changed_by: 'staff-checkout',
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json({ order: result.order }, { status: 201 })
}
