/**
 * @file route.ts
 * @description GET a checkout session for the checkout page. Public — the
 * session UUID is the capability token (only the browser that created it has
 * it). Returns the same view-model shape as /api/orders/[id] so the checkout
 * page renders sessions and legacy pending orders with one component.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCheckoutSession, isSessionExpired, sessionToOrderView } from '@/lib/checkout'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await createAdminClient()
  const session = await getCheckoutSession(admin, id)
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const open = session.status === 'open'
  const expired = open && isSessionExpired(session)

  return NextResponse.json({
    session: {
      id: session.id,
      status: session.status,
      order_id: session.order_id,
      expired,
      expires_at: session.expires_at,
    },
    // WHY: the payload (name, email, phone, address, school grade/classroom) is only
    // needed to render an open, unexpired checkout. Completed sessions redirect to
    // the receipt and expired ones show a "start over" card — hand out nothing else.
    order: open && !expired ? sessionToOrderView(session) : null,
  })
}
