/**
 * @file require-role.ts
 * @description Central auth helpers for API routes. Exposes `getCallerRole` (looks up the
 * caller's role from team_members) and `requirePermission` (gates a route on a named
 * permission). Both return a 403 NextResponse on failure — callers must check
 * `instanceof NextResponse` and return early.
 *
 * Key invariants:
 * - null role = no team_members record = bootstrap owner; all permissions granted, NOT blocked.
 * - Inactive users (is_active = false) are hard-blocked with 403 — they do NOT fall back to
 *   a restricted role.
 * - `createAdminClient()` bypasses Supabase RLS; used intentionally here for internal lookups.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPermissions } from '@/lib/permissions'
import type { UserRole } from '@/types'
import type { Permissions } from '@/lib/permissions'

// ─── Role Lookup ─────────────────────────────────────────────

/**
 * Returns the caller's role from team_members, null if they have no record
 * (bootstrap owner path), or a 403 NextResponse if the account is inactive.
 *
 * Callers that perform their own owner check (e.g. team routes) must handle all
 * three return types: null | UserRole | NextResponse.
 */
export async function getCallerRole(userId: string): Promise<UserRole | null | NextResponse> {
  const admin = await createAdminClient()
  const { data } = await admin
    .from('team_members')
    .select('role, is_active')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return null
  if (!data.is_active) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return data.role as UserRole
}

// ─── Permission Gate ──────────────────────────────────────────

/**
 * Returns `{ role }` when the caller holds the required permission, or a 403
 * NextResponse when they do not (or are inactive). Pass the result through an
 * `instanceof NextResponse` guard before using `role`.
 */
export async function requirePermission(
  userId: string,
  permission: keyof Permissions
): Promise<{ role: UserRole | null } | NextResponse> {
  const role = await getCallerRole(userId)
  if (role instanceof NextResponse) return role
  // null = no team_members record = bootstrap owner, grant everything
  if (role === null) return { role: null }
  const perms = getPermissions(role)
  if (!perms[permission]) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return { role }
}
