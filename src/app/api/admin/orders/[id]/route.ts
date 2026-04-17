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

  const [orderResult, auditResult, itemsResult] = await Promise.all([
    adminSupabase.from('orders').select('*').eq('id', id).single(),
    adminSupabase.from('audit_logs').select('*').eq('order_id', id).order('changed_at', { ascending: false }),
    adminSupabase.from('order_items').select('*').eq('order_id', id).order('created_at', { ascending: true }),
  ])

  if (orderResult.error || !orderResult.data) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({
    order: { ...orderResult.data, items: itemsResult.data || [] },
    auditLogs: auditResult.data || [],
  })
}
