import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  const admin = await createAdminClient()
  const body = await request.json()

  const allowed = ['name', 'description', 'start_date', 'end_date', 'ended_message', 'is_active']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  // If activating, deactivate all other campaigns first
  if (updates.is_active === true) {
    await admin.from('campaigns').update({ is_active: false }).neq('id', id)
  }

  const { error } = await admin.from('campaigns').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })

  const { data, error: fetchErr } = await admin
    .from('campaigns')
    .select('*, orders(count)')
    .eq('id', id)
    .single()
  if (fetchErr) return NextResponse.json({ error: 'Failed to fetch updated campaign' }, { status: 500 })

  const campaign = {
    ...data,
    order_count: Array.isArray(data.orders) ? (data.orders[0] as { count: number })?.count ?? 0 : 0,
  }
  delete campaign.orders

  return NextResponse.json({ campaign })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  const admin = await createAdminClient()

  const { data: campaign } = await admin.from('campaigns').select('is_active').eq('id', id).single()
  if (campaign?.is_active) {
    return NextResponse.json({ error: 'Cannot delete an active campaign. Deactivate it first.' }, { status: 400 })
  }

  const { error } = await admin.from('campaigns').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
  return NextResponse.json({ success: true })
}
