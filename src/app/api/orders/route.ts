import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { generateOrderNumber } from '@/lib/utils'
import { sendOrderNotifications } from '@/lib/notifications'
import { z } from 'zod'

const orderSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  institution_type: z.enum(['school', 'government']),
  school_name: z.string().optional(),
  grade: z.string().optional(),
  classroom: z.string().optional(),
  organization_name: z.string().optional(),
  department_office: z.string().optional(),
  shirt_size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
  school_link_id: z.string().uuid().optional(),
  catalog_item_id: z.string().uuid().optional(),
  catalog_item_name: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = orderSchema.parse(body)

    const supabase = await createAdminClient()

    // Get current shirt price from settings
    const { data: settings } = await supabase
      .from('app_settings')
      .select('shirt_price, school_orders_enabled, government_orders_enabled, available_sizes, admin_email, email_notifications_enabled, admin_phone, sms_notifications_enabled')
      .single()

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 500 })
    }

    // Validate institution type is enabled
    if (data.institution_type === 'school' && !settings.school_orders_enabled) {
      return NextResponse.json({ error: 'School orders are currently disabled' }, { status: 400 })
    }
    if (data.institution_type === 'government' && !settings.government_orders_enabled) {
      return NextResponse.json({ error: 'Government orders are currently disabled' }, { status: 400 })
    }

    // Validate shirt size is available
    if (!settings.available_sizes.includes(data.shirt_size)) {
      return NextResponse.json({ error: 'Selected shirt size is not available' }, { status: 400 })
    }

    // Check for duplicate submission (same email + size + quantity within last 10 min)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('email', data.email)
      .eq('shirt_size', data.shirt_size)
      .eq('quantity', data.quantity)
      .gte('created_at', tenMinutesAgo)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'A similar order was recently submitted. Please wait a few minutes before trying again.' },
        { status: 409 }
      )
    }

    const unit_price = settings.shirt_price
    const total_amount = unit_price * data.quantity
    const order_number = generateOrderNumber()

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
        shirt_size: data.shirt_size,
        quantity: data.quantity,
        unit_price,
        total_amount,
        notes: data.notes || null,
        school_link_id: data.school_link_id || null,
        catalog_item_id: data.catalog_item_id || null,
        catalog_item_name: data.catalog_item_name || null,
        payment_status: 'pending',
        order_status: 'new',
        delivery_status: 'not_delivered',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating order:', error)
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    // Send notifications (non-blocking — don't await before responding)
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
