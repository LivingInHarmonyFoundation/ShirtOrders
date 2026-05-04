/**
 * @file route.ts
 * @description Admin inventory list and upsert endpoint.
 * - GET: returns all shirt_inventory rows joined with catalog item names.
 * - POST: upserts one inventory row (creates or updates by natural key).
 *
 * Both handlers require authentication and canManageSettings permission.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'
import type { ShirtInventoryItem } from '@/types'

// ─── GET /api/admin/inventory ─────────────────────────────────

/**
 * GET /api/admin/inventory — fetch all inventory rows joined with catalog item name.
 * Requires canManageSettings permission.
 * Response: { inventory: ShirtInventoryItem[] }
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('shirt_inventory')
    .select('*, shirt_catalog(name)')
    .order('catalog_item_id', { ascending: true, nullsFirst: true })
    .order('shirt_size')

  if (error) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 })
  }

  // Flatten the joined catalog name into a top-level field
  const inventory: ShirtInventoryItem[] = (data || []).map((row: Record<string, unknown>) => {
    const catalog = row.shirt_catalog as { name: string } | null
    return {
      id: row.id as string,
      catalog_item_id: row.catalog_item_id as string | null,
      shirt_size: row.shirt_size as string,
      quantity: row.quantity as number,
      low_stock_threshold: row.low_stock_threshold as number,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      catalog_item_name: catalog?.name ?? null,
    }
  })

  return NextResponse.json({ inventory })
}

// ─── POST /api/admin/inventory ────────────────────────────────

/**
 * POST /api/admin/inventory — create or update one inventory row.
 * Requires canManageSettings permission.
 * Body: { catalog_item_id?: string | null, shirt_size: string, quantity: number, low_stock_threshold: number }
 *
 * Uses select-then-insert-or-update instead of upsert because PostgREST cannot
 * resolve partial unique indexes (those with WHERE clauses) via onConflict.
 * Response: { item: ShirtInventoryItem } with status 201.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const { catalog_item_id, shirt_size, quantity, low_stock_threshold } = body

  // ── Validation ──
  if (!shirt_size || typeof shirt_size !== 'string' || !shirt_size.trim()) {
    return NextResponse.json({ error: 'shirt_size is required' }, { status: 400 })
  }
  if (typeof quantity !== 'number') {
    return NextResponse.json({ error: 'quantity must be a number' }, { status: 400 })
  }
  if (typeof low_stock_threshold !== 'number' || low_stock_threshold < 0) {
    return NextResponse.json({ error: 'low_stock_threshold must be a non-negative number' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const normalizedCatalogId: string | null = catalog_item_id ?? null
  const normalizedSize = shirt_size.trim()
  const now = new Date().toISOString()

  // ── Check for existing row ──
  const existingQuery = admin
    .from('shirt_inventory')
    .select('id')
    .eq('shirt_size', normalizedSize)

  const { data: existing } = await (normalizedCatalogId
    ? existingQuery.eq('catalog_item_id', normalizedCatalogId)
    : existingQuery.is('catalog_item_id', null)
  ).maybeSingle()

  // ── Insert or update ──
  let row: Record<string, unknown> | null = null
  let dbError: unknown = null

  if (existing) {
    const { data, error } = await admin
      .from('shirt_inventory')
      .update({ quantity, low_stock_threshold, updated_at: now })
      .eq('id', existing.id)
      .select('*, shirt_catalog(name)')
      .single()
    row = data as Record<string, unknown> | null
    dbError = error
  } else {
    const { data, error } = await admin
      .from('shirt_inventory')
      .insert({ catalog_item_id: normalizedCatalogId, shirt_size: normalizedSize, quantity, low_stock_threshold, updated_at: now })
      .select('*, shirt_catalog(name)')
      .single()
    row = data as Record<string, unknown> | null
    dbError = error
  }

  if (dbError || !row) {
    console.error('Error saving inventory:', dbError)
    return NextResponse.json({ error: 'Failed to save inventory' }, { status: 500 })
  }

  const catalog = row.shirt_catalog as { name: string } | null
  const item: ShirtInventoryItem = {
    id: row.id as string,
    catalog_item_id: row.catalog_item_id as string | null,
    shirt_size: row.shirt_size as string,
    quantity: row.quantity as number,
    low_stock_threshold: row.low_stock_threshold as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    catalog_item_name: catalog?.name ?? null,
  }

  return NextResponse.json({ item }, { status: 201 })
}
