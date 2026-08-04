/**
 * @file route.ts
 * @description Public order submission endpoint. No authentication required — any visitor
 * can submit an order. Validates against the active campaign, app settings, and size
 * availability before creating the order row and its line items.
 *
 * Key invariants:
 * - Requires an active, non-expired campaign; rejects otherwise.
 * - Duplicate-submission guard: blocks resubmission of the same email + first-item
 *   size + qty within a 2-minute window.
 * - Supports multi-item cart (`items` array) and legacy single-item fields for
 *   backwards compatibility; `items` takes precedence when present.
 * - `order_items` rows are bulk-inserted after the order row; insert failure is
 *   non-fatal (logged, order still created).
 * - Uses `createAdminClient()` (bypasses RLS) because this is an unauthenticated
 *   write path — no user session is available.
 * - `admin_phone` in app_settings is an ntfy.sh topic name, not a phone number.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { generateOrderNumber } from '@/lib/utils'
import { sendOrderNotifications, sendLowInventoryNotification } from '@/lib/notifications'
import { getCheapestShippingRate, SHIRT_WEIGHT_OZ } from '@/lib/shippo'
import { z } from 'zod'

// ─── Validation Schemas ───────────────────────────────────────

const cartItemSchema = z.object({
  catalog_item_id: z.string().uuid().nullable().optional(),
  catalog_item_name: z.string().min(1),
  shirt_size: z.string().min(1).max(20),
  quantity: z.number().int().positive().max(500),
})

const orderSchema = z.object({
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

// ─── Helpers ─────────────────────────────────────────────────

/**
 * isInAnnualWindow — returns true if `now` falls within the annual recurrence window
 * defined by the month+day of startDate and endDate. Year is ignored; only the
 * month-day portion matters. Handles windows that span a year boundary (e.g. Nov–Jan).
 */
function isInAnnualWindow(now: Date, startDate: string, endDate: string): boolean {
  const s = new Date(startDate)
  const e = new Date(endDate)
  // Encode as (month * 100 + day) for easy integer comparison
  const nowMD = now.getMonth() * 100 + now.getDate()
  const startMD = s.getMonth() * 100 + s.getDate()
  const endMD = e.getMonth() * 100 + e.getDate()
  if (startMD <= endMD) {
    // Window stays within the same calendar year (e.g. Feb–Jun)
    return nowMD >= startMD && nowMD <= endMD
  }
  // Window crosses a year boundary (e.g. Nov–Jan)
  return nowMD >= startMD || nowMD <= endMD
}

// ─── POST /api/orders ─────────────────────────────────────────

