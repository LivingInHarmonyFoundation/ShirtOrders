import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe signature' }, { status: 400 })
  }

  let event: Awaited<ReturnType<typeof stripe.webhooks.constructEventAsync>>

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  if (event.type === 'checkout.session.completed') {
    const session = (event as Stripe.CheckoutSessionCompletedEvent).data.object
    const orderId = session.metadata?.order_id

    if (orderId) {
      const { data: order } = await supabase
        .from('orders')
        .select('id, payment_status')
        .eq('id', orderId)
        .single()

      if (order && order.payment_status !== 'paid') {
        await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            stripe_payment_intent_id: session.payment_intent as string,
            date_paid: new Date().toISOString(),
            order_status: 'processing',
          })
          .eq('id', orderId)

        await supabase.from('audit_logs').insert({
          order_id: orderId,
          field_changed: 'payment_status',
          old_value: order.payment_status,
          new_value: 'paid',
          changed_by: 'stripe_webhook',
        })
      }
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = (event as Stripe.CheckoutSessionExpiredEvent).data.object
    const orderId = session.metadata?.order_id

    if (orderId) {
      await supabase
        .from('orders')
        .update({ payment_status: 'failed' })
        .eq('id', orderId)
        .eq('payment_status', 'pending')
    }
  }

  if (event.type === 'charge.refunded') {
    const charge = (event as Stripe.ChargeRefundedEvent).data.object
    const paymentIntentId = charge.payment_intent as string

    if (paymentIntentId) {
      await supabase
        .from('orders')
        .update({ payment_status: 'refunded' })
        .eq('stripe_payment_intent_id', paymentIntentId)
    }
  }

  return NextResponse.json({ received: true })
}
