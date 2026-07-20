/**
 * @file route.ts
 * @description Single government organization endpoint (by UUID). PATCH updates allowed
 * fields (name, is_active, departments, allowed_payment_methods); DELETE removes the org.
 * Both handlers require authentication and the `canManageSettings` permission.
 * Uses `createAdminClient()` (bypasses RLS) for all DB reads and writes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── PATCH /api/admin/government-orgs/[id] ───────────────────

/**
 * PATCH /api/admin/government-orgs/[id] — update allowed fields on a government org.
 * Requires authentication and the `canManageSettings` permission.
 * Allowed body keys: name, is_active, departments, allowed_payment_methods.
 * Returns 400 if the body contains none of those keys.
 * The updated row is fetched after the update and returned in the response.
 * Response: { org: GovernmentOrg }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ─── Auth & Permission Checks ────────────────────────────────
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  // ─── Input Validation & Field Allowlist ──────────────────────
  // createAdminClient() bypasses RLS — required to write government_orgs rows
  const admin = await createAdminClient()
  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if ('name' in body) updates.name = body.name
  if ('is_active' in body) updates.is_active = body.is_active
  if ('departments' in body) updates.departments = body.departments
  if ('allowed_payment_methods' in body) updates.allowed_payment_methods = body.allowed_payment_methods

  // department_regions: object map of { "<department>": ["<region>", ...] }.
  // Validate shape to avoid storing malformed data that the order form would choke on.
  if ('department_regions' in body) {
    const dr = body.department_regions
    const valid =
      dr !== null &&
      typeof dr === 'object' &&
      !Array.isArray(dr) &&
      Object.values(dr as Record<string, unknown>).every(
        v => Array.isArray(v) && v.every(r => typeof r === 'string')
      )
    if (!valid) {
      return NextResponse.json({ error: 'Invalid department_regions' }, { status: 400 })
    }
    updates.department_regions = dr
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // ─── Update & Fetch ──────────────────────────────────────────
  const { error } = await admin.from('government_orgs').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 })

  // Fetch updated record to return the refreshed row
  const { data, error: fetchError } = await admin.from('government_orgs').select('*').eq('id', id).single()
  if (fetchError) return NextResponse.json({ error: 'Failed to fetch updated organization' }, { status: 500 })
  return NextResponse.json({ org: data })
}

// ─── DELETE /api/admin/government-orgs/[id] ──────────────────

/**
 * DELETE /api/admin/government-orgs/[id] — permanently remove a government organization.
 * Requires authentication and the `canManageSettings` permission.
 * Response: { success: true }
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ─── Auth & Permission Checks ────────────────────────────────
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  // ─── Delete ──────────────────────────────────────────────────
  // createAdminClient() bypasses RLS — required to delete government_orgs rows
  const admin = await createAdminClient()
  const { error } = await admin.from('government_orgs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete organization' }, { status: 500 })
  return NextResponse.json({ success: true })
}
