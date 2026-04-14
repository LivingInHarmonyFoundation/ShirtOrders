'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ShoppingBag, DollarSign, CreditCard, Package,
  TrendingUp, Users, Truck, Clock, Settings2, Megaphone, X
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { DashboardStats, Campaign } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'
import { Shirt } from 'lucide-react'

const COLORS = ['#00352F', '#CEDC00', '#00594F', '#00594F', '#00352F', '#4a8a28', '#3d7a20']
const WIDGET_STORAGE_KEY = 'lih_hidden_widgets'

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom'

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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  // Filters
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Widget toggles
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<string>>(new Set())
  const [showWidgetPanel, setShowWidgetPanel] = useState(false)

  // Load hidden widgets from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WIDGET_STORAGE_KEY)
      if (saved) setHiddenWidgets(new Set(JSON.parse(saved)))
    } catch { /* ignore */ }
  }, [])

  const saveHiddenWidgets = (next: Set<string>) => {
    setHiddenWidgets(next)
    localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(Array.from(next)))
  }

  const toggleWidget = (id: string) => {
    const next = new Set(hiddenWidgets)
    if (next.has(id)) next.delete(id); else next.add(id)
    saveHiddenWidgets(next)
  }

  // Load campaigns list
  useEffect(() => {
    fetch('/api/admin/campaigns')
      .then(r => r.json())
      .then(j => setCampaigns(j.campaigns || []))
      .catch(() => {})
  }, [])

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

  const activeCampaign = campaigns.find(c => c.is_active)
  const selectedCampaignName = selectedCampaign
    ? campaigns.find(c => c.id === selectedCampaign)?.name ?? 'Campaign'
    : 'All Orders'

  const statCards = [
    { id: 'total_orders',     label: 'Total Orders',     value: stats?.total_orders ?? 0,          icon: ShoppingBag, color: 'text-[#00352F]',  bg: 'bg-[#E5F2F0]',               format: (v: number) => v.toString() },
    { id: 'total_revenue',    label: 'Total Revenue',    value: stats?.total_revenue ?? 0,          icon: DollarSign,  color: 'text-[#00352F]',  bg: 'bg-[#E5F2F0]',               format: formatCurrency },
    { id: 'paid_orders',      label: 'Paid Orders',      value: stats?.paid_orders ?? 0,            icon: CreditCard,  color: 'text-emerald-700', bg: 'bg-emerald-50',              format: (v: number) => v.toString() },
    { id: 'unpaid_orders',    label: 'Unpaid Orders',    value: stats?.unpaid_orders ?? 0,          icon: Clock,       color: 'text-yellow-600',  bg: 'bg-yellow-50',               format: (v: number) => v.toString() },
    { id: 'total_shirts',     label: 'Total Shirts',     value: stats?.total_shirts ?? 0,           icon: Package,     color: 'text-[#00594F]',  bg: 'bg-green-50',                format: (v: number) => v.toString() },
    { id: 'delivered',        label: 'Delivered',        value: stats?.delivered_orders ?? 0,       icon: Truck,       color: 'text-teal-700',    bg: 'bg-teal-50',                 format: (v: number) => v.toString() },
    { id: 'pending_delivery', label: 'Pending Delivery', value: stats?.pending_deliveries ?? 0,     icon: TrendingUp,  color: 'text-orange-600',  bg: 'bg-orange-50',               format: (v: number) => v.toString() },
    { id: 'institutions',     label: 'Institutions',     value: stats?.orders_by_institution.length ?? 0, icon: Users, color: 'text-[#00352F]', bg: 'bg-[#E5F2F0]',              format: (v: number) => v.toString() },
  ]

  const allWidgets = [
    ...statCards.map(s => ({ id: s.id, label: s.label })),
    { id: 'chart_styles',      label: 'Shirts by Style' },
    { id: 'chart_revenue',     label: 'Revenue Over Time' },
    { id: 'chart_sizes',       label: 'Shirts by Size' },
    { id: 'chart_institution', label: 'Orders by Institution' },
    { id: 'chart_payment',     label: 'Payment Overview' },
  ]

  const show = (id: string) => !hiddenWidgets.has(id)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            {selectedCampaign
              ? `Showing data for "${selectedCampaignName}"`
              : 'Overview of all orders and revenue'}
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
            Widgets
            {hiddenWidgets.size > 0 && (
              <span className="ml-0.5 bg-[#00352F] text-white rounded-full text-[10px] w-4 h-4 flex items-center justify-center">
                {hiddenWidgets.size}
              </span>
            )}
          </Button>
          {showWidgetPanel && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border rounded-xl shadow-lg z-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-700">Show / Hide Widgets</p>
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
                  Show all
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
              <SelectValue placeholder="All Orders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
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
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
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
            <span className="text-xs text-gray-400">to</span>
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
            <X className="w-3 h-3" /> Clear
          </button>
        )}

        {activeCampaign && !selectedCampaign && (
          <button
            onClick={() => setSelectedCampaign(activeCampaign.id)}
            className="ml-auto text-xs font-medium flex items-center gap-1"
            style={{ color: '#00352F' }}
          >
            <Megaphone className="w-3 h-3" />
            View active: {activeCampaign.name}
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

      {/* Shirt style breakdown */}
      {show('chart_styles') && (loading || stats?.has_catalog_breakdown) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#E5F2F0] rounded-lg flex items-center justify-center">
                <Shirt className="w-4 h-4 text-[#00352F]" />
              </div>
              <CardTitle className="text-sm font-semibold">Shirts Ordered by Style</CardTitle>
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
                          <span>{orders} order{orders !== 1 ? 's' : ''}</span>
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
                  Total: {stats.orders_by_catalog_item.reduce((s, x) => s + x.shirts, 0)} shirts across {stats.orders_by_catalog_item.length} styles
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
              <CardTitle className="text-sm font-semibold">Revenue Over Time</CardTitle>
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
                ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No revenue data</div>}
            </CardContent>
          </Card>
        )}

        {/* Shirts by size */}
        {show('chart_sizes') && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Shirts by Size</CardTitle>
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
                ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No size data</div>}
            </CardContent>
          </Card>
        )}

        {/* Orders by institution */}
        {show('chart_institution') && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Orders by Institution Type</CardTitle>
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
                ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No institution data</div>}
            </CardContent>
          </Card>
        )}

        {/* Payment overview */}
        {show('chart_payment') && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Payment Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-48 w-full" /> : (
                <div className="space-y-3 pt-2">
                  {[
                    { label: 'Paid',      value: stats?.paid_orders || 0,      total: stats?.total_orders || 1, color: 'bg-[#00352F]' },
                    { label: 'Pending',   value: stats?.unpaid_orders || 0,    total: stats?.total_orders || 1, color: 'bg-yellow-400' },
                    { label: 'Delivered', value: stats?.delivered_orders || 0, total: stats?.total_orders || 1, color: 'bg-[#CEDC00]' },
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
