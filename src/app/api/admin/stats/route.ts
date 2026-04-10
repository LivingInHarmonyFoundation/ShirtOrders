import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = await createAdminClient()

  const { data: orders } = await adminSupabase
    .from('orders')
    .select('quantity, total_amount, payment_status, delivery_status, institution_type, shirt_size, created_at')

  if (!orders) return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })

  const total_orders = orders.length
  const total_shirts = orders.reduce((sum, o) => sum + o.quantity, 0)
  const total_revenue = orders
    .filter(o => o.payment_status === 'paid' || o.payment_status === 'manual')
    .reduce((sum, o) => sum + Number(o.total_amount), 0)

  const paid_orders = orders.filter(o => o.payment_status === 'paid' || o.payment_status === 'manual').length
  const unpaid_orders = orders.filter(o => o.payment_status === 'pending' || o.payment_status === 'failed').length
  const delivered_orders = orders.filter(o => o.delivery_status === 'delivered').length
  const pending_deliveries = orders.filter(o => o.delivery_status === 'not_delivered' || o.delivery_status === 'partially_delivered').length

  // Orders by institution type
  const institutionMap = new Map<string, number>()
  orders.forEach(o => {
    institutionMap.set(o.institution_type, (institutionMap.get(o.institution_type) || 0) + 1)
  })
  const orders_by_institution = Array.from(institutionMap.entries()).map(([institution_type, count]) => ({ institution_type, count }))

  // Orders by shirt size
  const sizeMap = new Map<string, number>()
  orders.forEach(o => {
    sizeMap.set(o.shirt_size, (sizeMap.get(o.shirt_size) || 0) + o.quantity)
  })
  const orders_by_size = Array.from(sizeMap.entries()).map(([shirt_size, count]) => ({ shirt_size, count }))

  // Revenue by date (last 30 days)
  const dateMap = new Map<string, number>()
  orders
    .filter(o => o.payment_status === 'paid' || o.payment_status === 'manual')
    .forEach(o => {
      const date = o.created_at.split('T')[0]
      dateMap.set(date, (dateMap.get(date) || 0) + Number(o.total_amount))
    })
  const revenue_by_date = Array.from(dateMap.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)

  return NextResponse.json({
    total_orders,
    total_shirts,
    total_revenue,
    paid_orders,
    unpaid_orders,
    delivered_orders,
    pending_deliveries,
    orders_by_institution,
    orders_by_size,
    revenue_by_date,
  })
}
