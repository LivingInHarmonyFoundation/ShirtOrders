/**
 * @file route.ts
 * @description Admin team member PATCH / DELETE by ID. Auth-gated: requires owner role
 * (or bootstrap owner). Uses `createAdminClient()` (bypasses RLS) for all DB writes and
 * Supabase Auth admin deleteUser calls.
 *
 * Key invariants:
 * - null from getCallerRole = bootstrap owner (no team_members record); all ops allowed.
 * - Inactive users are hard-blocked by getCallerRole (returns 403 NextResponse).
 * - A user cannot edit or delete their own record via these endpoints.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getCallerRole } from '@/lib/supabase/require-role'
import type { UserRole } from '@/types'

// ─── PATCH /api/admin/team/[id] ───────────────────────────────

/**
 * PATCH /api/admin/team/[id] — update a team member's role, active status, or full name.
 * Requires owner role. A user cannot edit their own record.
 * Allowed body fields: role, is_active, full_name.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ─── Auth & Permission Checks ────────────────────────────────
  const callerRole = await getCallerRole(user.id)
  if (callerRole instanceof NextResponse) return callerRole   // inactive user blocked
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

// ─── DELETE /api/admin/team/[id] ──────────────────────────────

/**
 * DELETE /api/admin/team/[id] — remove a team member record and delete their Supabase
 * Auth account. Requires owner role. A user cannot delete their own record.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ─── Auth & Permission Checks ────────────────────────────────
  const callerRole = await getCallerRole(user.id)
  if (callerRole instanceof NextResponse) return callerRole   // inactive user blocked
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
