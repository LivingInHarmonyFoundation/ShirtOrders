/**
 * @file route.ts
 * @description Single catalog item endpoint (by UUID). PATCH updates allowed fields;
 * DELETE removes the item and also cleans up its associated storage file from the
 * `shirt-images` bucket. Both handlers require authentication and the
 * `canManageSettings` permission. Uses `createAdminClient()` (bypasses RLS) for
 * all DB and Storage operations.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'
import { sanitizeSizePrices } from '@/lib/utils'

// ─── PATCH /api/admin/catalog/[id] ───────────────────────────

/**
 * PATCH /api/admin/catalog/[id] — update allowed fields on a catalog item.
 * Requires authentication and the `canManageSettings` permission.
 * Allowed body keys: name, description, image_url, back_image_url, display_order, is_active.
 * The updated row is fetched in a separate query after the update to avoid RLS
 * blocking an inline RETURNING select.
 * Response: { item: CatalogItem }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ─── Auth & Permission Checks ────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  // ─── Input Validation & Field Allowlist ──────────────────────
  const { id } = await params
  const body = await request.json()
  const allowed = ['name', 'description', 'image_url', 'back_image_url', 'display_order', 'is_active', 'price', 'available_sizes', 'size_prices']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  // size_prices is untrusted JSON — normalize to a clean { size: price } map before persisting
  if ('size_prices' in updates) updates.size_prices = sanitizeSizePrices(updates.size_prices)

  // ─── Update ──────────────────────────────────────────────────
  // createAdminClient() bypasses RLS — required to write catalog rows
  const admin = await createAdminClient()
  const { error } = await admin
    .from('shirt_catalog')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Failed to update catalog item' }, { status: 500 })

  // ─── Fetch Updated Record ────────────────────────────────────
  // Fetch updated record separately to avoid RLS blocking the returning select
  const { data, error: fetchError } = await admin
    .from('shirt_catalog')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError) return NextResponse.json({ error: 'Failed to fetch updated item' }, { status: 500 })
  return NextResponse.json({ item: data })
}

// ─── DELETE /api/admin/catalog/[id] ──────────────────────────

/**
 * DELETE /api/admin/catalog/[id] — permanently remove a catalog item and its storage file.
 * Requires authentication and the `canManageSettings` permission.
 * If the item has an `image_url` pointing to the `shirt-images` bucket, the corresponding
 * storage object is removed first (best-effort; DB deletion proceeds even if storage removal
 * fails). Response: { success: true }
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ─── Auth & Permission Checks ────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  // ─── Storage Cleanup ─────────────────────────────────────────
  const { id } = await params
  // createAdminClient() bypasses RLS — required to read and delete catalog rows and Storage objects
  const admin = await createAdminClient()

  // Get image_url first to delete from storage
  const { data: item } = await admin.from('shirt_catalog').select('image_url').eq('id', id).single()

  if (item?.image_url) {
    // Extract the storage object path from the public URL (everything after 'shirt-images/')
    const url = new URL(item.image_url)
    const pathParts = url.pathname.split('/shirt-images/')
    if (pathParts[1]) {
      await admin.storage.from('shirt-images').remove([pathParts[1]])
    }
  }

  // ─── Delete ──────────────────────────────────────────────────
  const { error } = await admin.from('shirt_catalog').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  return NextResponse.json({ success: true })
}
