/**
 * @file page.tsx
 * @description Admin order detail view for a single order identified by UUID route param.
 * Displays customer info, institution fields, line-item breakdown, and payment details.
 * Allows inline editing of payment_status, order_status, delivery_status, admin_notes,
 * and quantity via a single PATCH to /api/orders/[id]. After save, the audit log is
 * refreshed to reflect the new entry. Audit entries are shown chronologically.
 *
 * Auth: provided by the parent (protected) layout.
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Save, User, Building2, Package, CreditCard,
  Truck, Clock, FileText, History, Loader2, Link2
} from 'lucide-react'
import { useT } from '@/contexts/LanguageContext'
import { PaymentStatusBadge, OrderStatusBadge, DeliveryStatusBadge, InstitutionBadge } from '@/components/shared/status-badge'
import { formatCurrency, formatDateTime, formatDate } from '@/lib/utils'
import type { Order, AuditLog, OrderItem } from '@/types'

/**
 * OrderDetailPage — single-order admin view with inline field editing and audit trail.
 * The order UUID comes from the dynamic [id] route segment. After any save, fetchOrder
 * is called again to pull the latest audit log entries.
 */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  paypal: 'PayPal', venmo: 'Venmo', card: 'Card', cash: 'Cash', ath_movil: 'ATH Móvil',
}

