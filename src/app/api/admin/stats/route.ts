/**
 * @file route.ts
 * @description Admin statistics endpoint. GET aggregates order data into summary counts,
 * revenue figures, and breakdowns by institution type, shirt size, date, and catalog item.
 * Supports optional filtering by campaign_id, date_from, and date_to. Requires
 * authentication and the `canViewReports` permission. Uses `createAdminClient()`
 * (bypasses RLS) to query all orders regardless of row policies.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── GET /api/admin/stats ─────────────────────────────────────

/**
 * GET /api/admin/stats — compute and return aggregated order statistics.
 * Requires authentication and the `canViewReports` permission.
 * Supported query parameters (all optional):
 *   campaign_id — filter to a specific campaign ('all' treated as no filter)
 *   date_from   — ISO date string, inclusive lower bound on created_at
 *   date_to     — ISO date string, extended to T23:59:59 to include the full day
 * Uses createAdminClient() (bypasses RLS) to aggregate across all orders.
 * Revenue figures count only orders with payment_status 'paid' or 'manual'.
 * revenue_by_date is limited to the most recent 30 calendar days in the result set.
 * has_catalog_breakdown is true when more than one distinct catalog item is present
 * or when the single item is not 'Unspecified'.
 * Response: {
 *   total_orders, total_shirts, total_revenue,
 *   paid_orders, unpaid_orders, delivered_orders, pending_deliveries,
 *   orders_by_institution, orders_by_size, revenue_by_date,
 *   orders_by_catalog_item, has_catalog_breakdown
 * }
 */
export async function GET(request: NextRequest) {
  // ─── Auth & Permission Checks ────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canViewReports')
  if (auth instanceof NextResponse) return auth

  // ─── Filter Parameters ────────────────────────────────────────
  const { searchParams } = request.nextUrl
  const campaign_id = searchParams.get('campaign_id') || ''
  const date_from = searchParams.get('date_from') || ''
  const date_to = searchParams.get('date_to') || ''

  // ─── Query & Filtering ────────────────────────────────────────
  // createAdminClient() bypasses RLS — required to aggregate all orders
  const adminSupabase = await createAdminClient()

  let query = adminSupabase
    .from('orders')
    .select('quantity, total_amount, payment_status, delivery_status, institution_type, shirt_size, created_at, catalog_item_name')

  // 'all' is the UI sentinel for "no campaign filter" — treat it as unfiltered
  if (campaign_id && campaign_id !== 'all') {
    query = query.eq('campaign_id', campaign_id)
  }
  if (date_from) {
    query = query.gte('created_at', date_from)
  }
  // Extend date_to to end-of-day so the full day is included in the range
  if (date_to) {
    query = query.lte('created_at', date_to + 'T23:59:59')
  }

  const { data: orders } = await query

  if (!orders) return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })

  // ─── Aggregate Computations ───────────────────────────────────

  // Summary totals
  const total_orders = orders.length
  const total_shirts = orders.reduce((sum, o) => sum + o.quantity, 0)
  // Revenue only counts paid and manually-confirmed orders
  const total_revenue = orders
    .filter(o => o.payment_status === 'paid' || o.payment_status === 'manual')
    .reduce((sum, o) => sum + Number(o.total_amount), 0)

  // Payment status breakdown
  const paid_orders = orders.filter(o => o.payment_status === 'paid' || o.payment_status === 'manual').length
  const unpaid_orders = orders.filter(o => o.payment_status === 'pending' || o.payment_status === 'failed').length

  // Delivery status breakdown
  const delivered_orders = orders.filter(o => o.delivery_status === 'delivered').length
  const pending_deliveries = orders.filter(o => o.delivery_status === 'not_delivered' || o.delivery_status === 'partially_delivered').length

  // Orders grouped by institution type
  const institutionMap = new Map<string, number>()
  orders.forEach(o => {
    institutionMap.set(o.institution_type, (institutionMap.get(o.institution_type) || 0) + 1)
  })
  const orders_by_institution = Array.from(institutionMap.entries()).map(([institution_type, count]) => ({ institution_type, count }))

  // Shirt quantity grouped by size
  const sizeMap = new Map<string, number>()
  orders.forEach(o => {
    sizeMap.set(o.shirt_size, (sizeMap.get(o.shirt_size) || 0) + o.quantity)
  })
  const orders_by_size = Array.from(sizeMap.entries()).map(([shirt_size, count]) => ({ shirt_size, count }))

  // Paid revenue grouped by calendar date, limited to the most recent 30 days in the set
  const dateMap = new Map<string, number>()
  orders
    .filter(o => o.payment_status === 'paid' || o.payment_status === 'manual')
    .forEach(o => {
      const date = o.created_at.split('T')[0]
      dateMap.set(date, (dateMap.get(date) || 0) + Number(o.total_amount))
    })
  const revenue_by_date = Array.from(dateMap.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)

  // Orders and shirt counts grouped by catalog item name
  const catalogMap = new Map<string, { orders: number; shirts: number }>()
  orders.forEach(o => {
    const name = o.catalog_item_name || 'Unspecified'
    const existing = catalogMap.get(name) || { orders: 0, shirts: 0 }
    catalogMap.set(name, { orders: existing.orders + 1, shirts: existing.shirts + o.quantity })
  })
  const orders_by_catalog_item = Array.from(catalogMap.entries())
    .map(([name, { orders, shirts }]) => ({ name, orders, shirts }))
    .sort((a, b) => b.shirts - a.shirts)

  // True when there is meaningful per-item data to display in the UI
  const has_catalog_breakdown = orders_by_catalog_item.length > 1 ||
    (orders_by_catalog_item.length === 1 && orders_by_catalog_item[0].name !== 'Unspecified')

  return NextResponse.json({
    total_orders,
    total_shirts,
    total_revenue,
    paid_orders,
    unpaid_orders,
    delivered_orders,
    pending_deliveries,
    orders_by_institution,
    orders_by_size,
    revenue_by_date,
    orders_by_catalog_item,
    has_catalog_breakdown,
  })
}
