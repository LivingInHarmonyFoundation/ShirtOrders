/**
 * @file checkout.ts
 * @description SERVER-ONLY. The order pipeline split in two so an `orders` row is
 * only ever written at the moment of payment ("pay before order"):
 *
 *   prepareOrder(body)  — validates the submission against the active campaign,
 *                         app settings, catalog sizes and stock, and prices it
 *                         SERVER-SIDE (per-size prices, fees, shipping). Returns a
 *                         PreparedOrder that is stored verbatim in a
 *                         checkout_sessions row. No orders row is touched.
 *
 *   persistOrder(...)   — turns a PreparedOrder into a real orders row + its
 *                         order_items, decrements inventory and fires the admin
 *                         notification. Called from exactly three places:
 *                           • PayPal capture       → payment_status 'paid'
 *                           • staff ATH Móvil      → payment_status 'paid'
 *                           • customer picks cash  → payment_status 'pending'
 *
 * Key invariants:
 * - Uses `createAdminClient()` (bypasses RLS): unauthenticated write paths.
 * - PayPal/ATH paths never fail on an inventory race (money is already in hand);
 *   the cash path does, exactly like the old POST /api/orders did.
 * - The 2-minute duplicate guard only applies to the cash path — a captured
 *   payment must always produce an order.
 */
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateOrderNumber } from '@/lib/utils'
import { sendOrderNotifications, sendLowInventoryNotification } from '@/lib/notifications'
import { getCheapestShippingRate, SHIRT_WEIGHT_OZ } from '@/lib/shippo'
import type { OrderFee, PaymentMethod } from '@/types'

// ─── Validation Schemas ───────────────────────────────────────

const cartItemSchema = z.object({
  catalog_item_id: z.string().uuid().nullable().optional(),
  catalog_item_name: z.string().min(1),
  shirt_size: z.string().min(1).max(20),
  quantity: z.number().int().positive().max(500),
})

export const orderSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  institution_type: z.enum(['school', 'government', 'personal', 'private_company', 'staff', 'municipality']),
  school_name: z.string().optional(),
  grade: z.string().optional(),
  classroom: z.string().optional(),
  organization_name: z.string().optional(),
  department_office: z.string().optional(),
  region: z.string().optional(),
  company_name: z.string().optional(),
  company_department: z.string().optional(),
  delivery_address: z.string().optional(),
  delivery_city: z.string().optional(),
  delivery_state: z.string().optional(),
  delivery_zip: z.string().optional(),
  notes: z.string().optional(),
  school_link_id: z.string().uuid().optional(),
  company_link_id: z.string().uuid().optional(),
  campaign_id: z.string().uuid().optional(),
  // Multi-item cart submission
  items: z.array(cartItemSchema).min(1).max(50).optional(),
  // Legacy single-item fields (kept for backwards compat; ignored when items is present)
  shirt_size: z.string().min(1).max(20).optional(),
  quantity: z.number().int().positive().max(500).optional(),
  catalog_item_id: z.string().uuid().optional(),
  catalog_item_name: z.string().optional(),
})

export type OrderSubmission = z.infer<typeof orderSchema>

// ─── Types ────────────────────────────────────────────────────

export interface AppliedFee { name: string; type: 'percentage' | 'fixed'; value: number; amount: number }

export interface PreparedItem {
  catalog_item_id: string | null
  catalog_item_name: string
  shirt_size: string
  quantity: number
  unit_price: number
  subtotal: number
}

/** Everything needed to insert an order later. Stored as JSON in checkout_sessions.payload. */
export interface PreparedOrder {
  full_name: string
  email: string
  phone: string | null
  institution_type: OrderSubmission['institution_type']
  school_name: string | null
  grade: string | null
  classroom: string | null
  organization_name: string | null
  department_office: string | null
  region: string | null
  company_name: string | null
  company_department: string | null
  delivery_address: string | null
  notes: string | null
  school_link_id: string | null
  company_link_id: string | null
  campaign_id: string
  order_allowed_payment_methods: string[] | null
  items: PreparedItem[]
  subtotal: number
  applied_fees: AppliedFee[]
  /** subtotal + fees, before any discount */
  base_total: number
  discount_code: string | null
  discount_amount: number
  /** base_total − discount_amount: what the customer is charged */
  total_amount: number
}

