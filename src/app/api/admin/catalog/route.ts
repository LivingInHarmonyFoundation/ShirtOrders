/**
 * @file route.ts
 * @description Shirt catalog collection endpoint. GET returns ALL catalog items (including
 * inactive/draft ones) and therefore requires authentication plus `canManageSettings` — the
 * public order form uses /api/catalog, which filters to active items only. POST creates a
 * new catalog item and requires the same permission.
 * Uses `createAdminClient()` (bypasses RLS) for all DB reads and writes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── GET /api/admin/catalog ───────────────────────────────────

/**
 * GET /api/admin/catalog — return all shirt catalog items (active and inactive) ordered by
 * display_order (asc), then created_at (asc) as a tiebreaker.
 * Requires authentication and the `canManageSettings` permission — this exposes draft/
 * unpublished designs and pricing, so it must not be public.
 * Response: { items: CatalogItem[] }
 */
export async function GET() {
  // ─── Auth & Permission Checks ────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  // ─── Query & Data Fetching ───────────────────────────────────
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('shirt_catalog')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'Failed to fetch catalog' }, { status: 500 })
  return NextResponse.json({ items: data || [] })
}

// ─── POST /api/admin/catalog ──────────────────────────────────

/**
 * POST /api/admin/catalog — create a new catalog item.
 * Requires authentication and the `canManageSettings` permission.
 * Body: { name, description?, image_url?, back_image_url?, display_order? }
 * `display_order` defaults to 0 if omitted.
 * Response: { item: CatalogItem } with status 201.
 */
export async function POST(request: NextRequest) {
  // ─── Auth & Permission Checks ────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  // ─── Input Validation ────────────────────────────────────────
  const { name, description, image_url, back_image_url, display_order, price, available_sizes } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  // ─── Insert ──────────────────────────────────────────────────
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('shirt_catalog')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      image_url: image_url || null,
      back_image_url: back_image_url || null,
      display_order: display_order ?? 0,
      price: price != null ? Number(price) : null,
      available_sizes: available_sizes?.length > 0 ? available_sizes : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create catalog item' }, { status: 500 })
  return NextResponse.json({ item: data }, { status: 201 })
}
