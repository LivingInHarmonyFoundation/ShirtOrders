/**
 * @file route.ts
 * @description Captures an approved PayPal checkout order and marks the app order as paid.
 * Public endpoint — the customer calls this after approving payment in the PayPal JS SDK.
 *
 * Key invariants:
 * - Detects the funding source (paypal | card | venmo) from the PayPal capture response
 *   and stores it as payment_method on the order.
 * - Writes an audit_log entry recording the payment_status transition.
 * - Fires order notifications (ntfy.sh) after capture; failure is non-fatal.
 * - `getPayPalToken` and `BASE_URL` come from `@/lib/paypal` which is server-only —
 *   it contains the PayPal client secret and must never be imported client-side.
 * - Uses `createAdminClient()` (bypasses RLS) because no user session is available.
 * - `admin_phone` in app_settings is an ntfy.sh topic name, not a phone number.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPayPalToken, BASE_URL } from '@/lib/paypal'
import { sendOrderNotifications } from '@/lib/notifications'
import type { PaymentMethod } from '@/types'

// ─── POST /api/paypal/capture-order ──────────────────────────

/**
 * POST /api/paypal/capture-order — capture an approved PayPal order. Public endpoint.
 * Body: { paypalOrderId: string, orderId: string }
 * Returns { success: true, paymentMethod: PaymentMethod } on success.
 */
export async function POST(request: NextRequest) {
  try {
    const { paypalOrderId, orderId } = await request.json()
    if (!paypalOrderId || !orderId) {
      return NextResponse.json({ error: 'paypalOrderId and orderId required' }, { status: 400 })
    }

    const token = await getPayPalToken()

    // Capture the approved PayPal order
    const res = await fetch(`${BASE_URL}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const captureData = await res.json()

    if (!res.ok || captureData.status !== 'COMPLETED') {
      console.error('PayPal capture error:', captureData)
      return NextResponse.json({ error: 'Payment capture failed' }, { status: 400 })
    }

    // Determine funding source (paypal | card | venmo) from PayPal response
    const paymentSource = captureData.payment_source || {}
    const sourceKey = Object.keys(paymentSource)[0] as PaymentMethod | undefined
    const paymentMethod: PaymentMethod = (sourceKey === 'paypal' || sourceKey === 'card' || sourceKey === 'venmo')
      ? sourceKey
      : 'paypal'

    const admin = await createAdminClient()

    // Fetch current order for audit log
    const { data: currentOrder } = await admin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (!currentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Mark order as paid
    await admin
      .from('orders')
      .update({
        payment_status: 'paid',
        payment_method: paymentMethod,
        date_paid: new Date().toISOString(),
      })
      .eq('id', orderId)

    // Audit log
    await admin.from('audit_logs').insert({
      order_id: orderId,
      field_changed: 'payment_status',
      old_value: currentOrder.payment_status,
      new_value: 'paid',
      changed_by: 'paypal',
    })

    // Fetch settings for notifications
    const { data: settings } = await admin
      .from('app_settings')
      .select('admin_phone, sms_notifications_enabled')
      .single()

    if (settings) {
      sendOrderNotifications(currentOrder, settings).catch(e =>
        console.error('Notification error after PayPal capture:', e)
      )
    }

    return NextResponse.json({ success: true, paymentMethod })
  } catch (err) {
    console.error('PayPal capture exception:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
