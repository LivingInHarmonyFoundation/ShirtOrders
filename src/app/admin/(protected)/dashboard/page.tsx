/**
 * @file page.tsx
 * @description Admin dashboard home. Displays stat cards and Recharts visualizations
 * filtered by campaign and/or date range. Widget visibility is persisted in
 * localStorage (key: 'lih_hidden_widgets') so each user can hide cards they don't need.
 *
 * Auth: provided by the parent (protected) layout — no per-page auth check needed.
 * Data: fetched from /api/admin/stats with campaign_id and date_from/date_to params.
 */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useT } from '@/contexts/LanguageContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ShoppingBag, DollarSign, CreditCard, Package,
  TrendingUp, Users, Truck, Clock, Settings2, Megaphone, X, Shirt, AlertTriangle, Banknote, ChevronDown, ChevronUp
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { DashboardStats, Campaign, ShirtInventoryItem } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'

// Chart palette — intentional repeats keep the cycle visually varied
const COLORS = ['#00352F', '#CEDC00', '#00594F', '#00594F', '#00352F', '#4a8a28', '#3d7a20']
const WIDGET_STORAGE_KEY = 'lih_hidden_widgets'

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom'

/**
 * getDateRange — converts a named date preset into an ISO date pair.
 * Returns empty strings for 'all' and 'custom' (caller handles those cases).
 */
function getDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = fmt(now)

  if (preset === 'today') return { from: today, to: today }
  if (preset === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    return { from: fmt(start), to: today }
  }
  if (preset === 'month') {
    return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: today }
  }
  if (preset === 'year') {
    return { from: `${now.getFullYear()}-01-01`, to: today }
  }
  return { from: '', to: '' }
}

/**
 * DashboardPage — main admin overview with filterable stat cards and charts.
 * Campaign filter and date preset are independent; both are sent to /api/admin/stats.
 * Widget visibility is stored in localStorage so hidden state persists across sessions.
 */
