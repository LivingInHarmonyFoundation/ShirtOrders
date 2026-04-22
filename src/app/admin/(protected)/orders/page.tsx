/**
 * @file page.tsx
 * @description Admin order management table. Supports 12+ independent filter states
 * (search, institution type, payment/delivery/order status, shirt size, date range,
 * grade, classroom, department, org/school/company name, campaign) that feed a single
 * debounced useCallback fetch. Search input is debounced 400 ms; all other filters
 * fire immediately. Bulk PATCH via checkbox selection updates status fields in one request.
 *
 * Auth: provided by the parent (protected) layout.
 * Pagination: server-side, 20 orders per page.
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useT } from '@/contexts/LanguageContext'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Search, Filter, ChevronLeft, ChevronRight, Eye, RefreshCw, Megaphone, ShoppingBag, DollarSign, Shirt } from 'lucide-react'
import { PaymentStatusBadge, OrderStatusBadge, DeliveryStatusBadge, InstitutionBadge } from '@/components/shared/status-badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Order, GovOrg, SchoolLink, PrivateCompany, Campaign } from '@/types'

interface OrderSummary {
  total_orders: number
  total_shirts: number
  total_revenue: number
  by_size: { size: string; orders: number; shirts: number }[]
  by_catalog_item: { name: string; orders: number; shirts: number }[]
}

interface PaginatedOrders {
  orders: Order[]
  total: number
  page: number
  limit: number
  total_pages: number
  summary?: OrderSummary
}
import { toast } from 'sonner'

/**
 * AdminOrdersPage — paginated order table with 12+ filters, bulk status update,
 * and per-page summary stats (total orders / shirts / revenue + breakdowns by size
 * and catalog item). Requires canManageOrders permission (enforced server-side).
 */
