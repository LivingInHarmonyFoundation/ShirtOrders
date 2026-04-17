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

  // Get schools with order counts
  const { data: schools, error } = await admin
    .from('school_links')
    .select('*, orders(count)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch schools' }, { status: 500 })

  const shaped = (schools || []).map((s) => ({
    id: s.id,
    school_name: s.school_name,
    slug: s.slug,
    is_active: s.is_active,
    grades: s.grades ?? null,
    allowed_payment_methods: s.allowed_payment_methods ?? null,
    created_at: s.created_at,
    order_count: Array.isArray(s.orders) ? (s.orders[0] as { count: number })?.count ?? 0 : 0,
  }))

  return NextResponse.json({ schools: shaped })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSchools')
  if (auth instanceof NextResponse) return auth

  const admin = await createAdminClient()
  const { school_name } = await request.json()

  if (!school_name?.trim()) {
    return NextResponse.json({ error: 'School name is required' }, { status: 400 })
  }

  // Try up to 5 times to get a unique slug
  let slug = ''
  for (let i = 0; i < 5; i++) {
    const candidate = generateSlug(school_name)
    const { data: existing } = await admin
      .from('school_links')
      .select('id')
      .eq('slug', candidate)
      .single()
    if (!existing) { slug = candidate; break }
  }

  if (!slug) return NextResponse.json({ error: 'Could not generate unique slug' }, { status: 500 })

  const { data: school, error } = await admin
    .from('school_links')
    .insert({ school_name: school_name.trim(), slug })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create school link' }, { status: 500 })

  return NextResponse.json({ school }, { status: 201 })
}
