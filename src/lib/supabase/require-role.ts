import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPermissions } from '@/lib/permissions'
import type { UserRole } from '@/types'
import type { Permissions } from '@/lib/permissions'

// No team_members record = bootstrap owner (null = all permissions granted).
// Inactive record falls back to the most restrictive role rather than blocking outright.
export async function getCallerRole(userId: string): Promise<UserRole | null> {
  const admin = await createAdminClient()
  const { data } = await admin
    .from('team_members')
    .select('role, is_active')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return null
  if (!data.is_active) return 'staff' as UserRole
  return data.role as UserRole
}

// Returns { role } on success or a 403 NextResponse on failure.
// Callers must check `auth instanceof NextResponse` and return early.
export async function requirePermission(
  userId: string,
  permission: keyof Permissions
): Promise<{ role: UserRole | null } | NextResponse> {
  const role = await getCallerRole(userId)
  // null = no team_members record = bootstrap owner, grant everything
  if (role === null) return { role: null }
  const perms = getPermissions(role)
  if (!perms[permission]) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return { role }
}