export default function AdminOrdersPage() {
  const t = useT()

  // ── State ──
  const [data, setData] = useState<PaginatedOrders | null>(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [institutionType, setInstitutionType] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [deliveryStatus, setDeliveryStatus] = useState('')
  const [shirtSize, setShirtSize] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [grade, setGrade] = useState('')
  const [classroom, setClassroom] = useState('')
  const [department, setDepartment] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)

  // Bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState('')

  // Sub-filter dropdown lists (loaded once)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [govOrgs, setGovOrgs] = useState<GovOrg[]>([])
  const [schools, setSchools] = useState<SchoolLink[]>([])
  const [companies, setCompanies] = useState<PrivateCompany[]>([])

  // ── Effects ──

  // Load filter dropdown options on mount
  useEffect(() => {
    fetch('/api/admin/campaigns')
      .then(r => r.json()).then(j => setCampaigns(j.campaigns || [])).catch(() => {})
    fetch('/api/admin/government-orgs')
      .then(r => r.json()).then(j => setGovOrgs(j.orgs || [])).catch(() => {})
    fetch('/api/admin/schools')
      .then(r => r.json()).then(j => setSchools(j.schools || [])).catch(() => {})
    fetch('/api/admin/private-companies')
      .then(r => r.json()).then(j => setCompanies(j.companies || [])).catch(() => {})
  }, [])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      search, institution_type: institutionType, payment_status: paymentStatus,
      delivery_status: deliveryStatus, shirt_size: shirtSize,
      date_from: dateFrom, date_to: dateTo,
      grade, classroom, department,
      organization_name: organizationName,
      school_name: schoolName,
      company_name: companyName,
      campaign_id: campaignId,
      sort, page: page.toString(), limit: '20',
    })
    try {
      const res = await fetch(`/api/admin/orders?${params}`)
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [search, institutionType, paymentStatus, deliveryStatus, shirtSize, dateFrom, dateTo, grade, classroom, department, organizationName, schoolName, companyName, campaignId, sort, page])

  // Debounce the fetch so search-as-you-type doesn't fire on every keystroke
  useEffect(() => {
    const t = setTimeout(fetchOrders, search ? 400 : 0)
    return () => clearTimeout(t)
  }, [fetchOrders, search])

  // ── Handlers ──

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    if (!data) return
    if (selectedIds.length === data.orders.length) setSelectedIds([])
    else setSelectedIds(data.orders.map(o => o.id))
  }

  const handleBulkUpdate = async () => {
    if (!bulkStatus || selectedIds.length === 0) return
    const [field, value] = bulkStatus.split(':')
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, updates: { [field]: value } }),
      })
      if (res.ok) {
        toast.success(`Updated ${selectedIds.length} orders`)
        setSelectedIds([])
        setBulkStatus('')
        fetchOrders()
      }
    } catch {
      toast.error('Bulk update failed')
    }
  }

  const clearFilters = () => {
    setSearch(''); setInstitutionType(''); setPaymentStatus('')
    setDeliveryStatus(''); setShirtSize(''); setDateFrom(''); setDateTo('')
    setGrade(''); setClassroom(''); setDepartment('')
    setOrganizationName(''); setSchoolName(''); setCompanyName('')
    setCampaignId('')
    setSort('newest'); setPage(1)
  }

  // True when any filter is active — drives the "Clear filters" button visibility
  const hasFilters = search || institutionType || paymentStatus || deliveryStatus || shirtSize || dateFrom || dateTo || grade || classroom || department || organizationName || schoolName || companyName || campaignId

  // ── Render ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admin', 'ordersTitle')}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            {data ? `${data.total} ${data.total === 1 ? t('admin', 'orderSingular') : t('admin', 'orderPlural')}` : t('admin', 'loadingText')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders}>
          <RefreshCw className="w-4 h-4 mr-1" /> {t('admin', 'refresh')}
        </Button>
      </div>

      {/* Summary stats */}
      {data?.summary && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-gray-800 border rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{data.summary.total_orders.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{t('admin', 'ordersLabel')}</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#E5F2F0] flex items-center justify-center flex-shrink-0">
                <Shirt className="w-4 h-4 text-[#00352F]" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{data.summary.total_shirts.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{t('admin', 'shirtsLabel')}</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(data.summary.total_revenue)}</p>
                <p className="text-xs text-gray-500">{t('admin', 'revenueLabel')}</p>
              </div>
            </div>
          </div>

          {/* By size breakdown */}
          {data.summary.by_size.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">{t('admin', 'bySize')}</p>
              <div className="flex flex-wrap gap-2">
                {[...data.summary.by_size].sort((a, b) => b.shirts - a.shirts).map(s => (
                  <div key={s.size} className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 border rounded-lg px-3 py-1.5">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{s.size}</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-600 dark:text-gray-300">{s.shirts} {t('admin', 'shirtsLabel').toLowerCase()}</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">{s.orders} {t('admin', 'ordersLabel').toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By catalog item (only if multiple items) */}
          {data.summary.by_catalog_item.length > 1 && (
            <div className="bg-white dark:bg-gray-800 border rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">{t('admin', 'byShirtStyle')}</p>
              <div className="flex flex-wrap gap-2">
                {data.summary.by_catalog_item.map(item => (
                  <div key={item.name} className="flex items-center gap-1.5 bg-[#E5F2F0] border border-[#CEDC00]/30 rounded-lg px-3 py-1.5">
                    <span className="text-sm font-medium text-[#00352F]">{item.name}</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-[#00352F]/70">{item.shirts} {t('admin', 'shirtsLabel').toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder={t('admin', 'searchPlaceholder')}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Select value={sort} onValueChange={v => { setSort(v ?? 'newest'); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t('admin', 'sortNewest')}</SelectItem>
                <SelectItem value="oldest">{t('admin', 'sortOldest')}</SelectItem>
                <SelectItem value="paid">{t('admin', 'sortPaid')}</SelectItem>
                <SelectItem value="unpaid">{t('admin', 'sortUnpaid')}</SelectItem>
                <SelectItem value="delivered">{t('admin', 'sortDelivered')}</SelectItem>
                <SelectItem value="not_delivered">{t('admin', 'sortNotDelivered')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            {campaigns.length > 0 && (
              <Select value={campaignId || 'all'} onValueChange={v => { setCampaignId(!v || v === 'all' ? '' : v); setPage(1) }}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <Megaphone className="w-3 h-3 mr-1 flex-shrink-0" />
                  <SelectValue placeholder={t('admin', 'allCampaigns')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin', 'allCampaigns')}</SelectItem>
                  {campaigns.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.is_active ? ' ●' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={institutionType} onValueChange={v => {
              const t = !v || v === 'all' ? '' : v
              setInstitutionType(t)
              // Clear sub-filters when institution type changes
              setOrganizationName(''); setSchoolName(''); setCompanyName('')
              setPage(1)
            }}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue placeholder={t('admin', 'institutionFilterLabel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin', 'allTypes')}</SelectItem>
                <SelectItem value="school">{t('admin', 'schoolType')}</SelectItem>
                <SelectItem value="government">{t('admin', 'governmentType')}</SelectItem>
                <SelectItem value="personal">{t('admin', 'personalType')}</SelectItem>
                <SelectItem value="private_company">{t('admin', 'privateCompanyType')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Sub-filter: specific org/school/company */}
            {institutionType === 'government' && govOrgs.length > 0 && (
              <Select value={organizationName} onValueChange={v => { setOrganizationName(!v || v === 'all' ? '' : v); setPage(1) }}>
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue placeholder={t('admin', 'allAgencies')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin', 'allAgencies')}</SelectItem>
                  {govOrgs.filter(o => o.is_active).map(o => (
                    <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {institutionType === 'school' && schools.length > 0 && (
              <Select value={schoolName} onValueChange={v => { setSchoolName(!v || v === 'all' ? '' : v); setPage(1) }}>
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue placeholder={t('admin', 'allSchools')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin', 'allSchools')}</SelectItem>
                  {schools.map(s => (
                    <SelectItem key={s.id} value={s.school_name}>{s.school_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {institutionType === 'private_company' && companies.length > 0 && (
              <Select value={companyName} onValueChange={v => { setCompanyName(!v || v === 'all' ? '' : v); setPage(1) }}>
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue placeholder={t('admin', 'allCompanies')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin', 'allCompanies')}</SelectItem>
                  {companies.filter(c => c.is_active).map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={paymentStatus} onValueChange={v => { setPaymentStatus(!v || v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder={t('admin', 'paymentFilterLabel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin', 'allPayments')}</SelectItem>
                <SelectItem value="pending">{t('admin', 'pendingPayment')}</SelectItem>
                <SelectItem value="paid">{t('admin', 'paidPayment')}</SelectItem>
                <SelectItem value="failed">{t('admin', 'failedPayment')}</SelectItem>
                <SelectItem value="refunded">{t('admin', 'refundedPayment')}</SelectItem>
                <SelectItem value="manual">{t('admin', 'manualPayment')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={deliveryStatus} onValueChange={v => { setDeliveryStatus(!v || v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder={t('admin', 'deliveryFilterLabel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin', 'allDeliveries')}</SelectItem>
                <SelectItem value="not_delivered">{t('admin', 'notDelivered')}</SelectItem>
                <SelectItem value="partially_delivered">{t('admin', 'partiallyDelivered')}</SelectItem>
                <SelectItem value="delivered">{t('admin', 'deliveredStatus')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={shirtSize} onValueChange={v => { setShirtSize(!v || v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue placeholder={t('admin', 'sizeFilterLabel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin', 'allSizes')}</SelectItem>
                {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1) }}
              className="w-36 h-8 text-xs"
              placeholder="From"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1) }}
              className="w-36 h-8 text-xs"
              placeholder="To"
            />

            {(institutionType === 'school' || !institutionType) && (
              <Input
                value={grade}
                onChange={e => { setGrade(e.target.value); setPage(1) }}
                className="w-28 h-8 text-xs"
                placeholder={t('admin', 'gradePlaceholderFilter')}
              />
            )}
            {(institutionType === 'school' || !institutionType) && (
              <Input
                value={classroom}
                onChange={e => { setClassroom(e.target.value); setPage(1) }}
                className="w-32 h-8 text-xs"
                placeholder={t('admin', 'classroomPlaceholderFilter')}
              />
            )}
            {(institutionType === 'government' || institutionType === 'private_company' || !institutionType) && (
              <Input
                value={department}
                onChange={e => { setDepartment(e.target.value); setPage(1) }}
                className="w-36 h-8 text-xs"
                placeholder={t('admin', 'departmentPlaceholderFilter')}
              />
            )}

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs text-gray-500">
                {t('admin', 'clearFilters')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-[#E5F2F0] dark:bg-green-900/20 rounded-lg border border-[#CEDC00]/40">
          <span className="text-sm font-medium text-[#00352F] dark:text-green-400">{selectedIds.length} {t('admin', 'selectedCount')}</span>
          <Select value={bulkStatus} onValueChange={v => setBulkStatus(v ?? '')}>
            <SelectTrigger className="w-52 h-8 text-xs">
              <SelectValue placeholder={t('admin', 'bulkActionPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="delivery_status:delivered">{t('admin', 'markAsDelivered')}</SelectItem>
              <SelectItem value="delivery_status:partially_delivered">{t('admin', 'markPartiallyDelivered')}</SelectItem>
              <SelectItem value="payment_status:manual">{t('admin', 'markAsManualPayment')}</SelectItem>
              <SelectItem value="order_status:processing">{t('admin', 'markAsProcessing')}</SelectItem>
              <SelectItem value="order_status:completed">{t('admin', 'markAsCompleted')}</SelectItem>
              <SelectItem value="order_status:cancelled">{t('admin', 'markAsCancelled')}</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleBulkUpdate} disabled={!bulkStatus} className="h-8 text-xs">{t('admin', 'applyBulk')}</Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])} className="h-8 text-xs">{t('admin', 'cancelBulk')}</Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={data ? selectedIds.length === data.orders.length && data.orders.length > 0 : false}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="text-xs font-semibold">{t('admin', 'tableOrderNum')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('admin', 'tableCustomer')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('admin', 'tableInstitution')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('admin', 'tableShirtStyle')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('admin', 'tableSizeQty')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('admin', 'tableTotal')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('admin', 'tablePayment')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('admin', 'tableOrder')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('admin', 'tableDelivery')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('admin', 'tableDate')}</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 12 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data?.orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-12 text-gray-400">
                    {t('admin', 'noOrdersFound')}
                  </TableCell>
                </TableRow>
              ) : (
                data?.orders.map((order: Order) => (
                  <TableRow key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selectedIds.includes(order.id)}
                        onCheckedChange={() => toggleSelect(order.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-600 dark:text-gray-400">
                      {order.order_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{order.full_name}</p>
                        <p className="text-xs text-gray-400">{order.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <InstitutionBadge type={order.institution_type} />
                        {order.institution_type === 'school' && order.school_name && (
                          <p className="text-xs text-gray-400 max-w-[130px] truncate">{order.school_name}</p>
                        )}
                        {order.institution_type === 'school' && (order.grade || order.classroom) && (
                          <p className="text-xs text-gray-400">
                            {[order.grade && `Gr. ${order.grade}`, order.classroom && `Rm. ${order.classroom}`].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {order.institution_type === 'government' && order.organization_name && (
                          <p className="text-xs text-gray-400 max-w-[130px] truncate">{order.organization_name}</p>
                        )}
                        {order.institution_type === 'government' && order.department_office && (
                          <p className="text-xs text-gray-400 max-w-[130px] truncate">{order.department_office}</p>
                        )}
                        {order.institution_type === 'private_company' && order.company_name && (
                          <p className="text-xs text-gray-400 max-w-[130px] truncate">{order.company_name}</p>
                        )}
                        {order.institution_type === 'private_company' && order.company_department && (
                          <p className="text-xs text-gray-400 max-w-[130px] truncate">{order.company_department}</p>
                        )}
                        {order.institution_type === 'personal' && order.delivery_address && (
                          <p className="text-xs text-gray-400 max-w-[150px] truncate" title={order.delivery_address}>{order.delivery_address}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-700">
                      {order.catalog_item_name
                        ? <span className="font-medium">{order.catalog_item_name}</span>
                        : <span className="text-gray-300">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {order.items && order.items.length > 0 ? (
                        <div className="space-y-0.5">
                          {order.items.map((item, i) => (
                            <p key={item.id ?? i} className="text-xs font-medium text-gray-800 whitespace-nowrap">
                              <span className="font-bold">{item.shirt_size}</span> × {item.quantity}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <span className="font-medium">{order.shirt_size} × {order.quantity}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold text-sm">{formatCurrency(order.total_amount)}</TableCell>
                    <TableCell><PaymentStatusBadge status={order.payment_status} /></TableCell>
                    <TableCell><OrderStatusBadge status={order.order_status} /></TableCell>
                    <TableCell><DeliveryStatusBadge status={order.delivery_status} /></TableCell>
                    <TableCell className="text-xs text-gray-400">{formatDate(order.created_at)}</TableCell>
                    <TableCell>
                      <Link href={`/admin/orders/${order.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('admin', 'pageOf')} {data.page} {t('admin', 'of')} {data.total_pages} ({data.total} {t('admin', 'ordersLabel').toLowerCase()})
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              disabled={data.page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={data.page >= data.total_pages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
