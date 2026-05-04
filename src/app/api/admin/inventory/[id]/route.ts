/**
 * @file route.ts
 * @description Admin inventory update-by-id endpoint.
 * - PATCH: update quantity and/or low_stock_threshold for a specific inventory row.
 *
 * Requires authentication and canManageSettings permission.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'
import type { ShirtInventoryItem } from '@/types'

// ─── PATCH /api/admin/inventory/[id] ─────────────────────────

/**
 * PATCH /api/admin/inventory/[id] — update quantity and/or low_stock_threshold.
 * Requires canManageSettings permission.
 * Body: { quantity?: number, low_stock_threshold?: number }
 * Response: { item: ShirtInventoryItem }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const updateData: Record<string, unknown> = {}

  if ('quantity' in body) {
    if (typeof body.quantity !== 'number') {
      return NextResponse.json({ error: 'quantity must be a number' }, { status: 400 })
    }
    updateData.quantity = body.quantity
  }

  if ('low_stock_threshold' in body) {
    if (typeof body.low_stock_threshold !== 'number' || body.low_stock_threshold < 0) {
      return NextResponse.json({ error: 'low_stock_threshold must be a non-negative number' }, { status: 400 })
    }
    updateData.low_stock_threshold = body.low_stock_threshold
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  updateData.updated_at = new Date().toISOString()

  const admin = await createAdminClient()
  const { data: row, error } = await admin
    .from('shirt_inventory')
    .update(updateData)
    .eq('id', id)
    .select('*, shirt_catalog(name)')
    .single()

  if (error) {
    console.error('Error updating inventory row:', error)
    return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 })
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

  return NextResponse.json({ item })
}
