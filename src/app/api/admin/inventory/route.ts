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
 * POST /api/admin/inventory — upsert one inventory row.
 * Requires canManageSettings permission.
 * Body: { catalog_item_id?: string | null, shirt_size: string, quantity: number, low_stock_threshold: number }
 * Uses onConflict targeting the appropriate partial unique index.
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

  const payload = {
    catalog_item_id: catalog_item_id ?? null,
    shirt_size: shirt_size.trim(),
    quantity,
    low_stock_threshold,
    updated_at: new Date().toISOString(),
  }

  // Supabase upsert with onConflict on the two columns that together make the natural key.
  // The partial unique indexes enforce the constraint at the DB level; onConflict here
  // tells PostgREST which columns to use for the conflict resolution.
  const { data: row, error } = await admin
    .from('shirt_inventory')
    .upsert(payload, { onConflict: 'catalog_item_id,shirt_size' })
    .select('*, shirt_catalog(name)')
    .single()

  if (error) {
    // Fall back to a separate upsert for the general (null catalog_item_id) case
    // because PostgREST can't reference a partial index directly for null columns.
    if (payload.catalog_item_id === null) {
      // Try to find an existing general row for this size and update it
      const { data: existing } = await admin
        .from('shirt_inventory')
        .select('id')
        .is('catalog_item_id', null)
        .eq('shirt_size', payload.shirt_size)
        .maybeSingle()

      if (existing) {
        const { data: updated, error: updateError } = await admin
          .from('shirt_inventory')
          .update({ quantity, low_stock_threshold, updated_at: payload.updated_at })
          .eq('id', existing.id)
          .select('*, shirt_catalog(name)')
          .single()

        if (updateError) {
          console.error('Error updating general inventory:', updateError)
          return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 })
        }

        const catalog = (updated as Record<string, unknown>).shirt_catalog as { name: string } | null
        const item: ShirtInventoryItem = {
          id: (updated as Record<string, unknown>).id as string,
          catalog_item_id: null,
          shirt_size: (updated as Record<string, unknown>).shirt_size as string,
          quantity: (updated as Record<string, unknown>).quantity as number,
          low_stock_threshold: (updated as Record<string, unknown>).low_stock_threshold as number,
          created_at: (updated as Record<string, unknown>).created_at as string,
          updated_at: (updated as Record<string, unknown>).updated_at as string,
          catalog_item_name: catalog?.name ?? null,
        }
        return NextResponse.json({ item }, { status: 201 })
      }

      // No existing row — insert fresh
      const { data: inserted, error: insertError } = await admin
        .from('shirt_inventory')
        .insert(payload)
        .select('*, shirt_catalog(name)')
        .single()

      if (insertError) {
        console.error('Error inserting general inventory:', insertError)
        return NextResponse.json({ error: 'Failed to create inventory' }, { status: 500 })
      }

      const catalog = (inserted as Record<string, unknown>).shirt_catalog as { name: string } | null
      const item: ShirtInventoryItem = {
        id: (inserted as Record<string, unknown>).id as string,
        catalog_item_id: null,
        shirt_size: (inserted as Record<string, unknown>).shirt_size as string,
        quantity: (inserted as Record<string, unknown>).quantity as number,
        low_stock_threshold: (inserted as Record<string, unknown>).low_stock_threshold as number,
        created_at: (inserted as Record<string, unknown>).created_at as string,
        updated_at: (inserted as Record<string, unknown>).updated_at as string,
        catalog_item_name: catalog?.name ?? null,
      }
      return NextResponse.json({ item }, { status: 201 })
    }

    console.error('Error upserting inventory:', error)
    return NextResponse.json({ error: 'Failed to save inventory' }, { status: 500 })
  }

  const catalog = (row as Record<string, unknown>).shirt_catalog as { name: string } | null
  const item: ShirtInventoryItem = {
    id: (row as Record<string, unknown>).id as string,
    catalog_item_id: (row as Record<string, unknown>).catalog_item_id as string | null,
    shirt_size: (row as Record<string, unknown>).shirt_size as string,
    quantity: (row as Record<string, unknown>).quantity as number,
    low_stock_threshold: (row as Record<string, unknown>).low_stock_threshold as number,
    created_at: (row as Record<string, unknown>).created_at as string,
    updated_at: (row as Record<string, unknown>).updated_at as string,
    catalog_item_name: catalog?.name ?? null,
  }

  return NextResponse.json({ item }, { status: 201 })
}
