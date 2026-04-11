'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ShoppingBag, DollarSign, CreditCard, Package,
  TrendingUp, Users, Truck, Clock
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { DashboardStats } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, LabelList
} from 'recharts'
import { Shirt } from 'lucide-react'

const COLORS = ['#1B4D2E', '#8DC63F', '#2D6A4F', '#5fa832', '#0D2E1A', '#4a8a28', '#3d7a20']

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const statCards = [
    { label: 'Total Orders',     value: stats?.total_orders ?? 0,          icon: ShoppingBag, color: 'text-[#1B4D2E]',  bg: 'bg-[#EFF8E8] dark:bg-green-900/20',   format: (v: number) => v.toString() },
    { label: 'Total Revenue',    value: stats?.total_revenue ?? 0,          icon: DollarSign,  color: 'text-[#1B4D2E]',  bg: 'bg-[#EFF8E8] dark:bg-green-900/20',   format: formatCurrency },
    { label: 'Paid Orders',      value: stats?.paid_orders ?? 0,            icon: CreditCard,  color: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-900/20', format: (v: number) => v.toString() },
    { label: 'Unpaid Orders',    value: stats?.unpaid_orders ?? 0,          icon: Clock,       color: 'text-yellow-600',  bg: 'bg-yellow-50 dark:bg-yellow-900/20',  format: (v: number) => v.toString() },
    { label: 'Total Shirts',     value: stats?.total_shirts ?? 0,           icon: Package,     color: 'text-[#2D6A4F]',  bg: 'bg-green-50 dark:bg-green-900/20',    format: (v: number) => v.toString() },
    { label: 'Delivered',        value: stats?.delivered_orders ?? 0,       icon: Truck,       color: 'text-teal-700',    bg: 'bg-teal-50 dark:bg-teal-900/20',      format: (v: number) => v.toString() },
    { label: 'Pending Delivery', value: stats?.pending_deliveries ?? 0,     icon: TrendingUp,  color: 'text-orange-600',  bg: 'bg-orange-50 dark:bg-orange-900/20',  format: (v: number) => v.toString() },
    { label: 'Institutions',     value: stats?.orders_by_institution.length ?? 0, icon: Users, color: 'text-[#1B4D2E]',  bg: 'bg-[#EFF8E8] dark:bg-green-900/20',   format: (v: number) => v.toString() },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Overview of all orders and revenue</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg, format }) => (
          <Card key={label}>
            <CardContent className="p-4">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-16" />
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{format(value)}</p>
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

      {/* Shirt style breakdown — only when multiple catalog items exist */}
      {(loading || stats?.has_catalog_breakdown) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#EFF8E8] rounded-lg flex items-center justify-center">
                <Shirt className="w-4 h-4 text-[#1B4D2E]" />
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
                          <span className="font-bold text-[#1B4D2E] text-sm">{shirts} shirts</span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                        />
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
        {/* Revenue by date */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : stats?.revenue_by_date && stats.revenue_by_date.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.revenue_by_date}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} labelFormatter={(l) => `Date: ${l}`} />
                  <Line type="monotone" dataKey="revenue" stroke="#1B4D2E" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No revenue data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Orders by size */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Shirts by Size</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : stats?.orders_by_size && stats.orders_by_size.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.orders_by_size}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="shirt_size" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1B4D2E" radius={[4, 4, 0, 0]}>
                    {stats.orders_by_size.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No size data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Orders by institution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Orders by Institution Type</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : stats?.orders_by_institution && stats.orders_by_institution.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats.orders_by_institution}
                    dataKey="count"
                    nameKey="institution_type"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {stats.orders_by_institution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend formatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No institution data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Payment breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Payment Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="space-y-3 pt-2">
                {[
                  { label: 'Paid',      value: stats?.paid_orders || 0,      total: stats?.total_orders || 1, color: 'bg-[#1B4D2E]' },
                  { label: 'Pending',   value: stats?.unpaid_orders || 0,    total: stats?.total_orders || 1, color: 'bg-yellow-400' },
                  { label: 'Delivered', value: stats?.delivered_orders || 0, total: stats?.total_orders || 1, color: 'bg-[#8DC63F]' },
                ].map(({ label, value, total, color }) => {
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 dark:text-gray-400">{label}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{value} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
