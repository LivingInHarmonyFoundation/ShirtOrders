import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = await createAdminClient()

  const [orderResult, auditResult] = await Promise.all([
    adminSupabase.from('orders').select('*').eq('id', id).single(),
    adminSupabase.from('audit_logs').select('*').eq('order_id', id).order('changed_at', { ascending: false }),
  ])

  if (orderResult.error || !orderResult.data) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({ order: orderResult.data, auditLogs: auditResult.data || [] })
}
