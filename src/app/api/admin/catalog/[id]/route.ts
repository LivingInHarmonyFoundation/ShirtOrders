import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const allowed = ['name', 'description', 'image_url', 'display_order', 'is_active']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const admin = await createAdminClient()
  const { error } = await admin
    .from('shirt_catalog')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch updated record separately to avoid RLS blocking the returning select
  const { data, error: fetchError } = await admin
    .from('shirt_catalog')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = await createAdminClient()

  // Get image_url first to delete from storage
  const { data: item } = await admin.from('shirt_catalog').select('image_url').eq('id', id).single()

  if (item?.image_url) {
    const url = new URL(item.image_url)
    const pathParts = url.pathname.split('/shirt-images/')
    if (pathParts[1]) {
      await admin.storage.from('shirt-images').remove([pathParts[1]])
    }
  }

  const { error } = await admin.from('shirt_catalog').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  return NextResponse.json({ success: true })
}
