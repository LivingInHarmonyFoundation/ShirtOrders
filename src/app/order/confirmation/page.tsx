/**
 * @file page.tsx
 * @description Public order confirmation page shown after a customer submits an order.
 * Fetches order details by UUID (order_id query param) and displays a receipt.
 * The UUID acts as a capability token — no authentication required.
 * Polls every 3 seconds when payment_status === 'pending' until the status resolves.
 * Wrapped in Suspense because useSearchParams() requires it in Next.js 16.
 */

'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, Printer, Home, Loader2 } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { PaymentStatusBadge } from '@/components/shared/status-badge'
import Image from 'next/image'
import LanguageSelector from '@/components/shared/LanguageSelector'
import PoweredByFooter from '@/components/shared/PoweredByFooter'
import { useT } from '@/contexts/LanguageContext'
import type { Order } from '@/types'

/**
 * ConfirmationContent — inner component that reads the order_id search param and
 * renders the full receipt. Kept separate from the default export so the Suspense
 * boundary can wrap useSearchParams() without affecting the outer shell.
 */
function ConfirmationContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('order_id')
  const printRef = useRef<HTMLDivElement>(null)
  const t = useT()

  // ─── State ────────────────────────────────────────────────────────────────
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmationMsg, setConfirmationMsg] = useState('')

  // ─── Data Fetching ────────────────────────────────────────────────────────

  // Initial load: fetch order data and the admin-configured confirmation message
  useEffect(() => {
    if (!orderId) { router.push('/order'); return }

    fetch(`/api/orders/${orderId}`)
      .then(r => r.json())
      .then(({ order }) => { setOrder(order); setLoading(false) })
      .catch(() => { setLoading(false) })

    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(({ settings }) => {
        if (settings?.confirmation_message) setConfirmationMsg(settings.confirmation_message)
      })
      .catch(() => {})
  }, [orderId, router])

  // Polling: re-fetch every 3 s while payment_status is 'pending' (e.g. waiting for PayPal webhook)
  useEffect(() => {
    if (!order || order.payment_status !== 'pending') return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`)
        const { order: updated } = await res.json()
        if (updated && updated.payment_status !== 'pending') {
          setOrder(updated)
          clearInterval(interval)
        }
      } catch {}
    }, 3000)
    return () => clearInterval(interval)
  }, [order])

  // ─── Render ───────────────────────────────────────────────────────────────

  // Fallback message when admin has not configured a custom confirmation message
  const defaultMsg = t('confirmation', 'defaultConfirmMsg')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F4F0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00352F]" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#F5F4F0] flex items-center justify-center px-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-6 text-center">
            <h2 className="font-semibold mb-3">{t('confirmation', 'orderNotFound')}</h2>
            <Button onClick={() => router.push('/order')} variant="outline">{t('confirmation', 'placeNewOrder')}</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Build a single human-readable institution string for display in the receipt
  const institutionDisplay = (() => {
    switch (order.institution_type) {
      case 'school': return [order.school_name, order.grade && `Grade ${order.grade}`, order.classroom].filter(Boolean).join(' — ')
      case 'government': return [order.organization_name, order.department_office].filter(Boolean).join(' — ')
      case 'private_company': return [order.company_name, order.company_department].filter(Boolean).join(' — ')
      case 'personal': return order.delivery_address || 'Personal Order'
      default: return ''
    }
  })()

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      {/* Header */}
      <header className="border-b bg-white shadow-sm print:hidden">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-0.5 border border-gray-100">
              <Image src="/logo.png" alt="Living in Harmony Foundation" width={36} height={36} className="object-contain" />
            </div>
            <div>
              <p className="font-bold text-[#00352F] text-sm leading-none">Living in Harmony Foundation</p>
            </div>
          </div>
          <LanguageSelector />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Success banner */}
        <div className="text-center mb-8 print:hidden">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg" style={{ backgroundColor: '#E5F2F0' }}>
            <CheckCircle className="w-10 h-10" style={{ color: '#00352F' }} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {order.payment_status === 'paid' || order.payment_status === 'manual'
              ? t('confirmation', 'orderConfirmed')
              : t('confirmation', 'orderReceived')}
          </h1>
          <p className="text-gray-500 mt-2 text-sm max-w-sm mx-auto">{confirmationMsg || defaultMsg}</p>
        </div>

        {/* Print-only header — logo + org name + campaign badge */}
        <div className="hidden print:flex items-center justify-between mb-6 pb-5 border-b-2" style={{ borderColor: '#CEDC00' }}>
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Living in Harmony Foundation" width={56} height={56} className="object-contain" />
            <div>
              <p className="text-xl font-bold" style={{ color: '#00352F' }}>Living in Harmony Foundation</p>
              <p className="text-sm text-gray-500">{t('confirmation', 'receiptTitle')}</p>
            </div>
          </div>
          <Image
              src="/logo.png"
              alt="Living in Harmony Foundation"
              width={72}
              height={72}
              className="object-contain rounded-full"
            />
        </div>

        {/* Receipt card */}
        <div ref={printRef}>
          <Card className="ring-0 border border-[#CEDC00]/40 shadow-sm pt-0">
            <CardHeader className="bg-[#E5F2F0] rounded-t-xl border-b border-[#CEDC00]/20 space-y-0 pb-3">
              {/* Letterhead — visible on screen and in print */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#CEDC00]/30">
                <div className="flex items-center gap-2.5">
                  <div className="relative w-9 h-9 bg-white rounded-lg overflow-hidden border border-[#CEDC00]/40 shrink-0">
                    <Image src="/logo.png" alt="Living in Harmony Foundation" fill className="object-cover" />
                  </div>
                  <div>
                    <p className="font-bold text-[#00352F] text-sm leading-tight">Living in Harmony Foundation</p>
                    <p className="text-xs text-gray-500">{t('confirmation', 'receiptTitle')}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-[#00352F]">{t('confirmation', 'orderReceipt')}</CardTitle>
                <PaymentStatusBadge status={order.payment_status} />
              </div>
              <p className="text-xs text-gray-500 font-mono mt-1">{order.order_number}</p>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Customer & institution */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{t('confirmation', 'name')}</p>
                  <p className="font-medium text-gray-900 mt-0.5">{order.full_name}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{t('confirmation', 'email')}</p>
                  <p className="font-medium text-gray-900 mt-0.5 text-xs break-all">{order.email}</p>
                </div>
                {order.phone && (
                  <div>
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{t('confirmation', 'phone')}</p>
                    <p className="font-medium text-gray-900 mt-0.5">{order.phone}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{t('confirmation', 'institution')}</p>
                  <p className="font-medium text-gray-900 capitalize mt-0.5">{order.institution_type}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{t('confirmation', 'details')}</p>
                  <p className="font-medium text-gray-900 mt-0.5">{institutionDisplay}</p>
                </div>
              </div>

              <Separator />

              {/* Order items */}
              <div className="space-y-2 text-sm">
                {order.items && order.items.length > 0 ? (
                  order.items.map((item, i) => (
                    <div key={item.id ?? i} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{item.catalog_item_name}</p>
                        <p className="text-xs text-gray-500">
                          {t('cart', 'size')} <span className="font-semibold text-gray-700">{item.shirt_size}</span>
                          {' · '}{item.quantity} × {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <span className="font-semibold text-gray-900">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('checkout', 'shirtSize')}</span>
                      <span className="font-semibold text-gray-900">{order.shirt_size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('checkout', 'quantity')}</span>
                      <span className="font-semibold text-gray-900">{order.quantity} shirts</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('checkout', 'unitPrice')}</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(order.unit_price)}</span>
                    </div>
                  </>
                )}
                <Separator />
                {order.applied_fees && order.applied_fees.length > 0 && (() => {
                  const feesTotal = order.applied_fees.reduce((s, f) => s + f.amount, 0)
                  const subtotal = order.total_amount - feesTotal
                  return (
                    <>
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      {order.applied_fees.map((fee, i) => (
                        <div key={i} className="flex justify-between text-sm text-gray-500">
                          <span>
                            {fee.name}
                            {fee.type === 'percentage' && <span className="text-xs ml-1">({fee.value}%)</span>}
                          </span>
                          <span>{formatCurrency(fee.amount)}</span>
                        </div>
                      ))}
                      <Separator />
                    </>
                  )
                })()}
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900">{t('confirmation', 'total')}</span>
                  <span className="font-bold text-xl" style={{ color: '#00352F' }}>{formatCurrency(order.total_amount)}</span>
                </div>
              </div>

              <Separator />

              {/* Payment method */}
              {order.payment_method && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('confirmation', 'paymentVia')}</span>
                  <span className="font-medium text-gray-900 capitalize">{order.payment_method}</span>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-500">{t('confirmation', 'dateSubmitted')}</p>
                  <p className="font-medium text-gray-900 mt-0.5">{formatDateTime(order.date_submitted)}</p>
                </div>
                {order.date_paid && (
                  <div>
                    <p className="text-gray-500">{t('confirmation', 'datePaid')}</p>
                    <p className="font-medium text-gray-900 mt-0.5">{formatDateTime(order.date_paid)}</p>
                  </div>
                )}
              </div>

              {order.payment_status === 'pending' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    {t('confirmation', 'paymentPending')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-4 print:hidden">
          <Button onClick={() => window.print()} variant="outline" className="flex-1">
            <Printer className="w-4 h-4 mr-2" /> {t('confirmation', 'printReceipt')}
          </Button>
          <Button onClick={() => router.push('/')} variant="outline" className="flex-1">
            <Home className="w-4 h-4 mr-2" /> {t('common', 'backToHome')}
          </Button>
        </div>

        <p className="text-xs text-center text-gray-400 mt-4 print:hidden">
          {t('confirmation', 'saveOrderNumber')} <strong className="text-gray-600">{order.order_number}</strong> {t('confirmation', 'forYourRecords')}
        </p>

        {/* Mission badge */}
        <div className="flex flex-col items-center gap-3 mt-10 mb-2 print:hidden">

          <div className="relative w-24 h-24 rounded-full overflow-hidden bg-white" style={{ filter: 'drop-shadow(0 8px 20px rgba(0,53,47,0.2))' }}>
            <Image src="/logo.png" alt="Living in Harmony Foundation" fill className="object-contain" />
          </div>
          <p className="text-xs text-gray-400 italic text-center max-w-xs">
            {t('confirmation', 'missionThanks')} <span className="text-[#00352F] font-medium">Únete a la lucha contra la soledad NO Deseada</span>
          </p>
        </div>
        <PoweredByFooter />
      </main>
    </div>
  )
}

/**
 * ConfirmationPage — public-facing route that wraps ConfirmationContent in a
 * Suspense boundary, required because the inner component uses useSearchParams().
 */
export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F5F4F0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00352F]" />
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  )
}
