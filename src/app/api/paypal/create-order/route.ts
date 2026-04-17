import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPayPalToken, BASE_URL } from '@/lib/paypal'

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
