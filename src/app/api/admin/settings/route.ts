import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

const PUBLIC_FIELDS = [
  'id', 'app_name', 'logo_url', 'mission_banner_url', 'badge_url', 'shirt_price', 'available_sizes',
  'school_orders_enabled', 'government_orders_enabled',
  'personal_orders_enabled', 'private_company_orders_enabled',
  'manual_payment_enabled', 'cash_enabled', 'personal_allowed_payment_methods', 'confirmation_message',
]

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = await createAdminClient()
  const { data: settings, error } = await admin
    .from('app_settings')
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }

  // Unauthenticated callers (order form) only receive public-safe fields
  if (!user) {
    const publicSettings: Record<string, unknown> = {}
    for (const key of PUBLIC_FIELDS) {
      publicSettings[key] = (settings as Record<string, unknown>)[key]
    }
    return NextResponse.json({ settings: publicSettings })
  }

  return NextResponse.json({ settings })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  const adminSupabase = await createAdminClient()
  const body = await request.json()

  const allowedFields = [
    'app_name', 'logo_url', 'mission_banner_url', 'badge_url', 'shirt_price', 'available_sizes',
    'school_orders_enabled', 'government_orders_enabled',
    'personal_orders_enabled', 'private_company_orders_enabled',
    'manual_payment_enabled', 'cash_enabled', 'personal_allowed_payment_methods', 'confirmation_message',
    'admin_phone', 'sms_notifications_enabled',
  ]

  const updateData: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in body) {
      updateData[field] = body[field]
    }
  }

  const { data: settings, error } = await adminSupabase
    .from('app_settings')
    .update(updateData)
    .not('id', 'is', null)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }

  return NextResponse.json({ settings })
}
