import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const admin = await createAdminClient()

  const { data: company, error } = await admin
    .from('private_companies')
    .select('id, name, slug, is_active, allowed_payment_methods')
    .eq('slug', slug)
    .single()

  if (error || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  if (!company.is_active) {
    return NextResponse.json({ error: 'This company link is no longer active' }, { status: 403 })
  }

  return NextResponse.json({ company })
}