/**
 * POST /api/orders — public order submission. No auth required.
 * Validates campaign, settings, sizes, and duplicate guard before inserting.
 * Returns { order } with status 201 on success.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = orderSchema.parse(body)

    const supabase = await createAdminClient()

    // Build the list of effectively active campaigns.
    // Multiple campaigns can be active simultaneously. For recurring campaigns,
    // is_active=true is "recurring enabled" — we still check the annual window.
    const { data: enabledCampaigns } = await supabase
      .from('campaigns')
      .select('id, end_date, ended_message, start_date, is_recurring')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    const effectiveCampaigns = (enabledCampaigns || []).filter(c => {
      if (c.is_recurring && c.start_date && c.end_date) {
        return isInAnnualWindow(now, c.start_date, c.end_date)
      }
      if (c.end_date && c.end_date < todayStr) return false
      return true
    })

    if (effectiveCampaigns.length === 0) {
      return NextResponse.json({ error: 'Orders are not currently open.' }, { status: 400 })
    }

    // If the client sent a campaign_id (user picked from the multi-campaign picker),
    // validate it is in the effective list. Otherwise fall back to the first effective
    // campaign (preserves behavior for school/company slug pages that never send one).
    let selectedCampaign = effectiveCampaigns[0]
    if (data.campaign_id) {
      const matched = effectiveCampaigns.find(c => c.id === data.campaign_id)
      if (!matched) {
        return NextResponse.json({ error: 'Selected campaign is no longer active.' }, { status: 400 })
      }
      selectedCampaign = matched
    }

    const { data: settings } = await supabase
      .from('app_settings')
      .select('shirt_price, school_orders_enabled, government_orders_enabled, personal_orders_enabled, private_company_orders_enabled, staff_orders_enabled, municipality_orders_enabled, available_sizes, admin_phone, sms_notifications_enabled, personal_allowed_payment_methods, cash_enabled, order_fees, personal_shipping_pr, personal_shipping_other')
      .single()

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 500 })
    }

    if (data.institution_type === 'school' && !settings.school_orders_enabled) {
      return NextResponse.json({ error: 'School orders are currently disabled' }, { status: 400 })
    }
    if (data.institution_type === 'government' && !settings.government_orders_enabled) {
      return NextResponse.json({ error: 'Government orders are currently disabled' }, { status: 400 })
    }
    if (data.institution_type === 'personal' && settings.personal_orders_enabled === false) {
      return NextResponse.json({ error: 'Personal orders are currently disabled' }, { status: 400 })
    }
    if (data.institution_type === 'private_company' && settings.private_company_orders_enabled === false) {
      return NextResponse.json({ error: 'Private company orders are currently disabled' }, { status: 400 })
    }
    if (data.institution_type === 'municipality' && settings.municipality_orders_enabled === false) {
      return NextResponse.json({ error: 'Municipality orders are currently disabled' }, { status: 403 })
    }
    if (data.institution_type === 'staff' && settings.staff_orders_enabled !== true) {
      return NextResponse.json({ error: 'Staff orders are currently disabled' }, { status: 400 })
    }

    // Normalise items: if `items` array provided use it; otherwise fall back to legacy single-item fields
    const cartItems = data.items && data.items.length > 0
      ? data.items
      : (data.shirt_size && data.quantity)
        ? [{
            catalog_item_id: data.catalog_item_id ?? null,
            catalog_item_name: data.catalog_item_name ?? 'Shirt',
            shirt_size: data.shirt_size,
            quantity: data.quantity,
          }]
        : null

    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    // Fetch catalog items for per-item price and size validation
    const catalogItemIds = [...new Set(cartItems.map(i => i.catalog_item_id).filter(Boolean))]
    const catalogMap: Record<string, { price: number | null; available_sizes: string[] | null; size_prices: Record<string, number> | null }> = {}
    if (catalogItemIds.length > 0) {
      const { data: catalogRows } = await supabase
        .from('shirt_catalog')
        .select('id, price, available_sizes, size_prices')
        .in('id', catalogItemIds)
      for (const row of catalogRows ?? []) catalogMap[row.id] = row
    }

    // Validate sizes — use per-item sizes when set, fall back to global
    for (const item of cartItems) {
      const catalogItem = item.catalog_item_id ? catalogMap[item.catalog_item_id] : null
      const allowedSizes = catalogItem?.available_sizes ?? settings.available_sizes
      if (!allowedSizes.includes(item.shirt_size)) {
        return NextResponse.json(
          { error: `Shirt size "${item.shirt_size}" is not available` },
          { status: 400 }
        )
      }
    }

    // Inventory pre-check — verify stock exists for every cart item before we
    // touch the orders table. This is an optimistic guard; the real atomic
    // decrement (with race protection) happens after the order is created.
    for (const item of cartItems) {
      const { data: invCheck } = await supabase
        .from('shirt_inventory')
        .select('quantity')
        .eq('shirt_size', item.shirt_size)
        .or(
          item.catalog_item_id
            ? `catalog_item_id.eq.${item.catalog_item_id},catalog_item_id.is.null`
            : 'catalog_item_id.is.null'
        )
        .order('catalog_item_id', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()

      if (invCheck && invCheck.quantity < item.quantity) {
        return NextResponse.json(
          { error: `Sorry, only ${invCheck.quantity} unit(s) of size "${item.shirt_size}" are left in stock.` },
          { status: 400 }
        )
      }
    }

    // Duplicate-submission guard: rejects if the same email + first-item size + qty
    // was submitted within the last 2 minutes. Short window so it catches accidental
    // double-clicks / page-refresh resubmits without blocking a legitimate repeat order.
    const dupWindowStart = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const firstItem = cartItems[0]
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('email', data.email)
      .eq('shirt_size', firstItem.shirt_size)
      .eq('quantity', firstItem.quantity)
      .gte('created_at', dupWindowStart)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'A similar order was recently submitted. Please wait a few minutes before trying again.' },
        { status: 409 }
      )
    }

    // Resolve allowed payment methods for this order from the entity
    let orderAllowedPaymentMethods: string[] | null = null

    if (data.institution_type === 'school' && data.school_link_id) {
      const { data: school } = await supabase
        .from('school_links')
        .select('allowed_payment_methods')
        .eq('id', data.school_link_id)
        .single()
      orderAllowedPaymentMethods = school?.allowed_payment_methods ?? null
    } else if (data.institution_type === 'private_company' && data.company_link_id) {
      const { data: company } = await supabase
        .from('private_companies')
        .select('allowed_payment_methods')
        .eq('id', data.company_link_id)
        .single()
      orderAllowedPaymentMethods = company?.allowed_payment_methods ?? null
    } else if (data.institution_type === 'government' && data.organization_name) {
      const { data: org } = await supabase
        .from('government_orgs')
        .select('allowed_payment_methods')
        .ilike('name', data.organization_name)
        .eq('is_active', true)
        .single()
      orderAllowedPaymentMethods = org?.allowed_payment_methods ?? null
    } else if (data.institution_type === 'personal') {
      orderAllowedPaymentMethods = settings.personal_allowed_payment_methods ?? null
    }

    // If cash is globally disabled, strip it from allowed methods
    if (!settings.cash_enabled && orderAllowedPaymentMethods) {
      orderAllowedPaymentMethods = orderAllowedPaymentMethods.filter(m => m !== 'cash')
    }

    // Resolve per-item price by size. A catalog item may set per-size overrides
    // (size_prices), e.g. { "XXL": 15 }; sizes without an override use the item's
    // base price, then the global shirt_price. Priced server-side so a tampered
    // client cart cannot dictate the amount charged.
    const resolvePrice = (catalogItemId: string | null | undefined, size: string | null | undefined) => {
      const catalogItem = catalogItemId ? catalogMap[catalogItemId] : null
      const sizeOverride = size ? catalogItem?.size_prices?.[size] : undefined
      return sizeOverride ?? catalogItem?.price ?? settings.shirt_price
    }

    const unit_price = resolvePrice(cartItems[0]?.catalog_item_id, cartItems[0]?.shirt_size)

    // Compute totals from cart items using per-item prices
    const total_quantity = cartItems.reduce((sum, item) => sum + item.quantity, 0)
    const subtotal = cartItems.reduce((sum, item) => sum + item.quantity * resolvePrice(item.catalog_item_id, item.shirt_size), 0)

    // Apply each configured fee against the subtotal (not cumulative).
    // A fee with applies_to null or [] applies to every institution type;
    // otherwise it only applies when institution_type is in the list.
    const fees = (settings.order_fees || []) as import('@/types').OrderFee[]
    const applicableFees = fees.filter(fee =>
      !fee.applies_to || fee.applies_to.length === 0 || fee.applies_to.includes(data.institution_type)
    )
    const appliedFees = applicableFees.map(fee => ({
      name: fee.name,
      type: fee.type,
      value: fee.value,
      amount: fee.type === 'percentage'
        ? Math.round(subtotal * (fee.value / 100) * 100) / 100
        : fee.value,
    }))

    // Personal-order shipping — a live rate quote from the carrier (Shippo), priced by the
    // customer's delivery address. Quote only; no label is purchased. If the rate service is
    // unavailable, fall back to a flat rate chosen by ZIP (PR 00600–00999 vs off-island).
    if (data.institution_type === 'personal') {
      const totalWeightOz = SHIRT_WEIGHT_OZ * total_quantity
      let shipCost: number | null = null

      if (data.delivery_zip) {
        shipCost = await getCheapestShippingRate(
          { city: data.delivery_city, state: data.delivery_state, zip: data.delivery_zip },
          totalWeightOz,
        )
      }

      // Fallback flat rate when the live quote is unavailable.
      if (shipCost === null) {
        const zipNum = parseInt((data.delivery_zip || '').replace(/\D/g, '').slice(0, 5) || '0', 10)
        const isPR = zipNum >= 600 && zipNum <= 999
        shipCost = Number(isPR ? settings.personal_shipping_pr : settings.personal_shipping_other) || 0
      }

      if (shipCost > 0) {
        appliedFees.push({ name: 'Shipping', type: 'fixed', value: shipCost, amount: shipCost })
      }
    }

    const feesTotal = appliedFees.reduce((sum, f) => sum + f.amount, 0)
    const total_amount = Math.round((subtotal + feesTotal) * 100) / 100

    const order_number = generateOrderNumber()

    // For the orders row, store the first item's fields for backwards compat
    const primaryItem = cartItems[0]

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        order_number,
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
        shirt_size: primaryItem.shirt_size,
        quantity: total_quantity,
        unit_price,
        total_amount,
        notes: data.notes || null,
        applied_fees: appliedFees.length > 0 ? appliedFees : null,
        school_link_id: data.school_link_id || null,
        company_link_id: data.company_link_id || null,
        order_allowed_payment_methods: orderAllowedPaymentMethods,
        catalog_item_id: primaryItem.catalog_item_id || null,
        catalog_item_name: primaryItem.catalog_item_name || null,
        campaign_id: selectedCampaign.id,
        payment_status: 'pending',
        order_status: 'new',
        delivery_status: 'not_delivered',
      })
      .select()
      .single()

    if (error || !order) {
      console.error('Error creating order:', error)
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    // Bulk-insert into order_items
    const orderItemsPayload = cartItems.map(item => {
      const itemPrice = resolvePrice(item.catalog_item_id, item.shirt_size)
      return {
        order_id: order.id,
        catalog_item_id: item.catalog_item_id || null,
        catalog_item_name: item.catalog_item_name,
        shirt_size: item.shirt_size,
        quantity: item.quantity,
        unit_price: itemPrice,
        subtotal: item.quantity * itemPrice,
      }
    })

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsPayload)

    if (itemsError) {
      // Non-fatal: order row is already created; log but don't fail the request
      console.error('Error inserting order_items:', itemsError)
    }

    // Atomically decrement inventory for each cart item via RPC.
    // If the decrement fails due to a race (another order grabbed the last stock),
    // we mark the order as out-of-stock and return an error so the customer can retry.
    for (const item of cartItems) {
      // Find the best matching inventory row (catalog-specific first, then general)
      const { data: invRow } = await supabase
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

      if (!invRow) continue // no inventory row tracked for this item — allow it through

      const { data: newQty, error: rpcError } = await supabase
        .rpc('decrement_shirt_inventory', {
          p_inventory_id: invRow.id,
          p_quantity: item.quantity,
        })

      if (rpcError) {
        console.error('Inventory RPC error:', rpcError)
        // Non-fatal: stock tracking failure shouldn't block the order
        continue
      }

      if (newQty === -1) {
        // Race condition — stock was taken between our pre-check and here.
        // Delete the newly-created order row to keep data clean, then surface the error.
        await supabase.from('orders').delete().eq('id', order.id)
        return NextResponse.json(
          { error: `Sorry, size "${item.shirt_size}" just sold out. Please choose a different size.` },
          { status: 409 }
        )
      }

      // Check if this decrement just crossed the low-stock threshold
      const prevQty = invRow.quantity
      if (newQty <= invRow.low_stock_threshold && prevQty > invRow.low_stock_threshold) {
        sendLowInventoryNotification(
          [{ size: item.shirt_size, catalogItemName: item.catalog_item_name ?? null, quantity: newQty, threshold: invRow.low_stock_threshold }],
          settings
        ).catch(e => console.error('Low inventory notification error:', e))
      }
    }

    sendOrderNotifications(order, settings).catch(e => console.error('Notification error:', e))

    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.issues }, { status: 400 })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
