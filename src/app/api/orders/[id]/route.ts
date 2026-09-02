/**
 * @file route.ts
 * @description Public and auth-gated order endpoints by ID.
 * - GET: public — reads a single order by its UUID (used by the confirmation page and
 *   customer status page). The UUID acts as an unguessable capability token; the lookup
 *   uses `createAdminClient()` because orders RLS is locked to service-role only. This
 *   returns exactly one order by exact ID — it cannot be used to list or enumerate orders.
 * - PATCH: auth-gated — requires a session AND the canManageOrders permission; updates
 *   order fields and writes an audit log entry for each changed field.
 *
 * Key invariants:
 * - `order_items` rows from the DB are reshaped and surfaced as `items` in the response.
 * - PATCH auto-sets date_paid when payment_status transitions to 'paid' or 'manual' (if
 *   not already set), and date_delivered when delivery_status transitions to 'delivered'.
 * - Only the fields listed in `allowedFields` can be written; all others are ignored.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── GET /api/orders/[id] ─────────────────────────────────────

/**
 * GET /api/orders/[id] — fetch a single order with its line items. Public endpoint.
 * The order UUID is the capability token; lookup is by exact ID via the service-role
 * client (orders RLS denies anon/session reads). Cannot enumerate or list orders.
 * Response shape: { order: { ...orderRow, items: OrderItem[] } }
 * Note: order_items rows are surfaced under the `items` key (not `order_items`).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createAdminClient()

  const { data: raw, error } = await supabase
    .from('orders')
    .select('*, order_items(id, shirt_size, quantity, catalog_item_name, unit_price, subtotal, created_at)')
    .eq('id', id)
    .single()

  if (error || !raw) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const { order_items, ...rest } = raw as typeof raw & { order_items: unknown[] }
  const order = { ...rest, items: order_items || [] }

  return NextResponse.json({ order })
}

// ─── PATCH /api/orders/[id] ───────────────────────────────────

/**
 * PATCH /api/orders/[id] — update allowed order fields and write audit log entries.
 * Requires authentication (session check only — no fine-grained permission check).
 * Uses `createAdminClient()` for writes (bypasses RLS).
 * Auto-sets date_paid and date_delivered on relevant status transitions.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // ─── Auth & Permission Checks ────────────────────────────────
  // Verify a valid session AND the canManageOrders permission. Without the
  // permission check, any authenticated user — including a deactivated staff
  // member with a still-valid session — could edit any order's PII and payment
  // fields through this route (it is the one the admin order-detail page uses).
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const auth = await requirePermission(user.id, 'canManageOrders')
  if (auth instanceof NextResponse) return auth

  const adminSupabase = await createAdminClient()
  const body = await request.json()

  // Get current order for audit log
  const { data: currentOrder } = await adminSupabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (!currentOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const allowedFields = [
    'payment_status', 'order_status', 'delivery_status',
    'admin_notes', 'date_paid', 'date_delivered',
    'full_name', 'email', 'phone', 'shirt_size', 'quantity',
    'notes', 'school_name', 'grade', 'classroom',
    'organization_name', 'department_office',
    'payment_method',
  ]

  // payment_method: null clears it; otherwise must be a known method (matches the
  // DB CHECK so a typo'd value fails with a clear 400 instead of a DB error).
  if ('payment_method' in body && body.payment_method !== null) {
    const VALID_METHODS = ['paypal', 'venmo', 'card', 'cash', 'ath_movil']
    if (!VALID_METHODS.includes(body.payment_method)) {
      return NextResponse.json({ error: 'Invalid payment_method' }, { status: 400 })
    }
  }

  const updateData: Record<string, unknown> = {}
  const auditEntries: Array<{ order_id: string; field_changed: string; old_value: string | null; new_value: string | null; changed_by: string }> = []

  for (const field of allowedFields) {
    if (field in body) {
      const oldValue = currentOrder[field]
      const newValue = body[field]
      if (String(oldValue) !== String(newValue)) {
        updateData[field] = newValue
        auditEntries.push({
          order_id: id,
          field_changed: field,
          old_value: oldValue ? String(oldValue) : null,
          new_value: newValue ? String(newValue) : null,
          changed_by: user.email || user.id,
        })
      }
    }
  }

  // ─── Per-item size changes (admin swap, e.g. customer tried M, needs L) ───
  // body.item_sizes: [{ id, shirt_size }] — updates order_items rows, keeps the
  // legacy flat orders.shirt_size in sync with the first item, adjusts inventory
  // best-effort (return old size, take new size), and writes audit entries.
  // Allowed at any payment status — swaps happen after purchase by design.
  if (Array.isArray(body.item_sizes) && body.item_sizes.length > 0) {
    const { data: items } = await adminSupabase
      .from('order_items')
      .select('id, catalog_item_id, catalog_item_name, shirt_size, quantity, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: true })

    for (const change of body.item_sizes) {
      const item = items?.find(i => i.id === change.id)
      const newSize = typeof change.shirt_size === 'string' ? change.shirt_size.trim() : ''
      if (!item || !newSize || newSize.length > 30 || newSize === item.shirt_size) continue

      const { error: itemError } = await adminSupabase
        .from('order_items')
        .update({ shirt_size: newSize })
        .eq('id', item.id)
      if (itemError) continue

      auditEntries.push({
        order_id: id,
        field_changed: `item_size (${item.catalog_item_name})`,
        old_value: item.shirt_size,
        new_value: newSize,
        changed_by: user.email || user.id,
      })

      // Inventory swap, best-effort and non-fatal: the physical exchange already
      // happened, so a missing inventory row must never block the size change.
      try {
        const invFor = async (size: string) => {
          const { data: rows } = await adminSupabase
            .from('shirt_inventory')
            .select('id, quantity')
            .eq('shirt_size', size)
            .or(item.catalog_item_id ? `catalog_item_id.eq.${item.catalog_item_id},catalog_item_id.is.null` : 'catalog_item_id.is.null')
            .order('catalog_item_id', { ascending: false, nullsFirst: false })
          return rows?.[0] ?? null
        }
        const oldRow = await invFor(item.shirt_size)
        if (oldRow) {
          await adminSupabase.from('shirt_inventory').update({ quantity: oldRow.quantity + item.quantity }).eq('id', oldRow.id)
        }
        const newRow = await invFor(newSize)
        if (newRow) {
          // RPC refuses to go below zero (returns -1); that's fine — skip silently.
          await adminSupabase.rpc('decrement_shirt_inventory', { p_inventory_id: newRow.id, p_quantity: item.quantity })
        }
      } catch { /* inventory is advisory here */ }

      item.shirt_size = newSize
    }

    // Keep the legacy flat field aligned with the primary (first) item.
    if (items && items.length > 0 && items[0].shirt_size !== currentOrder.shirt_size && !('shirt_size' in updateData)) {
      updateData.shirt_size = items[0].shirt_size
    }
  }

  // Auto-set date_paid when payment_status becomes paid/manual
  if (updateData.payment_status === 'paid' || updateData.payment_status === 'manual') {
    if (!currentOrder.date_paid) {
      updateData.date_paid = new Date().toISOString()
    }
  }

  // Auto-set date_delivered when delivery_status becomes delivered
  if (updateData.delivery_status === 'delivered') {
    if (!currentOrder.date_delivered) {
      updateData.date_delivered = new Date().toISOString()
    }
  }

  // Only touch the orders row when there's something to write — a pure item-size
  // change (e.g. the second line item) may leave updateData empty.
  let order = currentOrder
  if (Object.keys(updateData).length > 0) {
    const { data: updated, error } = await adminSupabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating order:', error)
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }
    order = updated
  }

  // Insert audit log entries
  if (auditEntries.length > 0) {
    await adminSupabase.from('audit_logs').insert(auditEntries)
  }

  return NextResponse.json({ order })
}
