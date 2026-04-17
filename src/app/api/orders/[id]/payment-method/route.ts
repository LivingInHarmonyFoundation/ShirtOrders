import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const ALLOWED_METHODS = ['cash'] as const

// Public endpoint — customer calls this when selecting Cash at checkout.
// Scoped to pending orders only; no auth required since it only records intent.
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
