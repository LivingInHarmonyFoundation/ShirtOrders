import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

async function getCallerRole(userId: string): Promise<UserRole | null> {
  const admin = await createAdminClient()
  const { data } = await admin
    .from('team_members')
    .select('role, is_active')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data || !data.is_active) return null
  return data.role as UserRole
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const callerRole = await getCallerRole(user.id)
  if (callerRole !== null && callerRole !== 'owner') {
    return NextResponse.json({ error: 'Only owners can update team members' }, { status: 403 })
  }

  const admin = await createAdminClient()

  // Fetch target member
  const { data: target } = await admin
    .from('team_members')
    .select('user_id, role')
    .eq('id', id)
    .single()

  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Cannot change own role/status via this endpoint
  if (target.user_id === user.id) {
    return NextResponse.json({ error: 'You cannot edit your own record' }, { status: 400 })
  }

  const body = await request.json()
  const allowed: Record<string, unknown> = {}

  if ('role' in body) {
    if (!['owner', 'admin', 'staff'].includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    allowed.role = body.role
  }
  if ('is_active' in body) allowed.is_active = body.is_active
  if ('full_name' in body) allowed.full_name = body.full_name

  const { data: updated, error } = await admin
    .from('team_members')
    .update(allowed)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ member: updated })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const callerRole = await getCallerRole(user.id)
  if (callerRole !== null && callerRole !== 'owner') {
    return NextResponse.json({ error: 'Only owners can remove team members' }, { status: 403 })
  }

  const admin = await createAdminClient()

  // Fetch target
  const { data: target } = await admin
    .from('team_members')
    .select('user_id, role')
    .eq('id', id)
    .single()

  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (target.user_id === user.id) {
    return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 })
  }

  // Delete team_members record
  const { error } = await admin.from('team_members').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })

  // Optionally delete from Supabase Auth if they have a user_id
  if (target.user_id) {
    await admin.auth.admin.deleteUser(target.user_id)
  }

  return NextResponse.json({ success: true })
}
