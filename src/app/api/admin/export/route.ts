import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { CSV_HEADERS, buildOrderCsvRow } from '@/lib/utils'

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = await createAdminClient()
  const { searchParams } = request.nextUrl

  const institution_type = searchParams.get('institution_type') || ''
  const payment_status = searchParams.get('payment_status') || ''
  const delivery_status = searchParams.get('delivery_status') || ''
  const shirt_size = searchParams.get('shirt_size') || ''
  const date_from = searchParams.get('date_from') || ''
  const date_to = searchParams.get('date_to') || ''
  const organization_name = searchParams.get('organization_name') || ''
  const school_name = searchParams.get('school_name') || ''
  const company_name = searchParams.get('company_name') || ''
  const campaign_id = searchParams.get('campaign_id') || ''

  let query = adminSupabase.from('orders').select('*').order('created_at', { ascending: false })

  if (institution_type) query = query.eq('institution_type', institution_type)
  if (payment_status) query = query.eq('payment_status', payment_status)
  if (delivery_status) query = query.eq('delivery_status', delivery_status)
  if (shirt_size) query = query.eq('shirt_size', shirt_size)
  if (date_from) query = query.gte('created_at', date_from)
  if (date_to) query = query.lte('created_at', date_to + 'T23:59:59')
  if (organization_name) query = query.eq('organization_name', organization_name)
  if (school_name) query = query.eq('school_name', school_name)
  if (company_name) query = query.eq('company_name', company_name)
  if (campaign_id && campaign_id !== 'all') query = query.eq('campaign_id', campaign_id)

  const { data: orders, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }

  const rows = [
    CSV_HEADERS.map(escapeCsvValue).join(','),
    ...(orders || []).map(order => buildOrderCsvRow(order).map(escapeCsvValue).join(',')),
  ]

  const csv = rows.join('\n')
  const filename = `shirt-orders-${new Date().toISOString().split('T')[0]}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
