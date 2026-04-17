import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const admin = await createAdminClient()

  const { data: school, error } = await admin
    .from('school_links')
    .select('id, school_name, slug, is_active, grades, allowed_payment_methods')
    .eq('slug', slug)
    .single()

  if (error || !school) {
    return NextResponse.json({ error: 'School not found' }, { status: 404 })
  }

  if (!school.is_active) {
    return NextResponse.json({ error: 'This school link is no longer active' }, { status: 403 })
  }

  return NextResponse.json({ school })
}
