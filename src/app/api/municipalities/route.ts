/**
 * @file route.ts
 * @description Public municipios endpoint — returns the active municipalities for the
 * order form's "Municipios" dropdown, ordered alphabetically. Admin management lives
 * at /api/admin/municipalities.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('municipalities')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to fetch municipalities' }, { status: 500 })
  return NextResponse.json({ municipalities: data || [] })
}
