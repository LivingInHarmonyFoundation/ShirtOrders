import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await createAdminClient()
  const { data: companies, error } = await admin
    .from('private_companies')
    .select('*, orders(count)')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })

  const shaped = (companies || []).map((c) => ({
    ...c,
    order_count: Array.isArray(c.orders) ? (c.orders[0] as { count: number })?.count ?? 0 : 0,
    orders: undefined,
  }))

  return NextResponse.json({ companies: shaped })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Company name is required' }, { status: 400 })

  const admin = await createAdminClient()

  const { data: existing } = await admin
    .from('private_companies')
    .select('id')
    .ilike('name', name.trim())
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'This company already exists' }, { status: 409 })

  // Try up to 5 times to get a unique slug
  let slug = ''
  for (let i = 0; i < 5; i++) {
    const candidate = generateSlug(name.trim())
    const { data: taken } = await admin
      .from('private_companies')
      .select('id')
      .eq('slug', candidate)
      .single()
    if (!taken) { slug = candidate; break }
  }
  if (!slug) return NextResponse.json({ error: 'Could not generate unique slug' }, { status: 500 })

  const { data, error } = await admin
    .from('private_companies')
    .insert({ name: name.trim(), slug })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create company' }, { status: 500 })
  return NextResponse.json({ company: { ...data, order_count: 0 } }, { status: 201 })
}
