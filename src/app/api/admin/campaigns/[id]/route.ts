/**
 * @file route.ts
 * @description Single-campaign endpoint (by UUID). PATCH updates allowed fields and
 * handles campaign activation (which deactivates all other campaigns server-side).
 * DELETE removes a campaign but blocks deletion of currently active campaigns.
 * Both handlers require authentication and the `canManageSettings` permission.
 * Uses `createAdminClient()` (bypasses RLS) for all DB reads and writes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── PATCH /api/admin/campaigns/[id] ─────────────────────────

/**
 * PATCH /api/admin/campaigns/[id] — update a campaign's allowed fields.
 * Requires authentication and the `canManageSettings` permission.
 * Allowed body keys: name, description, start_date, end_date, ended_message, is_active.
 * Side effect: if `is_active` is set to `true`, all OTHER campaigns are deactivated
 * server-side before this one is activated (only one campaign may be active at a time).
 * Response: { campaign: Campaign } with the refreshed row and derived order_count.
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
  // createAdminClient() bypasses RLS — required to write campaigns and deactivate others
  const admin = await createAdminClient()
  const body = await request.json()

  const allowed = ['name', 'description', 'start_date', 'end_date', 'ended_message', 'is_active']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  // ─── Activation Guard ────────────────────────────────────────
  // If activating, deactivate all other campaigns first
  // Only one campaign may be active at a time; this is enforced server-side
  if (updates.is_active === true) {
    await admin.from('campaigns').update({ is_active: false }).neq('id', id)
  }

  // ─── Update & Fetch ──────────────────────────────────────────
  const { error } = await admin.from('campaigns').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })

  // Fetch updated record separately to get the refreshed row with order count
  const { data, error: fetchErr } = await admin
    .from('campaigns')
    .select('*, orders(count)')
    .eq('id', id)
    .single()
  if (fetchErr) return NextResponse.json({ error: 'Failed to fetch updated campaign' }, { status: 500 })

  // ─── Response Shaping ────────────────────────────────────────
  // Flatten the Supabase aggregate array into a scalar order_count, strip the raw orders key
  const campaign = {
    ...data,
    order_count: Array.isArray(data.orders) ? (data.orders[0] as { count: number })?.count ?? 0 : 0,
  }
  delete campaign.orders

  return NextResponse.json({ campaign })
}

// ─── DELETE /api/admin/campaigns/[id] ────────────────────────

/**
 * DELETE /api/admin/campaigns/[id] — permanently remove a campaign.
 * Requires authentication and the `canManageSettings` permission.
 * Returns 400 if the campaign is currently active — it must be deactivated first.
 * Response: { success: true } on successful deletion.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ─── Auth & Permission Checks ────────────────────────────────
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  // ─── Active Campaign Guard ────────────────────────────────────
  // createAdminClient() bypasses RLS — required to read and delete campaign rows
  const admin = await createAdminClient()

  const { data: campaign } = await admin.from('campaigns').select('is_active').eq('id', id).single()
  if (campaign?.is_active) {
    return NextResponse.json({ error: 'Cannot delete an active campaign. Deactivate it first.' }, { status: 400 })
  }

  // ─── Delete ──────────────────────────────────────────────────
  const { error } = await admin.from('campaigns').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
  return NextResponse.json({ success: true })
}
