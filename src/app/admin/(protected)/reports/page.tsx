'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, FileText, Printer, Filter, Shirt } from 'lucide-react'
import { PaymentStatusBadge, OrderStatusBadge, DeliveryStatusBadge, InstitutionBadge } from '@/components/shared/status-badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Order, DashboardStats } from '@/types'
import { toast } from 'sonner'

export default function ReportsPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [catalogBreakdown, setCatalogBreakdown] = useState<DashboardStats['orders_by_catalog_item']>([])
  const [hasCatalog, setHasCatalog] = useState(false)

  const [institutionType, setInstitutionType] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [deliveryStatus, setDeliveryStatus] = useState('')
  const [shirtSize, setShirtSize] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const buildExportUrl = () => {
    const params = new URLSearchParams()
    if (institutionType) params.set('institution_type', institutionType)
    if (paymentStatus) params.set('payment_status', paymentStatus)
    if (deliveryStatus) params.set('delivery_status', deliveryStatus)
    if (shirtSize) params.set('shirt_size', shirtSize)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    return `/api/admin/export?${params}`
  }

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        institution_type: institutionType, payment_status: paymentStatus,
        delivery_status: deliveryStatus, shirt_size: shirtSize,
        date_from: dateFrom, date_to: dateTo,
        limit: '500',
      })
      const res = await fetch(`/api/admin/orders?${params}`)
      const json = await res.json()
      const orderList: Order[] = json.orders || []
      setOrders(orderList)
      setTotalRevenue(
        orderList
          .filter(o => o.payment_status === 'paid' || o.payment_status === 'manual')
          .reduce((sum, o) => sum + Number(o.total_amount), 0)
      )
      // Build catalog breakdown from this filtered set
      const cmap = new Map<string, { orders: number; shirts: number }>()
      orderList.forEach((o: Order) => {
        const name = o.catalog_item_name || null
        if (!name) return
        const ex = cmap.get(name) || { orders: 0, shirts: 0 }
        cmap.set(name, { orders: ex.orders + 1, shirts: ex.shirts + o.quantity })
      })
      const breakdown = Array.from(cmap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.shirts - a.shirts)
      setCatalogBreakdown(breakdown)
      setHasCatalog(breakdown.length > 0)
    } catch {
      toast.error('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = () => {
    window.open(buildExportUrl(), '_blank')
    toast.success('CSV download started')
  }

  const handlePrint = () => window.print()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports & Exports</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Filter and export order data</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button onClick={handleExport} size="sm" className="text-white" style={{ backgroundColor: '#1B4D2E' }}>
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block mb-4 border-b pb-3">
        <h1 className="text-xl font-bold">Institution Shirt Order Manager — Report</h1>
        <p className="text-sm text-gray-500">Generated {new Date().toLocaleDateString()}</p>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filter Report
          </CardTitle>
          <CardDescription className="text-xs">Apply filters then click Generate Report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Institution Type</Label>
              <Select value={institutionType} onValueChange={v => setInstitutionType(!v || v === 'all' ? '' : v)}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="school">School</SelectItem>
                  <SelectItem value="government">Government</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="private_company">Private Company</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Payment Status</Label>
              <Select value={paymentStatus} onValueChange={v => setPaymentStatus(!v || v === 'all' ? '' : v)}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Delivery Status</Label>
              <Select value={deliveryStatus} onValueChange={v => setDeliveryStatus(!v || v === 'all' ? '' : v)}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="not_delivered">Not Delivered</SelectItem>
                  <SelectItem value="partially_delivered">Partial</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Shirt Size</Label>
              <Select value={shirtSize} onValueChange={v => setShirtSize(!v || v === 'all' ? '' : v)}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date From</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Date To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={fetchReport} size="sm" className="text-white" style={{ backgroundColor: '#1B4D2E' }}>
              <FileText className="w-4 h-4 mr-1" /> Generate Report
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              setInstitutionType(''); setPaymentStatus(''); setDeliveryStatus('')
              setShirtSize(''); setDateFrom(''); setDateTo('')
            }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{orders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Shirts</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {orders.reduce((s, o) => s + o.quantity, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Revenue (Paid)</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Shirt style breakdown */}
      {hasCatalog && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#EFF8E8] rounded-lg flex items-center justify-center flex-shrink-0">
                <Shirt className="w-4 h-4 text-[#1B4D2E]" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Shirts by Style</CardTitle>
                <CardDescription className="text-xs">Based on current filtered results</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {catalogBreakdown.map(({ name, orders: o, shirts: s }, i) => {
                const colors = ['#1B4D2E', '#2D6A4F', '#8DC63F', '#5fa832', '#0D2E1A']
                return (
                  <div key={name} className="rounded-xl border p-4 flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                      style={{ backgroundColor: colors[i % colors.length] }}
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <span className="font-bold text-[#1B4D2E]">{s}</span> shirts &middot; {o} order{o !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                <TableHead className="text-xs font-semibold pl-4">Order #</TableHead>
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Institution</TableHead>
                <TableHead className="text-xs font-semibold">Shirt Style</TableHead>
                <TableHead className="text-xs font-semibold">Size</TableHead>
                <TableHead className="text-xs font-semibold">Qty</TableHead>
                <TableHead className="text-xs font-semibold">Total</TableHead>
                <TableHead className="text-xs font-semibold">Payment</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Delivery</TableHead>
                <TableHead className="text-xs font-semibold">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-gray-400">
                    No orders match the current filters
                  </TableCell>
                </TableRow>
              ) : (
                orders.map(order => (
                  <TableRow key={order.id} className="text-sm">
                    <TableCell className="font-mono text-xs text-gray-500 pl-4">{order.order_number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{order.full_name}</p>
                        <p className="text-xs text-gray-400">{order.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <InstitutionBadge type={order.institution_type} />
                        {order.institution_type === 'school' && order.school_name && (
                          <p className="text-xs text-gray-400 max-w-[130px] truncate">{order.school_name}</p>
                        )}
                        {order.institution_type === 'government' && order.organization_name && (
                          <p className="text-xs text-gray-400 max-w-[130px] truncate">{order.organization_name}</p>
                        )}
                        {order.institution_type === 'private_company' && order.company_name && (
                          <p className="text-xs text-gray-400 max-w-[130px] truncate">{order.company_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-700">
                      {order.catalog_item_name
                        ? <span className="font-medium">{order.catalog_item_name}</span>
                        : <span className="text-gray-300">—</span>}
                    </TableCell>
                    <TableCell className="font-medium">{order.shirt_size}</TableCell>
                    <TableCell>{order.quantity}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(order.total_amount)}</TableCell>
                    <TableCell><PaymentStatusBadge status={order.payment_status} /></TableCell>
                    <TableCell><OrderStatusBadge status={order.order_status} /></TableCell>
                    <TableCell><DeliveryStatusBadge status={order.delivery_status} /></TableCell>
                    <TableCell className="text-xs text-gray-400">{formatDate(order.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
