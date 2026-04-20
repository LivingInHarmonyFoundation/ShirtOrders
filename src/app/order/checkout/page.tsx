'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { CreditCard, ArrowLeft, Loader2, AlertCircle, Banknote } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import Image from 'next/image'
import LanguageSelector from '@/components/shared/LanguageSelector'
import PoweredByFooter from '@/components/shared/PoweredByFooter'
import { useT } from '@/contexts/LanguageContext'
import type { Order, AppSettings } from '@/types'

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('order_id')
  const t = useT()

  // ── State ──
  const [order, setOrder] = useState<Order | null>(null)
  const [settings, setSettings] = useState<Partial<AppSettings> | null>(null)
  const [loading, setLoading] = useState(true)
  const [cashConfirmed, setCashConfirmed] = useState(false)
  const [cashLoading, setCashLoading] = useState(false)

  // ── Effects ──

  useEffect(() => {
    if (!orderId) { router.push('/order'); return }

    Promise.all([
      fetch(`/api/orders/${orderId}`).then(r => r.json()),
      fetch('/api/admin/settings').then(r => r.json()),
    ]).then(([orderData, settingsData]) => {
      setOrder(orderData.order ?? null)
      setSettings(settingsData.settings ?? null)
    }).catch(() => {
      toast.error('Could not load order')
    }).finally(() => setLoading(false))
  }, [orderId, router])

  // ── Handlers ──

  const handleCashSelect = async () => {
    if (!order) return
    setCashLoading(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/payment-method`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: 'cash' }),
      })
      if (!res.ok) throw new Error()
      setCashConfirmed(true)
    } catch {
      toast.error(t('errors', 'somethingWentWrong'))
    } finally {
      setCashLoading(false)
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F4F0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00352F]" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#F5F4F0] flex items-center justify-center">
        <Card className="max-w-sm w-full mx-4">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="font-semibold text-gray-900 mb-2">{t('checkout', 'orderNotFound')}</h2>
            <Button onClick={() => router.push('/order')} variant="outline" className="mt-2">
              {t('checkout', 'startNewOrder')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (order.payment_status === 'paid' || order.payment_status === 'manual') {
    router.push(`/order/confirmation?order_id=${order.id}`)
    return null
  }

  const institutionDisplay = (() => {
    switch (order.institution_type) {
      case 'school': return `${order.school_name || ''} — Grade ${order.grade || ''}, ${order.classroom || ''}`
      case 'government': return `${order.organization_name || ''} — ${order.department_office || ''}`
      case 'private_company': return `${order.company_name || ''} — ${order.company_department || ''}`
      case 'personal': return order.delivery_address || 'Personal Order'
      default: return ''
    }
  })()

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID

  const allowedMethods = order.order_allowed_payment_methods
  const hasRestrictions = allowedMethods !== null && allowedMethods.length > 0

  const paypalEnabled = !hasRestrictions || allowedMethods.includes('paypal')
  const venmoEnabled = !hasRestrictions || allowedMethods.includes('venmo')
  const cardEnabled = !hasRestrictions || allowedMethods.includes('card')
  const cashAllowed = (!hasRestrictions || allowedMethods.includes('cash')) && !!settings?.cash_enabled

  const enableFundingParts: string[] = []
  if (venmoEnabled) enableFundingParts.push('venmo')
  if (cardEnabled) enableFundingParts.push('card')

  const disableFundingParts: string[] = ['credit', 'paylater']
  if (!venmoEnabled) disableFundingParts.push('venmo')
  if (!cardEnabled) disableFundingParts.push('card')

  const onlinePaymentAvailable = paypalEnabled || venmoEnabled || cardEnabled

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
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
        <button
          onClick={() => router.push('/order')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> {t('checkout', 'backToOrderForm')}
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('checkout', 'title')}</h1>
          <p className="text-gray-500 mt-1 text-sm">{t('checkout', 'subtitle')}</p>
        </div>

        <div className="space-y-4">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t('checkout', 'orderSummary')}</CardTitle>
                <Badge variant="outline" className="text-xs font-mono">{order.order_number}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">{t('checkout', 'customer')}</p>
                  <p className="font-medium text-gray-900">{order.full_name}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">{t('checkout', 'email')}</p>
                  <p className="font-medium text-gray-900 text-xs break-all">{order.email}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">{t('checkout', 'institution')}</p>
                  <p className="font-medium text-gray-900 capitalize">{order.institution_type}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">{t('checkout', 'details')}</p>
                  <p className="font-medium text-gray-900 text-xs">{institutionDisplay}</p>
                </div>
              </div>
              <Separator />
              {/* Items breakdown */}
              {order.items && order.items.length > 0 ? (
                <div className="space-y-2">
                  {order.items.map((item, i) => (
                    <div key={item.id ?? i} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-gray-900">{item.catalog_item_name}</p>
                        <p className="text-xs text-gray-500">
                          {t('cart', 'size')} <span className="font-semibold text-gray-700">{item.shirt_size}</span>
                          {' · '}{item.quantity} × {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <p className="font-semibold text-gray-900">{formatCurrency(item.subtotal)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-xs">{t('checkout', 'shirtSize')}</p>
                    <p className="font-semibold text-gray-900">{order.shirt_size}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500 text-xs">{t('checkout', 'quantity')}</p>
                    <p className="font-semibold text-gray-900">{order.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500 text-xs">{t('checkout', 'unitPrice')}</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(order.unit_price)}</p>
                  </div>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">{t('checkout', 'totalAmount')}</span>
                <span className="font-bold text-xl text-[#00352F]">{formatCurrency(order.total_amount)}</span>
              </div>
              <p className="text-xs text-gray-400">{t('checkout', 'submitted')} {formatDateTime(order.date_submitted)}</p>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card className="border-[#CEDC00]/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> {t('checkout', 'payment')}
              </CardTitle>
              <p className="text-xs text-gray-500">{t('checkout', 'paymentSub')}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {!clientId ? (
                // PayPal not configured — show contact message
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  {t('checkout', 'paymentNotConfigured')}{' '}
                  <strong className="font-mono">{order.order_number}</strong> {t('checkout', 'toArrangePayment')}
                </div>
              ) : cashConfirmed ? (
                // Cash instructions shown after customer selects cash
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
                  <p className="font-semibold text-green-900">{t('checkout', 'cashSelected')}</p>
                  <p className="text-sm text-green-800">
                    {t('checkout', 'cashBring')} <strong>{formatCurrency(order.total_amount)}</strong> {t('checkout', 'cashInCash')}
                  </p>
                  <p className="text-sm text-green-800">
                    {t('checkout', 'cashReference')}{' '}
                    <span className="font-mono font-medium">{order.order_number}</span>
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {t('checkout', 'cashSaved')}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => router.push(`/order/confirmation?order_id=${order.id}`)}
                  >
                    {t('checkout', 'viewOrderStatus')}
                  </Button>
                </div>
              ) : !onlinePaymentAvailable && cashAllowed ? (
                // Only cash is available
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                    {t('checkout', 'cashOnly')}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleCashSelect}
                    disabled={cashLoading}
                  >
                    {cashLoading
                      ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      : <Banknote className="w-4 h-4 mr-2" />
                    }
                    {t('checkout', 'payWithCash')}
                  </Button>
                </div>
              ) : !onlinePaymentAvailable && !cashAllowed ? (
                // No payment methods available
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  {t('checkout', 'noPaymentMethods')}{' '}
                  <strong className="font-mono">{order.order_number}</strong> {t('checkout', 'toArrangePayment')}
                </div>
              ) : (
                // PayPal buttons + optional cash option
                <PayPalScriptProvider options={{
                  clientId: clientId!,
                  currency: 'USD',
                  ...(enableFundingParts.length > 0 ? { enableFunding: enableFundingParts.join(',') } : {}),
                  disableFunding: disableFundingParts.join(','),
                }}>
                  <div className="space-y-3">
                    <PayPalButtons
                      style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
                      createOrder={async () => {
                        const res = await fetch('/api/paypal/create-order', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ orderId: order.id }),
                        })
                        const { paypalOrderId, error } = await res.json()
                        if (error) throw new Error(error)
                        return paypalOrderId
                      }}
                      onApprove={async (data) => {
                        const res = await fetch('/api/paypal/capture-order', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ paypalOrderId: data.orderID, orderId: order.id }),
                        })
                        if (!res.ok) {
                          toast.error(t('checkout', 'paymentCaptureFailed'))
                          return
                        }
                        router.push(`/order/confirmation?order_id=${order.id}`)
                      }}
                      onError={() => {
                        toast.error(t('checkout', 'paymentFailed'))
                      }}
                    />

                    {/* Cash option shown below PayPal buttons when allowed */}
                    {cashAllowed && (
                      <>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <div className="flex-1 border-t" />
                          <span>or</span>
                          <div className="flex-1 border-t" />
                        </div>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={handleCashSelect}
                          disabled={cashLoading}
                        >
                          {cashLoading
                            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            : <Banknote className="w-4 h-4 mr-2" />
                          }
                          {t('checkout', 'payWithCash')}
                        </Button>
                      </>
                    )}
                  </div>
                </PayPalScriptProvider>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-center text-gray-400">
            {t('checkout', 'paypalSecure')}
          </p>
          <PoweredByFooter />
        </div>
      </main>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F5F4F0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00352F]" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