export interface NotificationSettings {
  admin_phone?: string | null
  sms_notifications_enabled?: boolean
}

export type PrepareResult =
  | { ok: true; prepared: PreparedOrder; settings: NotificationSettings }
  | { ok: false; error: string; status: number }

export type PersistResult =
  | { ok: true; order: Record<string, unknown> & { id: string; order_number: string } }
  | { ok: false; error: string; status: number }

// ─── Helpers ─────────────────────────────────────────────────

/**
 * isInAnnualWindow — returns true if `now` falls within the annual recurrence window
 * defined by the month+day of startDate and endDate. Year is ignored; only the
 * month-day portion matters. Handles windows that span a year boundary (e.g. Nov–Jan).
 */
function isInAnnualWindow(now: Date, startDate: string, endDate: string): boolean {
  const s = new Date(startDate)
  const e = new Date(endDate)
  const nowMD = now.getMonth() * 100 + now.getDate()
  const startMD = s.getMonth() * 100 + s.getDate()
  const endMD = e.getMonth() * 100 + e.getDate()
  if (startMD <= endMD) return nowMD >= startMD && nowMD <= endMD
  return nowMD >= startMD || nowMD <= endMD
}

/** Best matching inventory row: catalog-specific first, then the general (null catalog) row. */
async function findInventoryRow(admin: SupabaseClient, item: { catalog_item_id: string | null; shirt_size: string }) {
  const { data } = await admin
    .from('shirt_inventory')
    .select('id, quantity, low_stock_threshold')
    .eq('shirt_size', item.shirt_size)
    .or(
      item.catalog_item_id
        ? `catalog_item_id.eq.${item.catalog_item_id},catalog_item_id.is.null`
        : 'catalog_item_id.is.null'
    )
    .order('catalog_item_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  return data
}

/** Recompute the charged total after a (possibly null) discount. */
export function withDiscount(prepared: PreparedOrder, discount: { code: string; amount: number } | null): PreparedOrder {
  const discount_amount = discount ? Math.min(discount.amount, prepared.base_total) : 0
  return {
    ...prepared,
    discount_code: discount?.code ?? null,
    discount_amount,
    total_amount: Math.max(0, Math.round((prepared.base_total - discount_amount) * 100) / 100),
  }
}

// ─── prepareOrder ─────────────────────────────────────────────

/**
 * prepareOrder — validate + price a submission without writing an order.
 * Mirrors every gate the old POST /api/orders enforced (campaign, per-type
 * toggles, sizes, stock, allowed payment methods, fees, personal shipping).
 */
export async function prepareOrder(admin: SupabaseClient, body: unknown): Promise<PrepareResult> {
  const parsed = orderSchema.safeParse(body)
  if (!parsed.success) return { ok: false, error: 'Invalid data', status: 400 }
  const data = parsed.data

  // Build the list of effectively active campaigns. Multiple campaigns can be
  // active simultaneously; recurring ones are also checked against their window.
  const { data: enabledCampaigns } = await admin
    .from('campaigns')
    .select('id, end_date, ended_message, start_date, is_recurring')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const effectiveCampaigns = (enabledCampaigns || []).filter(c => {
    if (c.is_recurring && c.start_date && c.end_date) return isInAnnualWindow(now, c.start_date, c.end_date)
    if (c.end_date && c.end_date < todayStr) return false
    return true
  })
  if (effectiveCampaigns.length === 0) return { ok: false, error: 'Orders are not currently open.', status: 400 }

  let selectedCampaign = effectiveCampaigns[0]
  if (data.campaign_id) {
    const matched = effectiveCampaigns.find(c => c.id === data.campaign_id)
    if (!matched) return { ok: false, error: 'Selected campaign is no longer active.', status: 400 }
    selectedCampaign = matched
  }

  const { data: settings } = await admin
    .from('app_settings')
    .select('shirt_price, school_orders_enabled, government_orders_enabled, personal_orders_enabled, private_company_orders_enabled, staff_orders_enabled, municipality_orders_enabled, available_sizes, admin_phone, sms_notifications_enabled, personal_allowed_payment_methods, cash_enabled, order_fees, personal_shipping_pr, personal_shipping_other')
    .single()
  if (!settings) return { ok: false, error: 'Settings not found', status: 500 }

  if (data.institution_type === 'school' && !settings.school_orders_enabled)
    return { ok: false, error: 'School orders are currently disabled', status: 400 }
  if (data.institution_type === 'government' && !settings.government_orders_enabled)
    return { ok: false, error: 'Government orders are currently disabled', status: 400 }
  if (data.institution_type === 'personal' && settings.personal_orders_enabled === false)
    return { ok: false, error: 'Personal orders are currently disabled', status: 400 }
  if (data.institution_type === 'private_company' && settings.private_company_orders_enabled === false)
    return { ok: false, error: 'Private company orders are currently disabled', status: 400 }
  if (data.institution_type === 'municipality' && settings.municipality_orders_enabled === false)
    return { ok: false, error: 'Municipality orders are currently disabled', status: 403 }
  if (data.institution_type === 'staff' && settings.staff_orders_enabled !== true)
    return { ok: false, error: 'Staff orders are currently disabled', status: 400 }

  // Normalise items: `items` array, else legacy single-item fields
  const cartItems = data.items && data.items.length > 0
    ? data.items
    : (data.shirt_size && data.quantity)
      ? [{ catalog_item_id: data.catalog_item_id ?? null, catalog_item_name: data.catalog_item_name ?? 'Shirt', shirt_size: data.shirt_size, quantity: data.quantity }]
      : null
  if (!cartItems || cartItems.length === 0) return { ok: false, error: 'No items provided', status: 400 }

  // Catalog rows for per-item price and size validation
  const catalogItemIds = [...new Set(cartItems.map(i => i.catalog_item_id).filter(Boolean))] as string[]
  const catalogMap: Record<string, { price: number | null; available_sizes: string[] | null; size_prices: Record<string, number> | null }> = {}
  if (catalogItemIds.length > 0) {
    const { data: catalogRows } = await admin
      .from('shirt_catalog')
      .select('id, price, available_sizes, size_prices')
      .in('id', catalogItemIds)
    for (const row of catalogRows ?? []) catalogMap[row.id] = row
  }

  for (const item of cartItems) {
    const catalogItem = item.catalog_item_id ? catalogMap[item.catalog_item_id] : null
    const allowedSizes = catalogItem?.available_sizes ?? settings.available_sizes
    if (!allowedSizes.includes(item.shirt_size)) {
      return { ok: false, error: `Shirt size "${item.shirt_size}" is not available`, status: 400 }
    }
  }

  // Inventory pre-check — tell the customer early. The atomic decrement
  // (with race protection) happens in persistOrder at payment time.
  for (const item of cartItems) {
    const invCheck = await findInventoryRow(admin, { catalog_item_id: item.catalog_item_id ?? null, shirt_size: item.shirt_size })
    if (invCheck && invCheck.quantity < item.quantity) {
      return { ok: false, error: `Sorry, only ${invCheck.quantity} unit(s) of size "${item.shirt_size}" are left in stock.`, status: 400 }
    }
  }

  // Allowed payment methods from the entity
  let orderAllowedPaymentMethods: string[] | null = null
  if (data.institution_type === 'school' && data.school_link_id) {
    const { data: school } = await admin.from('school_links').select('allowed_payment_methods').eq('id', data.school_link_id).single()
    orderAllowedPaymentMethods = school?.allowed_payment_methods ?? null
  } else if (data.institution_type === 'private_company' && data.company_link_id) {
    const { data: company } = await admin.from('private_companies').select('allowed_payment_methods').eq('id', data.company_link_id).single()
    orderAllowedPaymentMethods = company?.allowed_payment_methods ?? null
  } else if (data.institution_type === 'government' && data.organization_name) {
    const { data: org } = await admin.from('government_orgs').select('allowed_payment_methods').ilike('name', data.organization_name).eq('is_active', true).single()
    orderAllowedPaymentMethods = org?.allowed_payment_methods ?? null
  } else if (data.institution_type === 'personal') {
    orderAllowedPaymentMethods = settings.personal_allowed_payment_methods ?? null
  }
  if (!settings.cash_enabled && orderAllowedPaymentMethods) {
    orderAllowedPaymentMethods = orderAllowedPaymentMethods.filter(m => m !== 'cash')
  }

  // Per-item price by size (size_prices override → item price → global price).
  // Priced server-side so a tampered client cart cannot dictate the amount charged.
  const resolvePrice = (catalogItemId: string | null | undefined, size: string) => {
    const catalogItem = catalogItemId ? catalogMap[catalogItemId] : null
    const sizeOverride = catalogItem?.size_prices?.[size]
    return sizeOverride ?? catalogItem?.price ?? settings.shirt_price
  }

  const items: PreparedItem[] = cartItems.map(item => {
    const unit_price = resolvePrice(item.catalog_item_id, item.shirt_size)
    return {
      catalog_item_id: item.catalog_item_id ?? null,
      catalog_item_name: item.catalog_item_name,
      shirt_size: item.shirt_size,
      quantity: item.quantity,
      unit_price,
      subtotal: Math.round(item.quantity * unit_price * 100) / 100,
    }
  })

  const total_quantity = items.reduce((s, i) => s + i.quantity, 0)
  const subtotal = Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100

  // Fees apply against the subtotal (not cumulative); applies_to null/[] = all types.
  const fees = (settings.order_fees || []) as OrderFee[]
  const applied_fees: AppliedFee[] = fees
    .filter(fee => !fee.applies_to || fee.applies_to.length === 0 || fee.applies_to.includes(data.institution_type))
    .map(fee => ({
      name: fee.name,
      type: fee.type,
      value: fee.value,
      amount: fee.type === 'percentage' ? Math.round(subtotal * (fee.value / 100) * 100) / 100 : fee.value,
    }))

  // Personal-order shipping — live Shippo quote by address, flat-rate fallback by ZIP.
  if (data.institution_type === 'personal') {
    let shipCost: number | null = null
    if (data.delivery_zip) {
      shipCost = await getCheapestShippingRate(
        { city: data.delivery_city, state: data.delivery_state, zip: data.delivery_zip },
        SHIRT_WEIGHT_OZ * total_quantity,
      )
    }
    if (shipCost === null) {
      const zipNum = parseInt((data.delivery_zip || '').replace(/\D/g, '').slice(0, 5) || '0', 10)
      const isPR = zipNum >= 600 && zipNum <= 999
      shipCost = Number(isPR ? settings.personal_shipping_pr : settings.personal_shipping_other) || 0
    }
    if (shipCost > 0) applied_fees.push({ name: 'Shipping', type: 'fixed', value: shipCost, amount: shipCost })
  }

  const feesTotal = applied_fees.reduce((s, f) => s + f.amount, 0)
  const base_total = Math.round((subtotal + feesTotal) * 100) / 100

  const prepared: PreparedOrder = {
    full_name: data.full_name,
    email: data.email,
    phone: data.phone || null,
    institution_type: data.institution_type,
    school_name: data.school_name || null,
    grade: data.grade || null,
    classroom: data.classroom || null,
    organization_name: data.organization_name || null,
    department_office: data.department_office || null,
    region: data.region || null,
    company_name: data.company_name || null,
    company_department: data.company_department || null,
    delivery_address: data.delivery_address || null,
    notes: data.notes || null,
    school_link_id: data.school_link_id || null,
    company_link_id: data.company_link_id || null,
    campaign_id: selectedCampaign.id,
    order_allowed_payment_methods: orderAllowedPaymentMethods,
    items,
    subtotal,
    applied_fees,
    base_total,
    discount_code: null,
    discount_amount: 0,
    total_amount: base_total,
  }

  return {
    ok: true,
    prepared,
    settings: { admin_phone: settings.admin_phone, sms_notifications_enabled: settings.sms_notifications_enabled },
  }
}

// ─── persistOrder ─────────────────────────────────────────────

export interface PersistOptions {
  payment_status: 'pending' | 'paid'
  payment_method: PaymentMethod | null
  /** Who to record in audit_logs for a paid order ('paypal', 'staff-checkout'). */
  changed_by?: string
  /**
   * Cash path only: reject if the same email + first-item size + qty already has
   * an order from the last 2 minutes (double-click / refresh resubmits).
   */
  duplicateGuard?: boolean
  /**
   * When the payment is already captured we must NOT drop the order on an
   * inventory race — the admin sorts out stock; the customer keeps their receipt.
   */
  failOnStockRace?: boolean
}

/**
 * persistOrder — insert the orders row + order_items, decrement inventory,
 * write the payment audit entry (paid path) and notify the admin.
 */
export async function persistOrder(
  admin: SupabaseClient,
  prepared: PreparedOrder,
  opts: PersistOptions,
): Promise<PersistResult> {
  const { items } = prepared
  if (items.length === 0) return { ok: false, error: 'No items provided', status: 400 }
  const primaryItem = items[0]

  if (opts.duplicateGuard) {
    const dupWindowStart = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const { data: existing } = await admin
      .from('orders')
      .select('id')
      .eq('email', prepared.email)
      .eq('shirt_size', primaryItem.shirt_size)
      .eq('quantity', items.reduce((s, i) => s + i.quantity, 0))
      .gte('created_at', dupWindowStart)
      .limit(1)
    if (existing && existing.length > 0) {
      return { ok: false, error: 'A similar order was recently submitted. Please wait a few minutes before trying again.', status: 409 }
    }
  }

  const nowIso = new Date().toISOString()
  const { data: order, error } = await admin
    .from('orders')
    .insert({
      order_number: generateOrderNumber(),
      full_name: prepared.full_name,
      email: prepared.email,
      phone: prepared.phone,
      institution_type: prepared.institution_type,
      school_name: prepared.school_name,
      grade: prepared.grade,
      classroom: prepared.classroom,
      organization_name: prepared.organization_name,
      department_office: prepared.department_office,
      region: prepared.region,
      company_name: prepared.company_name,
      company_department: prepared.company_department,
      delivery_address: prepared.delivery_address,
      // Legacy flat fields mirror the first item (as the old endpoint did)
      shirt_size: primaryItem.shirt_size,
      quantity: items.reduce((s, i) => s + i.quantity, 0),
      unit_price: primaryItem.unit_price,
      total_amount: prepared.total_amount,
      notes: prepared.notes,
      applied_fees: prepared.applied_fees.length > 0 ? prepared.applied_fees : null,
      discount_code: prepared.discount_code,
      discount_amount: prepared.discount_amount,
      school_link_id: prepared.school_link_id,
      company_link_id: prepared.company_link_id,
      order_allowed_payment_methods: prepared.order_allowed_payment_methods,
      catalog_item_id: primaryItem.catalog_item_id,
      catalog_item_name: primaryItem.catalog_item_name,
      campaign_id: prepared.campaign_id,
      payment_status: opts.payment_status,
      payment_method: opts.payment_method,
      date_paid: opts.payment_status === 'paid' ? nowIso : null,
      order_status: 'new',
      delivery_status: 'not_delivered',
    })
    .select()
    .single()

  if (error || !order) {
    console.error('Error creating order:', error)
    return { ok: false, error: 'Failed to create order', status: 500 }
  }

  const { error: itemsError } = await admin.from('order_items').insert(
    items.map(item => ({
      order_id: order.id,
      catalog_item_id: item.catalog_item_id,
      catalog_item_name: item.catalog_item_name,
      shirt_size: item.shirt_size,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
    }))
  )
  if (itemsError) console.error('Error inserting order_items:', itemsError) // non-fatal: order row exists

  // Settings for notifications (small select; keeps persistOrder self-contained)
  const { data: settings } = await admin
    .from('app_settings')
    .select('admin_phone, sms_notifications_enabled')
    .single()
  const notifSettings: NotificationSettings = settings ?? {}

  // Atomic inventory decrement per item
  for (const item of items) {
    const invRow = await findInventoryRow(admin, item)
    if (!invRow) continue // no inventory row tracked for this item — allow it through

    const { data: newQty, error: rpcError } = await admin.rpc('decrement_shirt_inventory', {
      p_inventory_id: invRow.id,
      p_quantity: item.quantity,
    })
    if (rpcError) { console.error('Inventory RPC error:', rpcError); continue }

    if (newQty === -1) {
      if (opts.failOnStockRace) {
        await admin.from('orders').delete().eq('id', order.id)
        return { ok: false, error: `Sorry, size "${item.shirt_size}" just sold out. Please choose a different size.`, status: 409 }
      }
      // Paid path: keep the order, flag it for the admin.
      console.error(`Stock race on paid order ${order.order_number}: size ${item.shirt_size} oversold by ${item.quantity}`)
      sendLowInventoryNotification(
        [{ size: item.shirt_size, catalogItemName: item.catalog_item_name ?? null, quantity: invRow.quantity - item.quantity, threshold: invRow.low_stock_threshold }],
        notifSettings
      ).catch(e => console.error('Low inventory notification error:', e))
      continue
    }

    if (newQty <= invRow.low_stock_threshold && invRow.quantity > invRow.low_stock_threshold) {
      sendLowInventoryNotification(
        [{ size: item.shirt_size, catalogItemName: item.catalog_item_name ?? null, quantity: newQty, threshold: invRow.low_stock_threshold }],
        notifSettings
      ).catch(e => console.error('Low inventory notification error:', e))
    }
  }

  // Audit trail for orders born paid — keeps the admin history identical to
  // what the old "create pending → capture" flow produced.
  if (opts.payment_status === 'paid') {
    await admin.from('audit_logs').insert([
      { order_id: order.id, field_changed: 'payment_status', old_value: 'pending', new_value: 'paid', changed_by: opts.changed_by ?? 'system' },
      { order_id: order.id, field_changed: 'payment_method', old_value: null, new_value: opts.payment_method, changed_by: opts.changed_by ?? 'system' },
    ])
  }

  sendOrderNotifications(order, notifSettings).catch(e => console.error('Notification error:', e))

  return { ok: true, order }
}

// ─── Checkout sessions ────────────────────────────────────────

export interface CheckoutSessionRow {
  id: string
  campaign_id: string | null
  email: string
  payload: PreparedOrder
  paypal_order_id: string | null
  status: 'open' | 'completed'
  order_id: string | null
  expires_at: string
  created_at: string
  updated_at: string
}

export async function getCheckoutSession(admin: SupabaseClient, id: string): Promise<CheckoutSessionRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await admin.from('checkout_sessions').select('*').eq('id', id).maybeSingle()
  return (data as CheckoutSessionRow | null) ?? null
}

