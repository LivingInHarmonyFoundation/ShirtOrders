/**
 * @file route.ts
 * @description Customer commits to paying CASH at pickup. This is the one path
 * where an unpaid `orders` row is still created — deliberately, because the
 * admin needs the order number to collect against. It only happens on an
 * explicit button press ("Pagar en efectivo"), never on merely reaching checkout.
 *
 * Key invariants:
 * - Cash must be allowed for this session (entity restrictions + per-type cash
 *   toggles, via the shared isCashAllowed rule), checked server-side — the
 *   button being hidden is not a security boundary.
 * - Order is created with payment_status 'pending' + payment_method 'cash'.
 * - Same 2-minute duplicate guard and stock-race rejection the old endpoint had.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCheckoutSession, isSessionExpired } from '@/lib/checkout'
import { isCashAllowed } from '@/lib/utils'
import { completeSession } from '../complete'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await createAdminClient()

  const session = await getCheckoutSession(admin, id)
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (session.status === 'completed' && session.order_id) {
    const { data: order } = await admin.from('orders').select('*').eq('id', session.order_id).single()
    return NextResponse.json({ order })
  }
  if (isSessionExpired(session)) return NextResponse.json({ error: 'Checkout session expired' }, { status: 410 })

  const p = session.payload
  // WHY: re-derive cash availability server-side with the exact rule the checkout
  // page uses to show the button; a crafted request must not bypass it.
  const { data: settings } = await admin
    .from('app_settings')
    .select('cash_enabled_school, cash_enabled_government, cash_enabled_private_company')
    .single()
  if (!isCashAllowed(p.institution_type, p.order_allowed_payment_methods, settings)) {
    return NextResponse.json({ error: 'Cash is not available for this order' }, { status: 403 })
  }

  const result = await completeSession(admin, session, {
    payment_status: 'pending',
    payment_method: 'cash',
    duplicateGuard: true,
    failOnStockRace: true,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json({ order: result.order }, { status: 201 })
}
