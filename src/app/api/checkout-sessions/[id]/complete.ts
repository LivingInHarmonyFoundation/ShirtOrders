/**
 * @file complete.ts
 * @description Shared "turn this session into an order" step used by the
 * cash, ATH and PayPal-capture routes. Claims the session atomically
 * (status open → completed) BEFORE inserting the order so two concurrent
 * completions (double-tap, retried capture) can never create two orders.
 *
 * On a claim miss we wait briefly for the winner to attach its order_id and
 * return that same order (idempotent response).
 *
 * Failure handling depends on whether money has moved:
 * - pending (cash): nothing was charged → release the claim so the customer
 *   can retry (e.g. after a stock race).
 * - paid (PayPal / ATH): keep the session claimed. Re-opening it would let the
 *   customer be charged a second time; the admin reconciles from the stored
 *   paypal_order_id and the CRITICAL log line instead.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { persistOrder, type CheckoutSessionRow, type PersistOptions, type PersistResult } from '@/lib/checkout'
import { sendPaymentWithoutOrderAlert } from '@/lib/notifications'

export async function completeSession(
  admin: SupabaseClient,
  session: CheckoutSessionRow,
  opts: PersistOptions & {
    /** Captured PayPal order id — written with the claim so a failed persist still leaves a handle to the money. */
    paypalOrderId?: string
  },
): Promise<PersistResult> {
  // Atomic claim
  const { data: claimed } = await admin
    .from('checkout_sessions')
    .update({
      status: 'completed',
      updated_at: new Date().toISOString(),
      ...(opts.paypalOrderId ? { paypal_order_id: opts.paypalOrderId } : {}),
    })
    .eq('id', session.id)
    .eq('status', 'open')
    .select('id')
    .maybeSingle()

  if (!claimed) {
    // Someone else is completing (or completed) this session — return its order.
    // persistOrder (insert + items + inventory RPCs) can take >1s; give the
    // winner up to 2s before telling the loser to refresh.
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: row } = await admin
        .from('checkout_sessions')
        .select('order_id')
        .eq('id', session.id)
        .maybeSingle()
      if (row?.order_id) {
        const { data: order } = await admin.from('orders').select('*').eq('id', row.order_id).single()
        if (!order) continue
        // WHY: cash-vs-PayPal race — the customer pressed "cash" (winner: pending
        // order) and approved PayPal a moment later (loser: money already captured).
        // The money is real, so the winner's order becomes PAID by the loser's method.
        if (opts.payment_status === 'paid' && order.payment_status === 'pending') {
          const nowIso = new Date().toISOString()
          const { data: paid } = await admin
            .from('orders')
            .update({ payment_status: 'paid', payment_method: opts.payment_method, date_paid: nowIso })
            .eq('id', order.id)
            .eq('payment_status', 'pending')
            .select('*')
            .maybeSingle()
          if (paid) {
            await admin.from('audit_logs').insert([
              { order_id: order.id, field_changed: 'payment_status', old_value: 'pending', new_value: 'paid', changed_by: opts.changed_by ?? 'system' },
              { order_id: order.id, field_changed: 'payment_method', old_value: order.payment_method, new_value: opts.payment_method, changed_by: opts.changed_by ?? 'system' },
            ])
            if (opts.paypalOrderId) await admin.from('checkout_sessions').update({ paypal_order_id: opts.paypalOrderId }).eq('id', session.id)
            return { ok: true, order: paid }
          }
        }
        return { ok: true, order }
      }
      await new Promise(r => setTimeout(r, 400))
    }
    return { ok: false, error: 'This checkout is already being processed. Please refresh.', status: 409 }
  }

  let result: PersistResult
  try {
    result = await persistOrder(admin, session.payload, opts)
  } catch (e) {
    // WHY: a transport error (not a returned {error}) must take the same failure
    // path, otherwise the session is left claimed with nobody handling it.
    console.error('persistOrder threw:', e)
    result = { ok: false, error: 'Failed to create order', status: 500 }
  }

  if (!result.ok) {
    if (opts.payment_status === 'pending') {
      // WHY: nothing was charged — release the claim so the customer can retry.
      await admin.from('checkout_sessions').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', session.id)
    } else {
      // WHY: money is already captured — keep it claimed so no second charge can
      // happen against this session; create-order/capture both refuse a claimed session.
      const paypalOrderId = opts.paypalOrderId ?? session.paypal_order_id
      console.error('CRITICAL: paid session left claimed without an order — reconcile manually', {
        sessionId: session.id, paypalOrderId, error: result.error,
      })
      // The admin has no order row to notice — push an urgent alert instead.
      const { data: settings } = await admin.from('app_settings').select('admin_phone, sms_notifications_enabled').single()
      await sendPaymentWithoutOrderAlert(
        { sessionId: session.id, paypalOrderId, fullName: session.payload.full_name, email: session.payload.email, totalAmount: session.payload.total_amount, reason: result.error },
        settings ?? {}
      )
    }
    return result
  }

  await admin
    .from('checkout_sessions')
    .update({ order_id: result.order.id, updated_at: new Date().toISOString() })
    .eq('id', session.id)

  return result
}
