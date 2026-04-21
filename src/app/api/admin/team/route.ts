/**
 * @file route.ts
 * @description Admin team management — list members and invite new ones. Auth-gated:
 * requires an authenticated session AND owner role (or bootstrap owner path where
 * no team_members record exists). Uses `createAdminClient()` (bypasses RLS) for all
 * team_members reads and Supabase Auth admin calls.
 *
 * Key invariants:
 * - null from getCallerRole = bootstrap owner (no team_members record); all ops allowed.
 * - Inactive users are hard-blocked by getCallerRole (returns 403 NextResponse).
 * - New users are created with `must_change_password: true` in user_metadata — the
 *   set-password route clears this flag on first login.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getCallerRole } from '@/lib/supabase/require-role'
import type { UserRole } from '@/types'

// ─── GET /api/admin/team ──────────────────────────────────────

/**
 * GET /api/admin/team — list all team members ordered by creation date.
 * Requires owner role (or bootstrap owner). Returns { members: TeamMember[] }.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ─── Auth & Permission Checks ────────────────────────────────
  const callerRole = await getCallerRole(user.id)
  if (callerRole instanceof NextResponse) return callerRole   // inactive user blocked
  if (callerRole !== null && callerRole !== 'owner') {
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

// ─── POST /api/admin/team ─────────────────────────────────────

/**
 * POST /api/admin/team — invite a new team member by creating a Supabase Auth user
 * and a corresponding team_members row. Requires owner role.
 * Body: { email, role, full_name?, password }
 * Password must be at least 8 characters; user is flagged must_change_password on creation.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ─── Auth & Permission Checks ────────────────────────────────
  const callerRole = await getCallerRole(user.id)
  if (callerRole instanceof NextResponse) return callerRole   // inactive user blocked
  if (callerRole !== null && callerRole !== 'owner') {
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
