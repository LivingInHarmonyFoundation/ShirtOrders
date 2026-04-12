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

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getCallerRole(user.id)
  // Bootstrap: no record = owner
  if (role !== null && role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = await createAdminClient()
  const { data: members, error } = await admin
    .from('team_members')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 })
  return NextResponse.json({ members: members || [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getCallerRole(user.id)
  if (role !== null && role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can invite team members' }, { status: 403 })
  }

  const { email, role: newRole, full_name, password } = await request.json()

  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }
  if (!['owner', 'admin', 'staff'].includes(newRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  if (email.toLowerCase() === user.email?.toLowerCase()) {
    return NextResponse.json({ error: 'You cannot add yourself' }, { status: 400 })
  }

  const admin = await createAdminClient()

  // Check if already in team
  const { data: existing } = await admin
    .from('team_members')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'This person is already on the team' }, { status: 409 })
  }

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  })
  if (createError) {
    return NextResponse.json({ error: `Failed to create account: ${createError.message}` }, { status: 500 })
  }

  const userId = created.user.id

  const { data: member, error: insertError } = await admin
    .from('team_members')
    .insert({
      user_id: userId,
      email: email.toLowerCase().trim(),
      full_name: full_name?.trim() || null,
      role: newRole,
      is_active: true,
      invited_by: user.id,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: 'Failed to create team member record' }, { status: 500 })
  }

  return NextResponse.json({ member }, { status: 201 })
}
