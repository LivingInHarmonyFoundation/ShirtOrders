/**
 * @file route.ts
 * @description Public order submission endpoint. No authentication required — any visitor
 * can submit an order. Validates against the active campaign, app settings, and size
 * availability before creating the order row and its line items.
 *
 * Key invariants:
 * - Requires an active, non-expired campaign; rejects otherwise.
 * - Duplicate-submission guard: blocks resubmission of the same email + first-item
 *   size + qty within a 10-minute window.
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
  institution_type: z.enum(['school', 'government', 'personal', 'private_company']),
  school_name: z.string().optional(),
  grade: z.string().optional(),
  classroom: z.string().optional(),
  organization_name: z.string().optional(),
  department_office: z.string().optional(),
  company_name: z.string().optional(),
  company_department: z.string().optional(),
  delivery_address: z.string().optional(),
  notes: z.string().optional(),
  school_link_id: z.string().uuid().optional(),
  company_link_id: z.string().uuid().optional(),
  // Multi-item cart submission
  items: z.array(cartItemSchema).min(1).max(50).optional(),
  // Legacy single-item fields (kept for backwards compat; ignored when items is present)
  shirt_size: z.string().min(1).max(20).optional(),
  quantity: z.number().int().positive().max(500).optional(),
  catalog_item_id: z.string().uuid().optional(),
  catalog_item_name: z.string().optional(),
})

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

    // Validate active campaign
    const { data: activeCampaign } = await supabase
      .from('campaigns')
      .select('id, end_date, ended_message')
      .eq('is_active', true)
      .single()

    if (!activeCampaign) {
      return NextResponse.json({ error: 'Orders are not currently open.' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]
    if (activeCampaign.end_date && activeCampaign.end_date < today) {
      return NextResponse.json(
        { error: activeCampaign.ended_message || 'This campaign has ended. Thank you for your participation.' },
        { status: 400 }
      )
    }

    const { data: settings } = await supabase
      .from('app_settings')
      .select('shirt_price, school_orders_enabled, government_orders_enabled, personal_orders_enabled, private_company_orders_enabled, available_sizes, admin_phone, sms_notifications_enabled, personal_allowed_payment_methods, cash_enabled, order_fees')
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

    // Validate all sizes
    for (const item of cartItems) {
      if (!settings.available_sizes.includes(item.shirt_size)) {
        return NextResponse.json(
          { error: `Shirt size "${item.shirt_size}" is not available` },
          { status: 400 }
        )
      }
    }

    // Duplicate-submission guard: rejects if the same email + first-item size + qty
    // was submitted within the last 10 minutes to prevent accidental double-orders.
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const firstItem = cartItems[0]
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('email', data.email)
      .eq('shirt_size', firstItem.shirt_size)
      .eq('quantity', firstItem.quantity)
      .gte('created_at', tenMinutesAgo)
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

    const unit_price = settings.shirt_price

    // Compute totals from cart items
    const total_quantity = cartItems.reduce((sum, item) => sum + item.quantity, 0)
    const subtotal = cartItems.reduce((sum, item) => sum + item.quantity * unit_price, 0)

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
        campaign_id: activeCampaign.id,
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
    const orderItemsPayload = cartItems.map(item => ({
      order_id: order.id,
      catalog_item_id: item.catalog_item_id || null,
      catalog_item_name: item.catalog_item_name,
      shirt_size: item.shirt_size,
      quantity: item.quantity,
      unit_price,
      subtotal: item.quantity * unit_price,
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsPayload)

    if (itemsError) {
      // Non-fatal: order row is already created; log but don't fail the request
      console.error('Error inserting order_items:', itemsError)
    }

    // Decrement inventory for each cart item (non-fatal)
    try {
      for (const item of cartItems) {
        // Try catalog-item-specific inventory first, then fall back to general (null catalog_item_id)
        const { data: invRow } = await supabase
          .from('shirt_inventory')
          .select('id, quantity, low_stock_threshold')
          .eq('shirt_size', item.shirt_size)
          .or(
            item.catalog_item_id
              ? `catalog_item_id.eq.${item.catalog_item_id},catalog_item_id.is.null`
              : 'catalog_item_id.is.null'
          )
          .order('catalog_item_id', { ascending: false, nullsFirst: false }) // prefer specific over general
          .limit(1)
          .maybeSingle()

        if (invRow) {
          const newQty = invRow.quantity - item.quantity
          await supabase
            .from('shirt_inventory')
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq('id', invRow.id)

          // Check if low stock threshold just crossed (not already below before this order)
          if (newQty <= invRow.low_stock_threshold && newQty > invRow.low_stock_threshold - item.quantity) {
            // Just crossed the threshold — send notification (fire and forget)
            sendLowInventoryNotification(
              [{ size: item.shirt_size, catalogItemName: item.catalog_item_name ?? null, quantity: newQty, threshold: invRow.low_stock_threshold }],
              settings
            ).catch(e => console.error('Low inventory notification error:', e))
          }
        }
      }
    } catch (e) {
      console.error('Inventory deduction error:', e)
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
