/**
 * @file route.ts
 * @description Single school link endpoint (by UUID). PATCH updates allowed fields
 * (is_active, school_name, grades, allowed_payment_methods); DELETE removes the school
 * link. Both handlers require authentication and the `canManageSchools` permission.
 * Uses `createAdminClient()` (bypasses RLS) for all DB reads and writes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── PATCH /api/admin/schools/[id] ───────────────────────────

/**
 * PATCH /api/admin/schools/[id] — update allowed fields on a school link.
 * Requires authentication and the `canManageSchools` permission.
 * Allowed body keys: is_active, school_name, grades, allowed_payment_methods.
 * The updated row is returned inline via .select().single() after the update.
 * Response: { school: SchoolLink }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ─── Auth & Permission Checks ────────────────────────────────
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSchools')
  if (auth instanceof NextResponse) return auth

  // ─── Input Validation & Field Allowlist ──────────────────────
  // createAdminClient() bypasses RLS — required to write school_links rows
  const admin = await createAdminClient()
  const body = await request.json()

  const allowed: Record<string, unknown> = {}
  if ('is_active' in body) allowed.is_active = body.is_active
  if ('school_name' in body) allowed.school_name = body.school_name
  if ('grades' in body) allowed.grades = body.grades
  if ('allowed_payment_methods' in body) allowed.allowed_payment_methods = body.allowed_payment_methods

  // ─── Update ──────────────────────────────────────────────────
  const { data, error } = await admin
    .from('school_links')
    .update(allowed)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ school: data })
}

// ─── DELETE /api/admin/schools/[id] ──────────────────────────

/**
 * DELETE /api/admin/schools/[id] — permanently remove a school link.
 * Requires authentication and the `canManageSchools` permission.
 * Response: { success: true }
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ─── Auth & Permission Checks ────────────────────────────────
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSchools')
  if (auth instanceof NextResponse) return auth

  // ─── Delete ──────────────────────────────────────────────────
  // createAdminClient() bypasses RLS — required to delete school_links rows
  const admin = await createAdminClient()
  const { error } = await admin.from('school_links').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}
