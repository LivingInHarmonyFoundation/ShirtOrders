/**
 * @file route.ts
 * @description Captures an approved PayPal checkout order. Public endpoint — the
 * customer calls this after approving payment in the PayPal JS SDK.
 *
 * Two inputs:
 * - `{ paypalOrderId, sessionId }` — normal flow ("pay before order"): after a
 *   verified capture, the checkout session is turned into a real `orders` row
 *   that is born PAID. This is the only moment a customer order is created.
 * - `{ paypalOrderId, orderId }`   — legacy: marks an existing pending order paid.
 *
 * Key invariants:
 * - Binds the payment to the thing being paid: reference_id must equal the
 *   session id / order_number, the amount must equal the expected total and the
 *   currency must be USD. The public client id lets anyone build a PayPal order
 *   with an arbitrary reference/amount/currency and hand us its id.
 * - Session path verifies the PayPal order BEFORE capturing, so a mismatch never
 *   moves money; the post-capture check is defence in depth.
 * - Idempotent: a retried capture for a completed session / paid order returns
 *   the same order instead of creating or notifying twice. A session that is
 *   claimed but has no order yet is never captured against again.
 * - Detects the funding source (paypal | card | venmo) and stores it as payment_method.
 * - `getPayPalToken` and `BASE_URL` come from `@/lib/paypal` which is server-only.
 * - Uses `createAdminClient()` (bypasses RLS) because no user session is available.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPayPalToken, BASE_URL } from '@/lib/paypal'
import { sendOrderNotifications } from '@/lib/notifications'
import { getCheckoutSession, isSessionExpired } from '@/lib/checkout'
import { completeSession } from '@/app/api/checkout-sessions/[id]/complete'
import type { PaymentMethod } from '@/types'

interface PayPalAmount { currency_code?: string; value?: string }
interface PayPalUnit {
  reference_id?: string
  amount?: PayPalAmount
  payments?: { captures?: { id?: string; status?: string; amount?: PayPalAmount }[] }
}
interface PayPalOrder {
  status?: string
  payment_source?: Record<string, unknown>
  purchase_units?: PayPalUnit[]
  details?: { issue?: string }[]
}

async function paypalHeaders() {
  const token = await getPayPalToken()
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
}

/** Fetch the PayPal order as it stands (before or after capture). */
async function getPayPalOrder(paypalOrderId: string, headers: Record<string, string>): Promise<PayPalOrder | null> {
  // WHY: encode — the id is client-supplied and lands in a URL sent with the merchant bearer token.
  const res = await fetch(`${BASE_URL}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, { headers })
  const data: PayPalOrder = await res.json()
  return res.ok ? data : null
}

/**
 * Capture the PayPal order. If PayPal says it was already captured (a retried
 * call after a network hiccup), fetch the order instead so the caller can still
 * verify it and finish idempotently.
 */
async function capturePayPal(paypalOrderId: string, headers: Record<string, string>): Promise<PayPalOrder | null> {
  const res = await fetch(`${BASE_URL}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, { method: 'POST', headers })
  const data: PayPalOrder = await res.json()
  if (res.ok && data.status === 'COMPLETED') return data

  if (data.details?.some(d => d.issue === 'ORDER_ALREADY_CAPTURED')) {
    const existing = await getPayPalOrder(paypalOrderId, headers)
    if (existing?.status === 'COMPLETED') return existing
  }

  console.error('PayPal capture error:', data)
  return null
}

/**
 * WHY: the binding check. reference_id was set by create-order (session id or
 * order_number), the amount is the server-priced total, and create-order only
 * ever sends USD — a matching numeric value in another currency is not payment.
 */
function matchesExpected(unit: PayPalUnit | undefined, amount: PayPalAmount | undefined, expectedRef: string, expectedValue: string): boolean {
  return unit?.reference_id === expectedRef && amount?.value === expectedValue && amount?.currency_code === 'USD'
}

function fundingSource(order: PayPalOrder): PaymentMethod {
  const sourceKey = Object.keys(order.payment_source || {})[0]
  return (sourceKey === 'paypal' || sourceKey === 'card' || sourceKey === 'venmo') ? sourceKey : 'paypal'
}

/**
 * POST /api/paypal/capture-order — capture an approved PayPal order. Public endpoint.
 * Body: { paypalOrderId, sessionId } | { paypalOrderId, orderId }
 * Returns { success: true, paymentMethod, orderId } on success.
 */
