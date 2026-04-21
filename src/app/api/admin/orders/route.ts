/**
 * @file route.ts
 * @description Admin orders list — paginated GET with rich filtering, sorting, and summary
 * aggregation; bulk PATCH for status updates. Both handlers require canManageOrders.
 *
 * Key invariants:
 * - `order_items` rows joined from the DB are reshaped to `items` in every order object
 *   returned by GET.
 * - GET runs two parallel Supabase queries: one paginated for the current page, and one
 *   unbounded summary query that aggregates shirts/revenue/by-size across the full filter
 *   set (not just the current page).
 * - Bulk PATCH (PATCH) is limited to BULK_ORDER_ALLOWED_FIELDS to prevent mass-assignment.
 * - `createAdminClient()` bypasses RLS; auth check done separately via session client.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// Fields allowed in bulk PATCH — prevents mass-assignment of sensitive columns.
const BULK_ORDER_ALLOWED_FIELDS = [
  'payment_status', 'order_status', 'delivery_status',
  'admin_notes', 'date_paid', 'date_delivered',
]

// ─── GET /api/admin/orders ────────────────────────────────────

/**
 * GET /api/admin/orders — paginated, filtered, sorted order list with summary aggregates.
 * Requires canManageOrders permission.
 * Query params: search, institution_type, payment_status, delivery_status, shirt_size,
 *   date_from, date_to, grade, classroom, department, organization_name, school_name,
 *   company_name, campaign_id, sort, page, limit (max 200).
 * Response: { orders, total, page, limit, total_pages, summary }
 * Note: order_items rows are surfaced under `items` on each order object.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ─── Auth & Permission Checks ────────────────────────────────
  const auth = await requirePermission(user.id, 'canManageOrders')
  if (auth instanceof NextResponse) return auth

  const adminSupabase = await createAdminClient()
  const { searchParams } = request.nextUrl

  const search = searchParams.get('search') || ''
  const institution_type = searchParams.get('institution_type') || ''
  const payment_status = searchParams.get('payment_status') || ''
  const delivery_status = searchParams.get('delivery_status') || ''
  const shirt_size = searchParams.get('shirt_size') || ''
  const date_from = searchParams.get('date_from') || ''
  const date_to = searchParams.get('date_to') || ''
  const grade = searchParams.get('grade') || ''
  const classroom = searchParams.get('classroom') || ''
  const department = searchParams.get('department') || ''
  const organization_name = searchParams.get('organization_name') || ''
  const school_name = searchParams.get('school_name') || ''
  const company_name = searchParams.get('company_name') || ''
  const campaign_id = searchParams.get('campaign_id') || ''
  const sort = searchParams.get('sort') || 'newest'
  const page = parseInt(searchParams.get('page') || '1')
  const rawLimit = parseInt(searchParams.get('limit') || '20')
  const limit = Math.min(Math.max(1, rawLimit), 200)
  const offset = (page - 1) * limit

  let query = adminSupabase.from('orders').select('*, order_items(id, shirt_size, quantity, catalog_item_name, unit_price, subtotal)', { count: 'exact' })

  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,email.ilike.%${search}%,order_number.ilike.%${search}%,school_name.ilike.%${search}%,organization_name.ilike.%${search}%,department_office.ilike.%${search}%,company_name.ilike.%${search}%,company_department.ilike.%${search}%,grade.ilike.%${search}%,classroom.ilike.%${search}%`
    )
  }

  if (institution_type) query = query.eq('institution_type', institution_type)
  if (payment_status) query = query.eq('payment_status', payment_status)
  if (delivery_status) query = query.eq('delivery_status', delivery_status)
  if (shirt_size) query = query.eq('shirt_size', shirt_size)
  if (date_from) query = query.gte('created_at', date_from)
  if (date_to) query = query.lte('created_at', date_to + 'T23:59:59')
  if (grade) query = query.ilike('grade', `%${grade}%`)
  if (classroom) query = query.ilike('classroom', `%${classroom}%`)
  if (department) query = query.or(`department_office.ilike.%${department}%,company_department.ilike.%${department}%`)
  if (organization_name) query = query.eq('organization_name', organization_name)
  if (school_name) query = query.eq('school_name', school_name)
  if (company_name) query = query.eq('company_name', company_name)
  if (campaign_id && campaign_id !== 'all') query = query.eq('campaign_id', campaign_id)

  switch (sort) {
    case 'oldest':
      query = query.order('created_at', { ascending: true })
      break
    case 'paid':
      query = query.eq('payment_status', 'paid').order('date_paid', { ascending: false })
      break
    case 'unpaid':
      query = query.eq('payment_status', 'pending').order('created_at', { ascending: false })
      break
    case 'delivered':
      query = query.eq('delivery_status', 'delivered').order('date_delivered', { ascending: false })
      break
    case 'not_delivered':
      query = query.eq('delivery_status', 'not_delivered').order('created_at', { ascending: false })
      break
    default:
      query = query.order('created_at', { ascending: false })
  }

  // Run paginated query and summary aggregation in parallel
  const pagedQuery = query.range(offset, offset + limit - 1)

  // Summary query uses same filters but fetches only the fields needed for aggregation
  let summaryQuery = adminSupabase
    .from('orders')
    .select('quantity, total_amount, shirt_size, catalog_item_name, order_items(shirt_size, quantity)')

  if (search) {
    summaryQuery = summaryQuery.or(
      `full_name.ilike.%${search}%,email.ilike.%${search}%,order_number.ilike.%${search}%,school_name.ilike.%${search}%,organization_name.ilike.%${search}%,department_office.ilike.%${search}%,company_name.ilike.%${search}%,company_department.ilike.%${search}%,grade.ilike.%${search}%,classroom.ilike.%${search}%`
    )
  }
  if (institution_type) summaryQuery = summaryQuery.eq('institution_type', institution_type)
  if (payment_status) summaryQuery = summaryQuery.eq('payment_status', payment_status)
  if (delivery_status) summaryQuery = summaryQuery.eq('delivery_status', delivery_status)
  if (shirt_size) summaryQuery = summaryQuery.eq('shirt_size', shirt_size)
  if (date_from) summaryQuery = summaryQuery.gte('created_at', date_from)
  if (date_to) summaryQuery = summaryQuery.lte('created_at', date_to + 'T23:59:59')
  if (grade) summaryQuery = summaryQuery.ilike('grade', `%${grade}%`)
  if (classroom) summaryQuery = summaryQuery.ilike('classroom', `%${classroom}%`)
  if (department) summaryQuery = summaryQuery.or(`department_office.ilike.%${department}%,company_department.ilike.%${department}%`)
  if (organization_name) summaryQuery = summaryQuery.eq('organization_name', organization_name)
  if (school_name) summaryQuery = summaryQuery.eq('school_name', school_name)
  if (company_name) summaryQuery = summaryQuery.eq('company_name', company_name)
  if (campaign_id && campaign_id !== 'all') summaryQuery = summaryQuery.eq('campaign_id', campaign_id)

  const [{ data: ordersRaw, error, count }, { data: summaryRows }] = await Promise.all([
    pagedQuery,
    summaryQuery,
  ])

  if (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }

  // Reshape orders: expose order_items as `items`
  const orders = (ordersRaw || []).map((o: Record<string, unknown>) => {
    const { order_items, ...rest } = o
    return { ...rest, items: (order_items as unknown[]) || [] }
  })

  // Compute summary aggregates — use order_items for accurate by-size counts
  const allRows = (summaryRows || []) as Array<{
    quantity: number; total_amount: number; shirt_size: string; catalog_item_name: string | null;
    order_items: Array<{ shirt_size: string; quantity: number }> | null
  }>
  const totalShirts = allRows.reduce((s, r) => s + (r.quantity || 0), 0)
  const totalRevenue = allRows.reduce((s, r) => s + (r.total_amount || 0), 0)

  const bySize: Record<string, { orders: number; shirts: number }> = {}
  const byItem: Record<string, { orders: number; shirts: number }> = {}
  for (const r of allRows) {
    const items = r.order_items
    if (items && items.length > 0) {
      // Use line items for accurate per-size counts
      const sizesInOrder = new Set<string>()
      for (const item of items) {
        const sz = item.shirt_size || 'Unknown'
        if (!bySize[sz]) bySize[sz] = { orders: 0, shirts: 0 }
        bySize[sz].shirts += item.quantity || 0
        sizesInOrder.add(sz)
      }
      for (const sz of sizesInOrder) bySize[sz].orders++
    } else {
      // Legacy fallback for orders before order_items existed
      const sz = r.shirt_size || 'Unknown'
      if (!bySize[sz]) bySize[sz] = { orders: 0, shirts: 0 }
      bySize[sz].orders++
      bySize[sz].shirts += r.quantity || 0
    }

    const item = r.catalog_item_name || null
    if (item) {
      if (!byItem[item]) byItem[item] = { orders: 0, shirts: 0 }
      byItem[item].orders++
      byItem[item].shirts += r.quantity || 0
    }
  }

  return NextResponse.json({
    orders,
    total: count || 0,
    page,
    limit,
    total_pages: Math.ceil((count || 0) / limit),
    summary: {
      total_orders: count || 0,
      total_shirts: totalShirts,
      total_revenue: totalRevenue,
      by_size: Object.entries(bySize).map(([size, v]) => ({ size, ...v })),
      by_catalog_item: Object.entries(byItem).map(([name, v]) => ({ name, ...v })),
    },
  })
}

// ─── PATCH /api/admin/orders ──────────────────────────────────

/**
 * PATCH /api/admin/orders — bulk update status fields on multiple orders.
 * Requires canManageOrders permission.
 * Body: { ids: string[], updates: Partial<Record<BULK_ORDER_ALLOWED_FIELDS, unknown>> }
 * Only fields in BULK_ORDER_ALLOWED_FIELDS are applied; others are silently ignored.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ─── Auth & Permission Checks ────────────────────────────────
  const auth = await requirePermission(user.id, 'canManageOrders')
  if (auth instanceof NextResponse) return auth

  const adminSupabase = await createAdminClient()
  const { ids, updates } = await request.json()

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No order IDs provided' }, { status: 400 })
  }

  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
  }

  // Whitelist allowed fields to prevent mass-assignment
  const safeUpdates: Record<string, unknown> = {}
  for (const field of BULK_ORDER_ALLOWED_FIELDS) {
    if (field in updates) safeUpdates[field] = updates[field]
  }

  if (Object.keys(safeUpdates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await adminSupabase
    .from('orders')
    .update(safeUpdates)
    .in('id', ids)

  if (error) {
    return NextResponse.json({ error: 'Failed to update orders' }, { status: 500 })
  }

  return NextResponse.json({ success: true, updated: ids.length })
}