export default function OrderDetailPage() {
  const t = useT()
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  // ─── State ────────────────────────────────────────────────────────────────
  const [order, setOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editable fields — initialized from the fetched order, kept in sync with form inputs
  const [paymentStatus, setPaymentStatus] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('none')
  const [orderStatus, setOrderStatus] = useState('')
  const [deliveryStatus, setDeliveryStatus] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [quantity, setQuantity] = useState(0)

  // ─── Data Fetching ────────────────────────────────────────────────────────

  // Loads order + audit log; also re-initializes all editable state from fresh data
  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`)
      const { order, auditLogs } = await res.json()
      if (order) {
        setOrder(order)
        setOrderItems(order.items || [])
        setAuditLogs(auditLogs || [])
        setPaymentStatus(order.payment_status)
        setPaymentMethod(order.payment_method || 'none')
        setOrderStatus(order.order_status)
        setDeliveryStatus(order.delivery_status)
        setAdminNotes(order.admin_notes || '')
        setQuantity(order.quantity)
      }
    } catch {
      toast.error('Failed to load order')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => { fetchOrder() }, [fetchOrder])

  // ─── Handlers ─────────────────────────────────────────────────────────────

  // PATCHes editable fields; on success refreshes the full order + audit log
  const handleSave = async () => {
    if (!order) return
    setSaving(true)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_status: paymentStatus,
          payment_method: paymentMethod === 'none' ? null : paymentMethod,
          order_status: orderStatus,
          delivery_status: deliveryStatus,
          admin_notes: adminNotes,
          quantity: Number(quantity),
        }),
      })
      if (res.ok) {
        const { order: updated } = await res.json()
        setOrder(updated)
        toast.success('Order updated successfully')
        fetchOrder() // refresh audit log
      } else {
        toast.error('Failed to update order')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Order not found</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-3">Go Back</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/orders')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Orders
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{order.order_number}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Submitted {formatDateTime(order.date_submitted)}</p>
        </div>
        <div className="flex items-center gap-2">
          {order.payment_status === 'pending' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/order/checkout?order_id=${order.id}`)
                toast.success(t('admin', 'payLinkCopied'))
              }}
            >
              <Link2 className="w-4 h-4 mr-1" /> {t('admin', 'copyPayLink')}
            </Button>
          )}
          <PaymentStatusBadge status={order.payment_status} />
          <OrderStatusBadge status={order.order_status} />
          <DeliveryStatusBadge status={order.delivery_status} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: Customer + Institution + Shirt info */}
        <div className="md:col-span-2 space-y-4">
          {/* Customer info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="w-4 h-4" /> Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Full Name</p>
                  <p className="font-medium text-gray-900 dark:text-white mt-0.5">{order.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                  <p className="font-medium text-gray-900 dark:text-white mt-0.5 text-xs break-all">{order.email}</p>
                </div>
                {order.phone && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                    <p className="font-medium text-gray-900 dark:text-white mt-0.5">{order.phone}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Institution info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Institution
                <InstitutionBadge type={order.institution_type} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {order.institution_type === 'school' && (<>
                  <div>
                    <p className="text-xs text-gray-500">School</p>
                    <p className="font-medium text-gray-900 dark:text-white mt-0.5">{order.school_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Grade / Group</p>
                    <p className="font-medium text-gray-900 dark:text-white mt-0.5">{order.grade || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Classroom</p>
                    <p className="font-medium text-gray-900 dark:text-white mt-0.5">{order.classroom || '—'}</p>
                  </div>
                </>)}
                {order.institution_type === 'government' && (<>
                  <div>
                    <p className="text-xs text-gray-500">Agency / Organization</p>
                    <p className="font-medium text-gray-900 dark:text-white mt-0.5">{order.organization_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Department / Office</p>
                    <p className="font-medium text-gray-900 dark:text-white mt-0.5">{order.department_office || '—'}</p>
                  </div>
                  {order.region && (
                    <div>
                      <p className="text-xs text-gray-500">Region</p>
                      <p className="font-medium text-gray-900 dark:text-white mt-0.5">{order.region}</p>
                    </div>
                  )}
                </>)}
                {order.institution_type === 'municipality' && (
                  <div>
                    <p className="text-xs text-gray-500">Municipio</p>
                    <p className="font-medium text-gray-900 dark:text-white mt-0.5">{order.organization_name || '—'}</p>
                  </div>
                )}
                {order.institution_type === 'private_company' && (<>
                  <div>
                    <p className="text-xs text-gray-500">Company</p>
                    <p className="font-medium text-gray-900 dark:text-white mt-0.5">{order.company_name || '—'}</p>
                  </div>
                  {order.company_department && (
                    <div>
                      <p className="text-xs text-gray-500">Department</p>
                      <p className="font-medium text-gray-900 dark:text-white mt-0.5">{order.company_department}</p>
                    </div>
                  )}
                </>)}
                {order.institution_type === 'personal' && order.delivery_address && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">Mailing Address</p>
                    <p className="font-medium text-gray-900 dark:text-white mt-0.5 whitespace-pre-line">{order.delivery_address}</p>
                  </div>
                )}
              </div>
              {order.notes && (
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Customer Notes</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4" /> Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Line items breakdown (when order has multiple items) */}
              {orderItems.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Line Items ({orderItems.length})
                  </p>
                  <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900/50">
                          <th className="text-left px-3 py-2 text-gray-500 font-semibold">Shirt</th>
                          <th className="text-center px-3 py-2 text-gray-500 font-semibold">Size</th>
                          <th className="text-center px-3 py-2 text-gray-500 font-semibold">Qty</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-semibold">Price</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-semibold">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems.map((item, idx) => (
                          <tr
                            key={item.id}
                            className={idx % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-gray-50/50 dark:bg-gray-900/20'}
                          >
                            <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                              {item.catalog_item_name}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-bold text-[#00352F] bg-[#E5F2F0] text-xs">
                                {item.shirt_size}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{formatCurrency(item.unit_price)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Shirt Size</p>
                    <p className="font-bold text-gray-900 dark:text-white mt-0.5 text-base">{order.shirt_size}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={e => setQuantity(Number(e.target.value))}
                      className="mt-0.5 h-8 text-sm w-20"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Unit Price</p>
                    <p className="font-medium text-gray-900 dark:text-white mt-0.5">{formatCurrency(order.unit_price)}</p>
                  </div>
                </div>
              )}
              {/* When we have line items, still allow quantity edit via the raw field */}
              {orderItems.length > 0 && (
                <div className="flex items-center gap-4 pt-1">
                  <div>
                    <Label className="text-xs text-gray-500">Total Qty (editable)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={e => setQuantity(Number(e.target.value))}
                      className="mt-0.5 h-8 text-sm w-24"
                    />
                  </div>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900 dark:text-white">Total Amount</span>
                <span className="font-bold text-xl text-blue-600">{formatCurrency(order.total_amount)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Audit log */}
          {auditLogs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="w-4 h-4" /> Audit Trail
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {auditLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-2 text-xs py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <div className="flex-1">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{log.field_changed}</span>
                        <span className="text-gray-400 mx-1">changed from</span>
                        <span className="text-red-500 line-through">{log.old_value || 'none'}</span>
                        <span className="text-gray-400 mx-1">to</span>
                        <span className="text-green-600 font-medium">{log.new_value || 'none'}</span>
                      </div>
                      <div className="text-right text-gray-400 flex-shrink-0">
                        <p>{log.changed_by}</p>
                        <p>{formatDateTime(log.changed_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Status editing + Payment info */}
        <div className="space-y-4">
          {/* Status editors */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" /> Update Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-gray-500">Payment Status</Label>
                <Select value={paymentStatus} onValueChange={v => v && setPaymentStatus(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={v => v && setPaymentMethod(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="venmo">Venmo</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="ath_movil">ATH Móvil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Order Status</Label>
                <Select value={orderStatus} onValueChange={v => v && setOrderStatus(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Delivery Status</Label>
                <Select value={deliveryStatus} onValueChange={v => v && setDeliveryStatus(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_delivered">Not Delivered</SelectItem>
                    <SelectItem value="partially_delivered">Partially Delivered</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Admin notes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" /> Admin Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                placeholder="Internal notes (not visible to customer)..."
                rows={4}
                className="text-sm resize-none"
              />
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={saving} className="w-full text-white" style={{ backgroundColor: '#00352F' }}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
          </Button>

          {/* Payment details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Status</span>
                <PaymentStatusBadge status={order.payment_status} />
              </div>
              {order.payment_method && (
                <div className="flex justify-between">
                  <span>Payment Via</span>
                  <span className="font-medium">{PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method}</span>
                </div>
              )}
              {order.stripe_payment_intent_id && (
                <div>
                  <span className="block text-gray-400">Legacy Stripe PI</span>
                  <span className="font-mono text-xs text-gray-300 break-all">{order.stripe_payment_intent_id}</span>
                </div>
              )}
              {order.date_paid && (
                <div className="flex justify-between">
                  <span>Paid At</span>
                  <span className="font-medium">{formatDate(order.date_paid)}</span>
                </div>
              )}
              {order.date_delivered && (
                <div className="flex justify-between">
                  <span>Delivered At</span>
                  <span className="font-medium">{formatDate(order.date_delivered)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span>Delivery</span>
                <DeliveryStatusBadge status={order.delivery_status} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
