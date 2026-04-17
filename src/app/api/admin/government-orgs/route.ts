import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('government_orgs')
    .select('*')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 })
  return NextResponse.json({ orgs: data || [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })

  const admin = await createAdminClient()

  const { data: existing } = await admin
    .from('government_orgs')
    .select('id')
    .ilike('name', name.trim())
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'This organization already exists' }, { status: 409 })

  const { data, error } = await admin
    .from('government_orgs')
    .insert({ name: name.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
  return NextResponse.json({ org: data }, { status: 201 })
}
