import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createAdminClient()
  const { data: settings, error } = await supabase
    .from('app_settings')
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }

  return NextResponse.json({ settings })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = await createAdminClient()
  const body = await request.json()

  const allowedFields = [
    'app_name', 'logo_url', 'shirt_price', 'available_sizes',
    'school_orders_enabled', 'government_orders_enabled',
    'personal_orders_enabled', 'private_company_orders_enabled',
    'manual_payment_enabled', 'confirmation_message',
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
