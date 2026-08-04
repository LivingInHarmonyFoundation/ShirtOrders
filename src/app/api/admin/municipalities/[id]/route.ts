/**
 * @file route.ts
 * @description Single municipio endpoint (by UUID). PATCH updates name/is_active;
 * DELETE removes the municipio. Both require authentication and the
 * `canManageSettings` permission. Mirrors /api/admin/government-orgs/[id].
 * Uses `createAdminClient()` (bypasses RLS) for all DB reads and writes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── PATCH /api/admin/municipalities/[id] ────────────────────

/**
 * PATCH /api/admin/municipalities/[id] — update name and/or is_active.
 * Requires authentication and the `canManageSettings` permission.
 * Response: { municipality: Municipality }
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
  const admin = await createAdminClient()
  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if ('name' in body) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }
    updates.name = body.name.trim()
  }
  if ('is_active' in body) updates.is_active = !!body.is_active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // ─── Update & Fetch ──────────────────────────────────────────
  const { error } = await admin.from('municipalities').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to update municipio' }, { status: 500 })

  const { data, error: fetchError } = await admin.from('municipalities').select('*').eq('id', id).single()
  if (fetchError) return NextResponse.json({ error: 'Failed to fetch updated municipio' }, { status: 500 })
  return NextResponse.json({ municipality: data })
}

// ─── DELETE /api/admin/municipalities/[id] ───────────────────

/**
 * DELETE /api/admin/municipalities/[id] — permanently remove a municipio.
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
  const admin = await createAdminClient()
  const { error } = await admin.from('municipalities').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete municipio' }, { status: 500 })
  return NextResponse.json({ success: true })
}
