'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { CreditCard, ArrowLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import Image from 'next/image'
import type { Order } from '@/types'

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('order_id')
  const cancelled = searchParams.get('cancelled')

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [manualPaySettings, setManualPaySettings] = useState(false)

  useEffect(() => {
    if (!orderId) { router.push('/order'); return }

    if (cancelled) {
      toast.error('Payment was cancelled. You can try again below.')
    }

    fetch(`/api/orders/${orderId}`)
      .then(r => r.json())
      .then(({ order }) => { setOrder(order); setLoading(false) })
      .catch(() => { setLoading(false); toast.error('Could not load order') })

    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(({ settings }) => { if (settings) setManualPaySettings(settings.manual_payment_enabled) })
      .catch(() => {})
  }, [orderId, cancelled, router])

  const handleStripeCheckout = async () => {
    if (!order) return
    setIsRedirecting(true)
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Failed to create checkout session')
        setIsRedirecting(false)
        return
      }
      window.location.href = json.url
    } catch {
      toast.error('Something went wrong. Please try again.')
      setIsRedirecting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F4F0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B4D2E]" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#F5F4F0] flex items-center justify-center">
        <Card className="max-w-sm w-full mx-4">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="font-semibold text-gray-900 mb-2">Order Not Found</h2>
            <Button onClick={() => router.push('/order')} variant="outline" className="mt-2">
              Start New Order
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

  const institutionDisplay = order.institution_type === 'school'
    ? `${order.school_name} — Grade ${order.grade}, ${order.classroom}`
    : `${order.organization_name} — ${order.department_office}`

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-0.5 border border-gray-100">
            <Image src="/logo.png" alt="Living in Harmony Foundation" width={36} height={36} className="object-contain" />
          </div>
          <div>
            <p className="font-bold text-[#1B4D2E] text-sm leading-none">Living in Harmony Foundation</p>
            <p className="text-gray-400 text-xs mt-0.5">Shirt Order Manager</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => router.push('/order')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to order form
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Review & Pay</h1>
          <p className="text-gray-500 mt-1 text-sm">Review your order before completing payment</p>
        </div>

        {cancelled && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              Your payment was not completed. Your order is saved — you can try again below.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Order Summary</CardTitle>
                <Badge variant="outline" className="text-xs font-mono">{order.order_number}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Customer</p>
                  <p className="font-medium text-gray-900">{order.full_name}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Email</p>
                  <p className="font-medium text-gray-900 text-xs break-all">{order.email}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Institution</p>
                  <p className="font-medium text-gray-900 capitalize">{order.institution_type}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Details</p>
                  <p className="font-medium text-gray-900 text-xs">{institutionDisplay}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs">Shirt Size</p>
                  <p className="font-semibold text-gray-900">{order.shirt_size}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 text-xs">Quantity</p>
                  <p className="font-semibold text-gray-900">{order.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 text-xs">Unit Price</p>
                  <p className="font-semibold text-gray-900">{formatCurrency(order.unit_price)}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">Total Amount</span>
                <span className="font-bold text-xl text-[#1B4D2E]">{formatCurrency(order.total_amount)}</span>
              </div>
              <p className="text-xs text-gray-400">Submitted {formatDateTime(order.date_submitted)}</p>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card className="border-[#8DC63F]/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handleStripeCheckout}
                disabled={isRedirecting}
                className="w-full text-white h-12 font-semibold"
                style={{ backgroundColor: '#1B4D2E' }}
              >
                {isRedirecting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting...</>
                ) : (
                  <><CreditCard className="w-4 h-4 mr-2" /> Pay {formatCurrency(order.total_amount)} Securely</>
                )}
              </Button>
              <p className="text-xs text-center text-gray-500">
                Powered by Stripe. Your card details are never stored on our servers.
              </p>
              {manualPaySettings && (
                <div className="pt-2 border-t border-dashed">
                  <p className="text-xs text-gray-500 text-center">
                    Prefer to pay by cash or check? Contact us with order number <strong>{order.order_number}</strong>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
            <CheckCircle className="w-3 h-3 text-[#1B4D2E]" /> SSL encrypted
            <span className="mx-1">•</span>
            <CheckCircle className="w-3 h-3 text-[#1B4D2E]" /> Secure checkout
          </div>
        </div>
      </main>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F5F4F0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B4D2E]" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
