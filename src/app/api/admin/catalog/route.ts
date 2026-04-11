import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('shirt_catalog')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'Failed to fetch catalog' }, { status: 500 })
  return NextResponse.json({ items: data || [] })
}

export async function POST(request: NextRequest) {
  const user = await requireAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, image_url, display_order } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('shirt_catalog')
    .insert({ name: name.trim(), description: description?.trim() || null, image_url: image_url || null, display_order: display_order ?? 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
  return NextResponse.json({ item: data }, { status: 201 })
}
