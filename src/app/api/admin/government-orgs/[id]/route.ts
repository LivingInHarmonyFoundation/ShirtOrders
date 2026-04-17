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
  const updates: Record<string, unknown> = {}
  if ('name' in body) updates.name = body.name
  if ('is_active' in body) updates.is_active = body.is_active
  if ('departments' in body) updates.departments = body.departments
  if ('allowed_payment_methods' in body) updates.allowed_payment_methods = body.allowed_payment_methods

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await admin.from('government_orgs').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 })

  const { data, error: fetchError } = await admin.from('government_orgs').select('*').eq('id', id).single()
  if (fetchError) return NextResponse.json({ error: 'Failed to fetch updated organization' }, { status: 500 })
  return NextResponse.json({ org: data })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  const admin = await createAdminClient()
  const { error } = await admin.from('government_orgs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete organization' }, { status: 500 })
  return NextResponse.json({ success: true })
}