export async function POST(request: NextRequest) {
  try {
    const { paypalOrderId, orderId, sessionId } = await request.json()
    if (!paypalOrderId || (!orderId && !sessionId)) {
      return NextResponse.json({ error: 'paypalOrderId and sessionId/orderId required' }, { status: 400 })
    }
    const ppId = String(paypalOrderId)

    const admin = await createAdminClient()

    // ── Checkout session → create the order, born paid ──
    if (sessionId) {
      const session = await getCheckoutSession(admin, String(sessionId))
      if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

      if (session.status === 'completed') {
        // Idempotency: retried capture on a finished session.
        if (session.order_id) {
          const { data: done } = await admin.from('orders').select('payment_status, payment_method').eq('id', session.order_id).single()
          if (done?.payment_status === 'paid' || done?.payment_status === 'manual') {
            return NextResponse.json({ success: true, paymentMethod: done.payment_method ?? 'paypal', orderId: session.order_id })
          }
          // WHY: the session became a PENDING (cash) order while the PayPal popup
          // was open. Do not capture (reference is the session, not that order) and
          // do not report success — the order is paid at pickup.
          return NextResponse.json({ error: 'This checkout was already completed with another payment method' }, { status: 409 })
        }
        // WHY: claimed but no order yet — another request is mid-persist, or a paid
        // persist failed and the admin must reconcile. Never capture against it again.
        return NextResponse.json({ error: 'This checkout is already being processed. Please refresh.' }, { status: 409 })
      }
      // WHY: an expired session must not become an order — reject before touching
      // PayPal so nothing is captured (create-order applies the same gate).
      if (isSessionExpired(session)) {
        return NextResponse.json({ error: 'Checkout session expired' }, { status: 410 })
      }

      const expectedValue = Number(session.payload.total_amount).toFixed(2)
      const headers = await paypalHeaders()

      // WHY: verify BEFORE capturing so a mismatch (wrong session, stale total after a
      // discount, foreign currency) is rejected while no money has moved.
      const ppOrder = await getPayPalOrder(ppId, headers)
      const preUnit = ppOrder?.purchase_units?.[0]
      if (!ppOrder || !matchesExpected(preUnit, preUnit?.amount, session.id, expectedValue)) {
        console.error('PayPal order/session mismatch (pre-capture, nothing captured)', {
          sessionId, paypalOrderId: ppId, ref: preUnit?.reference_id, amount: preUnit?.amount, expectedValue,
        })
        return NextResponse.json({ error: 'Payment does not match this order' }, { status: 400 })
      }

      const captureData = await capturePayPal(ppId, headers)
      if (!captureData) return NextResponse.json({ error: 'Payment capture failed' }, { status: 400 })

      const unit = captureData.purchase_units?.[0]
      const capture = unit?.payments?.captures?.[0]
      if (!matchesExpected(unit, capture?.amount, session.id, expectedValue)) {
        console.error('CRITICAL: PayPal captured but capture does not match session', {
          sessionId, paypalOrderId: ppId, captureId: capture?.id, ref: unit?.reference_id, amount: capture?.amount, expectedValue,
        })
        return NextResponse.json({ error: 'Payment does not match this order' }, { status: 400 })
      }

      const paymentMethod = fundingSource(captureData)
      const result = await completeSession(admin, session, {
        payment_status: 'paid',
        payment_method: paymentMethod,
        changed_by: 'paypal',
        paypalOrderId: ppId,
      })
      if (!result.ok) {
        // Money was captured but the order could not be written — make this loud.
        console.error('CRITICAL: PayPal captured but order creation failed', {
          sessionId, paypalOrderId: ppId, captureId: capture?.id, error: result.error,
        })
        return NextResponse.json({ error: result.error }, { status: result.status })
      }

      return NextResponse.json({ success: true, paymentMethod, orderId: result.order.id })
    }

    // ── Legacy: existing pending order ──
    const { data: currentOrder } = await admin.from('orders').select('*').eq('id', orderId).single()
    if (!currentOrder) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // Idempotency: already paid → do not re-process (no duplicate notifications / audit).
    if (currentOrder.payment_status === 'paid') {
      return NextResponse.json({ success: true, paymentMethod: currentOrder.payment_method ?? 'paypal', orderId: currentOrder.id })
    }

    const captureData = await capturePayPal(ppId, await paypalHeaders())
    if (!captureData) return NextResponse.json({ error: 'Payment capture failed' }, { status: 400 })

    const unit = captureData.purchase_units?.[0]
    const capture = unit?.payments?.captures?.[0]
    const expectedValue = Number(currentOrder.total_amount).toFixed(2)
    if (!matchesExpected(unit, capture?.amount, currentOrder.order_number, expectedValue)) {
      console.error('PayPal capture/order mismatch', {
        orderId, paypalOrderId: ppId, captureId: capture?.id, ref: unit?.reference_id,
        expectedRef: currentOrder.order_number, amount: capture?.amount, expectedValue,
      })
      return NextResponse.json({ error: 'Payment does not match this order' }, { status: 400 })
    }

    const paymentMethod = fundingSource(captureData)

    await admin
      .from('orders')
      .update({ payment_status: 'paid', payment_method: paymentMethod, date_paid: new Date().toISOString() })
      .eq('id', orderId)

    await admin.from('audit_logs').insert({
      order_id: orderId,
      field_changed: 'payment_status',
      old_value: currentOrder.payment_status,
      new_value: 'paid',
      changed_by: 'paypal',
    })

    const { data: settings } = await admin
      .from('app_settings')
      .select('admin_phone, sms_notifications_enabled')
      .single()
    if (settings) {
      sendOrderNotifications(currentOrder, settings).catch(e =>
        console.error('Notification error after PayPal capture:', e)
      )
    }

    return NextResponse.json({ success: true, paymentMethod, orderId: currentOrder.id })
  } catch (err) {
    console.error('PayPal capture exception:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
