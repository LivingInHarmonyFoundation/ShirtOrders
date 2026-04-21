/**
 * @file route.ts
 * @description Admin single-order endpoint. Auth-gated: requires canManageOrders permission.
 * Returns the order row merged with its `order_items` rows (exposed as `items`) plus the
 * full audit log for that order. Uses `createAdminClient()` (bypasses RLS) for all DB reads.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── GET /api/admin/orders/[id] ───────────────────────────────

/**
 * GET /api/admin/orders/[id] — fetch a single order with its line items and audit log.
 * Requires authentication and canManageOrders permission.
 * Response shape: { order: { ...orderRow, items: OrderItem[] }, auditLogs: AuditLog[] }
 * Note: order_items rows are surfaced under the `items` key (not `order_items`).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ─── Auth & Permission Checks ────────────────────────────────
  const auth = await requirePermission(user.id, 'canManageOrders')
  if (auth instanceof NextResponse) return auth

  const adminSupabase = await createAdminClient()

  const [orderResult, auditResult, itemsResult] = await Promise.all([
    adminSupabase.from('orders').select('*').eq('id', id).single(),
    adminSupabase.from('audit_logs').select('*').eq('order_id', id).order('changed_at', { ascending: false }),
    adminSupabase.from('order_items').select('*').eq('order_id', id).order('created_at', { ascending: true }),
  ])

  if (orderResult.error || !orderResult.data) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({
    order: { ...orderResult.data, items: itemsResult.data || [] },
    auditLogs: auditResult.data || [],
  })
}
