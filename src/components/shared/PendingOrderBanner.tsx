/**
 * @file PendingOrderBanner.tsx
 * @description "Resume payment" banner. When a customer creates an order, its id is
 * remembered in localStorage (this device only). If they come back to an order page
 * while that order is still unpaid (and not a committed cash order), this banner
 * offers to jump straight back to its checkout — instead of them re-filling the
 * form and creating a duplicate pending order.
 *
 * Key invariants:
 * - Renders nothing until the order is confirmed unpaid via /api/orders/[id].
 * - Clears itself when the order is paid, cancelled, cash-committed, or missing.
 * - Storage is device-local; there is deliberately NO email/order lookup here
 *   (that would let strangers pull up someone else's order details).
 */
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, ArrowRight, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useT } from '@/contexts/LanguageContext'

const STORAGE_KEY = 'lih_pending_order'

/** Remember a just-created order so the customer can resume its payment later. */
export function rememberPendingOrder(orderId: string) {
  try { localStorage.setItem(STORAGE_KEY, orderId) } catch { /* private mode */ }
}

/** Forget the remembered order (after payment, cash commitment, or dismissal). */
export function clearPendingOrder() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* private mode */ }
}

/** Forget the remembered order only if it matches (confirmation-page safety net). */
export function clearPendingOrderIf(orderId: string) {
  try {
    if (localStorage.getItem(STORAGE_KEY) === orderId) localStorage.removeItem(STORAGE_KEY)
  } catch { /* private mode */ }
}

export default function PendingOrderBanner() {
  const t = useT()
  const router = useRouter()
  const [pending, setPending] = useState<{ id: string; order_number: string; total_amount: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    let orderId: string | null = null
    try { orderId = localStorage.getItem(STORAGE_KEY) } catch { /* private mode */ }
    if (!orderId) return

    fetch(`/api/orders/${orderId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (cancelled) return
        const order = json?.order
        // Only offer to resume genuinely unpaid online orders. A cash order
        // (payment_method set) is a commitment, not an abandonment.
        if (order && order.payment_status === 'pending' && !order.payment_method && order.order_status !== 'cancelled') {
          setPending({ id: order.id, order_number: order.order_number, total_amount: order.total_amount })
        } else {
          clearPendingOrder()
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!pending) return null

  return (
    <div className="rounded-2xl border-2 border-[#CEDC00]/60 bg-[#E5F2F0] px-4 py-3 mb-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 mt-0.5">
          <Clock className="w-4 h-4 text-[#00352F]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#00352F]">{t('order', 'pendingOrderTitle')}</p>
          <p className="text-xs text-[#00352F]/70 mt-0.5">
            <span className="font-mono">{pending.order_number}</span> · {formatCurrency(pending.total_amount)}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <button
              type="button"
              onClick={() => router.push(`/order/checkout?order_id=${pending.id}`)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-semibold transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: '#00352F' }}
            >
              {t('order', 'completePayment')} <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => { clearPendingOrder(); setPending(null) }}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-[#00352F]/60 hover:text-[#00352F] hover:bg-white/60 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> {t('order', 'startNewOrder')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
