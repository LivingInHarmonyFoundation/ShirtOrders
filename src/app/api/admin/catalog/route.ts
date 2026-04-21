/**
 * @file route.ts
 * @description Shirt catalog collection endpoint. GET is public (no auth required) and
 * returns all catalog items ordered by display_order then created_at. POST creates a new
 * catalog item and requires authentication plus the `canManageSettings` permission.
 * Uses `createAdminClient()` (bypasses RLS) for all DB reads and writes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── GET /api/admin/catalog ───────────────────────────────────

/**
 * GET /api/admin/catalog — return all shirt catalog items ordered by display_order (asc),
 * then created_at (asc) as a tiebreaker.
 * Public endpoint — no authentication required.
 * Uses createAdminClient() (bypasses RLS) to guarantee visibility of all rows.
 * Response: { items: CatalogItem[] }
 */
export async function GET() {
  // ─── Query & Data Fetching ───────────────────────────────────
  // createAdminClient() bypasses RLS — catalog reads must work even without a session
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
  const { name, description, image_url, back_image_url, display_order } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  // ─── Insert ──────────────────────────────────────────────────
  // createAdminClient() bypasses RLS — required to write catalog rows
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('shirt_catalog')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      image_url: image_url || null,
      back_image_url: back_image_url || null,
      display_order: display_order ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create catalog item' }, { status: 500 })
  return NextResponse.json({ item: data }, { status: 201 })
}
