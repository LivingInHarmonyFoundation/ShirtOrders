import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await createAdminClient()

  // Get campaigns with order counts
  const { data, error } = await admin
    .from('campaigns')
    .select('*, orders(count)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })

  const campaigns = (data || []).map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    start_date: c.start_date,
    end_date: c.end_date,
    is_active: c.is_active,
    ended_message: c.ended_message,
    created_at: c.created_at,
    updated_at: c.updated_at,
    order_count: Array.isArray(c.orders) ? (c.orders[0] as { count: number })?.count ?? 0 : 0,
  }))

  return NextResponse.json({ campaigns })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await createAdminClient()
  const body = await request.json()

  const { name, description, start_date, end_date, ended_message } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })

  const { data, error } = await admin
    .from('campaigns')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      start_date: start_date || null,
      end_date: end_date || null,
      ended_message: ended_message?.trim() || 'This campaign has ended. Thank you for your participation.',
      is_active: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaign: { ...data, order_count: 0 } }, { status: 201 })
}
