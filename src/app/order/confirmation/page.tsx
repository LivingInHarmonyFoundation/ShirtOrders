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

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('order_id')
  const printRef = useRef<HTMLDivElement>(null)
  const t = useT()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmationMsg, setConfirmationMsg] = useState('')

  useEffect(() => {
    if (!orderId) { router.push('/order'); return }

    fetch(`/api/orders/${orderId}`)
      .then(r => r.json())
      .then(({ order }) => { setOrder(order); setLoading(false) })
      .catch(() => { setLoading(false) })

    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(({ settings }) => { if (settings?.confirmation_message) setConfirmationMsg(settings.confirmation_message) })
      .catch(() => {})
  }, [orderId, router])

  // Poll for payment status if pending
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

        {/* Print-only header */}
        <div className="hidden print:block mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold">Living in Harmony Foundation</h1>
          <p className="text-gray-500">{t('confirmation', 'receiptTitle')}</p>
        </div>

        {/* Receipt card */}
        <div ref={printRef}>
          <Card className="border-[#CEDC00]/30 shadow-sm">
            <CardHeader className="bg-[#E5F2F0] rounded-t-xl border-b border-[#CEDC00]/20">
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

          <div className="relative w-24 h-24" style={{ filter: 'drop-shadow(0 8px 20px rgba(0,53,47,0.2))' }}>
            <Image src="/badge.jpeg" alt="Que Nadie en PR Envejezca Solo" fill className="object-contain rounded-full" />
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
