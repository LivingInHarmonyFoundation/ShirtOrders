/**
 * @file route.ts
 * @description Single private company endpoint (by UUID). PATCH updates allowed fields
 * (name, is_active, allowed_payment_methods); DELETE removes the company. Both handlers
 * require authentication and the `canManageSettings` permission. Uses
 * `createAdminClient()` (bypasses RLS) for all DB reads and writes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── PATCH /api/admin/private-companies/[id] ─────────────────

/**
 * PATCH /api/admin/private-companies/[id] — update allowed fields on a private company.
 * Requires authentication and the `canManageSettings` permission.
 * Allowed body keys: name, is_active, allowed_payment_methods.
 * Returns 400 if the body contains none of those keys.
 * The updated row is fetched after the update and returned in the response.
 * Response: { company: PrivateCompany }
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
  // createAdminClient() bypasses RLS — required to write private_companies rows
  const admin = await createAdminClient()
  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if ('name' in body) updates.name = body.name
  if ('is_active' in body) updates.is_active = body.is_active
  if ('allowed_payment_methods' in body) updates.allowed_payment_methods = body.allowed_payment_methods

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // ─── Update & Fetch ──────────────────────────────────────────
  const { error } = await admin.from('private_companies').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to update company' }, { status: 500 })

  // Fetch the refreshed row to return current state
  const { data, error: fetchError } = await admin.from('private_companies').select('*').eq('id', id).single()
  if (fetchError) return NextResponse.json({ error: 'Failed to fetch updated company' }, { status: 500 })
  return NextResponse.json({ company: data })
}

// ─── DELETE /api/admin/private-companies/[id] ────────────────

/**
 * DELETE /api/admin/private-companies/[id] — permanently remove a private company.
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
  // createAdminClient() bypasses RLS — required to delete private_companies rows
  const admin = await createAdminClient()
  const { error } = await admin.from('private_companies').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete company' }, { status: 500 })
  return NextResponse.json({ success: true })
}
