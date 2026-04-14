import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('campaigns')
    .select('id, name, description, start_date, end_date, is_active, ended_message')
    .eq('is_active', true)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 })
  return NextResponse.json({ campaign: data || null })
}
