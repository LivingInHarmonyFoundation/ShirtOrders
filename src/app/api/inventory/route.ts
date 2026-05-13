/**
 * @file route.ts
 * @description Public read-only endpoint returning current shirt inventory levels.
 * No authentication required — the client uses this to hide sold-out sizes in the
 * order form before submission. Returns all rows so the client can filter by
 * catalog_item_id (or fall back to general rows where catalog_item_id is null).
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('shirt_inventory')
    .select('id, catalog_item_id, shirt_size, quantity')
    .order('shirt_size', { ascending: true })

  if (error) return NextResponse.json({ rows: [] })
  return NextResponse.json({ rows: data || [] })
}
