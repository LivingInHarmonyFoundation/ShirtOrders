import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('government_orgs')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 })
  return NextResponse.json({ orgs: data || [] })
}