export function isSessionExpired(session: CheckoutSessionRow): boolean {
  return new Date(session.expires_at).getTime() < Date.now()
}

/**
 * sessionToOrderView — shape a session the way /api/orders/[id] shapes an
 * order, so the checkout page renders both with the same component.
 */
export function sessionToOrderView(session: CheckoutSessionRow) {
  const p = session.payload
  return {
    id: null,
    order_number: null,
    session_id: session.id,
    full_name: p.full_name,
    email: p.email,
    phone: p.phone,
    institution_type: p.institution_type,
    school_name: p.school_name,
    grade: p.grade,
    classroom: p.classroom,
    organization_name: p.organization_name,
    department_office: p.department_office,
    region: p.region,
    company_name: p.company_name,
    company_department: p.company_department,
    delivery_address: p.delivery_address,
    shirt_size: p.items[0]?.shirt_size ?? null,
    quantity: p.items.reduce((s, i) => s + i.quantity, 0),
    unit_price: p.items[0]?.unit_price ?? 0,
    total_amount: p.total_amount,
    applied_fees: p.applied_fees.length > 0 ? p.applied_fees : null,
    discount_code: p.discount_code,
    discount_amount: p.discount_amount,
    order_allowed_payment_methods: p.order_allowed_payment_methods,
    payment_status: 'pending' as const,
    payment_method: null,
    order_status: 'new' as const,
    date_submitted: session.created_at,
    expires_at: session.expires_at,
    items: p.items.map((i, idx) => ({ id: `${session.id}-${idx}`, ...i })),
  }
}
