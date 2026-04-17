import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

const BULK_ORDER_ALLOWED_FIELDS = [
  'payment_status', 'order_status', 'delivery_status',
  'admin_notes', 'date_paid', 'date_delivered',
]

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  let query = adminSupabase.from('orders').select('*', { count: 'exact' })

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

  query = query.range(offset, offset + limit - 1)

  const { data: orders, error, count } = await query

  if (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }

  return NextResponse.json({
    orders: orders || [],
    total: count || 0,
    page,
    limit,
    total_pages: Math.ceil((count || 0) / limit),
  })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