export default function DashboardPage() {
  const t = useT()

  // ── State ──
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  // Filters
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Widget visibility
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<string>>(new Set())
  const [showWidgetPanel, setShowWidgetPanel] = useState(false)

  // Low-stock inventory widget — separate fetch, own state
  const [lowStockItems, setLowStockItems] = useState<ShirtInventoryItem[]>([])

  // Cash breakdown agency table toggle
  const [showCashAgencies, setShowCashAgencies] = useState(false)

  // ── Effects ──

  // Restore hidden-widget preferences from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WIDGET_STORAGE_KEY)
      if (saved) setHiddenWidgets(new Set(JSON.parse(saved)))
    } catch { /* ignore */ }
  }, [])

  // Load campaigns list for the filter dropdown
  useEffect(() => {
    fetch('/api/admin/campaigns')
      .then(r => r.json())
      .then(j => setCampaigns(j.campaigns || []))
      .catch(() => {})
  }, [])

  // Load inventory once to surface low-stock items on the dashboard
  useEffect(() => {
    fetch('/api/admin/inventory')
      .then(r => r.json())
      .then(j => {
        const all: ShirtInventoryItem[] = j.inventory || []
        setLowStockItems(all.filter(item => item.quantity <= item.low_stock_threshold))
      })
      .catch(() => {})
  }, [])

  // ── Handlers ──

  const saveHiddenWidgets = (next: Set<string>) => {
    setHiddenWidgets(next)
    localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(Array.from(next)))
  }

  const toggleWidget = (id: string) => {
    const next = new Set(hiddenWidgets)
    if (next.has(id)) next.delete(id); else next.add(id)
    saveHiddenWidgets(next)
  }

  const fetchStats = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (selectedCampaign) params.set('campaign_id', selectedCampaign)
    if (datePreset === 'custom') {
      if (customFrom) params.set('date_from', customFrom)
      if (customTo) params.set('date_to', customTo)
    } else if (datePreset !== 'all') {
      const { from, to } = getDateRange(datePreset)
      if (from) params.set('date_from', from)
      if (to) params.set('date_to', to)
    }
    try {
      const res = await fetch(`/api/admin/stats?${params}`)
      const data = await res.json()
      setStats(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [selectedCampaign, datePreset, customFrom, customTo])

  useEffect(() => { fetchStats() }, [fetchStats])

  // ── Render helpers ──

  const activeCampaign = campaigns.find(c => c.is_active)
  const selectedCampaignName = selectedCampaign
    ? campaigns.find(c => c.id === selectedCampaign)?.name ?? 'Campaign'
    : t('admin', 'allOrders')

  const statCards = [
    { id: 'total_orders',     label: t('admin', 'totalOrders'),     value: stats?.total_orders ?? 0,          icon: ShoppingBag, color: 'text-[#00352F]',  bg: 'bg-[#E5F2F0]',               format: (v: number) => v.toString() },
    { id: 'total_revenue',    label: t('admin', 'totalRevenue'),    value: stats?.total_revenue ?? 0,          icon: DollarSign,  color: 'text-[#00352F]',  bg: 'bg-[#E5F2F0]',               format: formatCurrency },
    { id: 'paid_orders',      label: t('admin', 'paidOrders'),      value: stats?.paid_orders ?? 0,            icon: CreditCard,  color: 'text-emerald-700', bg: 'bg-emerald-50',              format: (v: number) => v.toString() },
    { id: 'unpaid_orders',    label: t('admin', 'unpaidOrders'),    value: stats?.unpaid_orders ?? 0,          icon: Clock,       color: 'text-yellow-600',  bg: 'bg-yellow-50',               format: (v: number) => v.toString() },
    { id: 'total_shirts',     label: t('admin', 'totalShirts'),     value: stats?.total_shirts ?? 0,           icon: Package,     color: 'text-[#00594F]',  bg: 'bg-green-50',                format: (v: number) => v.toString() },
    { id: 'delivered',        label: t('admin', 'delivered'),       value: stats?.delivered_orders ?? 0,       icon: Truck,       color: 'text-teal-700',    bg: 'bg-teal-50',                 format: (v: number) => v.toString() },
    { id: 'pending_delivery', label: t('admin', 'pendingDelivery'), value: stats?.pending_deliveries ?? 0,     icon: TrendingUp,  color: 'text-orange-600',  bg: 'bg-orange-50',               format: (v: number) => v.toString() },
    { id: 'institutions',     label: t('admin', 'institutions'),    value: stats?.orders_by_institution.length ?? 0, icon: Users, color: 'text-[#00352F]', bg: 'bg-[#E5F2F0]',              format: (v: number) => v.toString() },
  ]

  const allWidgets = [
    ...statCards.map(s => ({ id: s.id, label: s.label })),
    { id: 'chart_styles',      label: t('admin', 'chartStylesLabel') },
    { id: 'chart_revenue',     label: t('admin', 'chartRevenueLabel') },
    { id: 'chart_sizes',       label: t('admin', 'chartSizesLabel') },
    { id: 'chart_institution', label: t('admin', 'chartInstitutionLabel') },
    { id: 'chart_payment',     label: t('admin', 'chartPaymentLabel') },
    { id: 'cash_payments',     label: t('admin', 'cashPaymentsWidget') },
  ]

  const show = (id: string) => !hiddenWidgets.has(id)

  // ── Render ──
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admin', 'dashboardTitle')}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            {selectedCampaign
              ? `${t('admin', 'dashboardSubtitleCampaign')} "${selectedCampaignName}"`
              : t('admin', 'dashboardSubtitleAll')}
          </p>
        </div>

        {/* Widget settings */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowWidgetPanel(v => !v)}
            className="gap-1.5 text-xs"
          >
            <Settings2 className="w-3.5 h-3.5" />
            {t('admin', 'widgets')}
            {hiddenWidgets.size > 0 && (
              <span className="ml-0.5 bg-[#00352F] text-white rounded-full text-[10px] w-4 h-4 flex items-center justify-center">
                {hiddenWidgets.size}
              </span>
            )}
          </Button>
          {showWidgetPanel && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border rounded-xl shadow-lg z-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-700">{t('admin', 'showHideWidgets')}</p>
                <button onClick={() => setShowWidgetPanel(false)}>
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
              <div className="space-y-1">
                {allWidgets.map(w => (
                  <label key={w.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!hiddenWidgets.has(w.id)}
                      onChange={() => toggleWidget(w.id)}
                      className="rounded"
                    />
                    <span className="text-xs text-gray-700">{w.label}</span>
                  </label>
                ))}
              </div>
              {hiddenWidgets.size > 0 && (
                <button
                  onClick={() => saveHiddenWidgets(new Set())}
                  className="mt-2 w-full text-center text-xs text-[#00352F] hover:underline"
                >
                  {t('admin', 'showAll')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white border rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Campaign filter */}
        <div className="flex items-center gap-2">
          <Megaphone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <Select value={selectedCampaign || 'all'} onValueChange={v => setSelectedCampaign(v === 'all' ? '' : (v || ''))}>
            <SelectTrigger className="h-8 text-xs w-44 border-gray-200">
              <SelectValue placeholder={t('admin', 'allOrders')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin', 'allOrders')}</SelectItem>
              {campaigns.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} {c.is_active ? '●' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-px h-5 bg-gray-200 hidden sm:block" />

        {/* Date preset */}
        <Select value={datePreset} onValueChange={v => setDatePreset(v as DatePreset)}>
          <SelectTrigger className="h-8 text-xs w-36 border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin', 'allTime')}</SelectItem>
            <SelectItem value="today">{t('admin', 'today')}</SelectItem>
            <SelectItem value="week">{t('admin', 'thisWeek')}</SelectItem>
            <SelectItem value="month">{t('admin', 'thisMonth')}</SelectItem>
            <SelectItem value="year">{t('admin', 'thisYear')}</SelectItem>
            <SelectItem value="custom">{t('admin', 'customRange')}</SelectItem>
          </SelectContent>
        </Select>

        {datePreset === 'custom' && (
          <>
            <Input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="h-8 text-xs w-36"
            />
            <span className="text-xs text-gray-400">{t('admin', 'to')}</span>
            <Input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </>
        )}

        {(selectedCampaign || datePreset !== 'all') && (
          <button
            onClick={() => { setSelectedCampaign(''); setDatePreset('all'); setCustomFrom(''); setCustomTo('') }}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> {t('admin', 'clear')}
          </button>
        )}

        {activeCampaign && !selectedCampaign && (
          <button
            onClick={() => setSelectedCampaign(activeCampaign.id)}
            className="ml-auto text-xs font-medium flex items-center gap-1"
            style={{ color: '#00352F' }}
          >
            <Megaphone className="w-3 h-3" />
            {t('admin', 'viewActive')}: {activeCampaign.name}
          </button>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.filter(s => show(s.id)).map(({ id, label, value, icon: Icon, color, bg, format }) => (
          <Card key={id}>
            <CardContent className="p-4">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-16" />
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">{label}</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{format(value)}</p>
                  </div>
                  <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Low-stock inventory widget — only shown when there are items at/below threshold */}
      {lowStockItems.length > 0 && (
        <Card className="border-amber-200" style={{ backgroundColor: '#fffbeb' }}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-amber-800">
                    {t('admin', 'lowStockAlert')} — {lowStockItems.length} {lowStockItems.length === 1 ? t('admin', 'shirtSingular') : t('admin', 'shirtPlural')}
                  </p>
                  <a
                    href="/admin/inventory"
                    className="text-xs font-medium underline underline-offset-2 flex-shrink-0"
                    style={{ color: '#00352F' }}
                  >
                    {t('admin', 'inventory')} →
                  </a>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {lowStockItems.map(item => (
                    <span
                      key={item.id}
                      className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: item.quantity <= 0 ? '#fee2e2' : '#fef3c7',
                        color: item.quantity <= 0 ? '#991b1b' : '#92400e',
                      }}
                    >
                      {item.catalog_item_name ? `${item.catalog_item_name} — ` : ''}{item.shirt_size}: {item.quantity}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cash Payments widget */}
      {show('cash_payments') && (loading || (stats && (stats.cash_collected > 0 || stats.cash_pending > 0))) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#E5F2F0] rounded-lg flex items-center justify-center">
                <Banknote className="w-4 h-4 text-[#00352F]" />
              </div>
              <CardTitle className="text-sm font-semibold">{t('admin', 'cashPaymentsWidget')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : stats ? (
              <div className="space-y-4">
                {/* Collected / Pending pills */}
                <div className="flex gap-3 flex-wrap">
                  <div className="flex-1 min-w-[140px] rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                    <p className="text-xs text-emerald-700 font-medium">{t('admin', 'cashCollected')}</p>
                    <p className="text-xl font-bold text-emerald-800 mt-0.5">{formatCurrency(stats.cash_collected)}</p>
                  </div>
                  <div className="flex-1 min-w-[140px] rounded-xl bg-amber-50 border border-amber-100 p-3">
                    <p className="text-xs text-amber-700 font-medium">{t('admin', 'cashPending')}</p>
                    <p className="text-xl font-bold text-amber-800 mt-0.5">{formatCurrency(stats.cash_pending)}</p>
                  </div>
                </div>

                {/* By institution table */}
                {stats.cash_by_institution.length > 0 && (
                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('admin', 'institutionTypeLabel')}</th>
                          <th className="text-right px-3 py-2 font-semibold text-emerald-700">{t('admin', 'cashCollected')}</th>
                          <th className="text-right px-3 py-2 font-semibold text-amber-700">{t('admin', 'cashPending')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.cash_by_institution.map(row => (
                          <tr key={row.institution_type} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-2 capitalize font-medium text-gray-700">
                              {row.institution_type === 'private_company' ? 'Private Company' : row.institution_type.charAt(0).toUpperCase() + row.institution_type.slice(1)}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatCurrency(row.collected)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-amber-700">{formatCurrency(row.pending)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* By agency toggle */}
                {stats.cash_by_agency.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowCashAgencies(v => !v)}
                      className="flex items-center gap-1 text-xs font-medium text-[#00352F] hover:underline"
                    >
                      {showCashAgencies ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {t('admin', 'cashByAgency')} ({stats.cash_by_agency.length})
                    </button>
                    {showCashAgencies && (
                      <div className="mt-2 rounded-xl border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b">
                              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('admin', 'agencyLabel')}</th>
                              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('admin', 'tableInstitution')}</th>
                              <th className="text-right px-3 py-2 font-semibold text-emerald-700">{t('admin', 'cashCollected')}</th>
                              <th className="text-right px-3 py-2 font-semibold text-amber-700">{t('admin', 'cashPending')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.cash_by_agency.map((row, i) => (
                              <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="px-3 py-2 font-medium text-gray-800">{row.name}</td>
                                <td className="px-3 py-2 text-gray-500 capitalize">
                                  {row.institution_type === 'private_company' ? 'Private Co.' : row.institution_type}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatCurrency(row.collected)}</td>
                                <td className="px-3 py-2 text-right font-semibold text-amber-700">{formatCurrency(row.pending)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Shirt style breakdown */}
      {show('chart_styles') && (loading || stats?.has_catalog_breakdown) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#E5F2F0] rounded-lg flex items-center justify-center">
                <Shirt className="w-4 h-4 text-[#00352F]" />
              </div>
              <CardTitle className="text-sm font-semibold">{t('admin', 'shirtsOrderedByStyle')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : stats?.orders_by_catalog_item && stats.orders_by_catalog_item.length > 0 ? (
              <div className="space-y-3">
                {stats.orders_by_catalog_item.map(({ name, orders, shirts }, i) => {
                  const maxShirts = Math.max(...stats.orders_by_catalog_item.map(x => x.shirts))
                  const pct = maxShirts > 0 ? Math.round((shirts / maxShirts) * 100) : 0
                  return (
                    <div key={name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-800 truncate max-w-[60%]">{name}</span>
                        <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0">
                          <span>{orders} {orders !== 1 ? t('admin', 'orderPlural') : t('admin', 'orderSingular')}</span>
                          <span className="font-bold text-[#00352F] text-sm">{shirts} shirts</span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  )
                })}
                <p className="text-xs text-gray-400 pt-1">
                  {t('admin', 'totalSummary')}: {stats.orders_by_catalog_item.reduce((s, x) => s + x.shirts, 0)} {t('admin', 'shirtPlural')} — {stats.orders_by_catalog_item.length} {t('admin', 'stylesCount')}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue over time */}
        {show('chart_revenue') && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('admin', 'revenueOverTime')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-48 w-full" />
                : stats?.revenue_by_date && stats.revenue_by_date.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={stats.revenue_by_date}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} labelFormatter={(l) => `Date: ${l}`} />
                      <Line type="monotone" dataKey="revenue" stroke="#00352F" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">{t('admin', 'noRevenueData')}</div>}
            </CardContent>
          </Card>
        )}

        {/* Shirts by size */}
        {show('chart_sizes') && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('admin', 'shirtsBySize')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-48 w-full" />
                : stats?.orders_by_size && stats.orders_by_size.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.orders_by_size}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="shirt_size" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {stats.orders_by_size.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">{t('admin', 'noSizeData')}</div>}
            </CardContent>
          </Card>
        )}

        {/* Orders by institution */}
        {show('chart_institution') && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('admin', 'ordersByInstitutionType')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-48 w-full" />
                : stats?.orders_by_institution && stats.orders_by_institution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={stats.orders_by_institution} dataKey="count" nameKey="institution_type" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                        {stats.orders_by_institution.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend formatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)} />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">{t('admin', 'noInstitutionData')}</div>}
            </CardContent>
          </Card>
        )}

        {/* Payment overview */}
        {show('chart_payment') && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('admin', 'paymentOverview')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-48 w-full" /> : (
                <div className="space-y-3 pt-2">
                  {[
                    { label: t('admin', 'paid'),      value: stats?.paid_orders || 0,      total: stats?.total_orders || 1, color: 'bg-[#00352F]' },
                    { label: t('admin', 'pending'),   value: stats?.unpaid_orders || 0,    total: stats?.total_orders || 1, color: 'bg-yellow-400' },
                    { label: t('admin', 'delivered'), value: stats?.delivered_orders || 0, total: stats?.total_orders || 1, color: 'bg-[#CEDC00]' },
                  ].map(({ label, value, total, color }) => {
                    const pct = total > 0 ? Math.round((value / total) * 100) : 0
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{label}</span>
                          <span className="font-medium text-gray-900">{value} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
