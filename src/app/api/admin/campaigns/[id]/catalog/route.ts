import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

type Params = { params: Promise<{ id: string }> }

// GET /api/admin/campaigns/[id]/catalog
// Returns all catalog items + which are assigned to this campaign.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  const admin = await createAdminClient()

  const [allRes, assignedRes] = await Promise.all([
    admin.from('shirt_catalog')
      .select('id, name, description, image_url, back_image_url, display_order, is_active')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
    admin.from('campaign_catalog_items')
      .select('catalog_item_id')
      .eq('campaign_id', id),
  ])

  if (allRes.error) return NextResponse.json({ error: 'Failed to fetch catalog' }, { status: 500 })

  const assigned_ids = (assignedRes.data ?? []).map(r => r.catalog_item_id)
  return NextResponse.json({ all_items: allRes.data ?? [], assigned_ids })
}

// PATCH /api/admin/campaigns/[id]/catalog
// Body: { catalog_item_ids: string[] }
// Replaces all assignments for this campaign.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  const { catalog_item_ids } = await req.json() as { catalog_item_ids: string[] }
  const admin = await createAdminClient()

  // Delete existing assignments
  const { error: delErr } = await admin
    .from('campaign_catalog_items')
    .delete()
    .eq('campaign_id', id)

  if (delErr) return NextResponse.json({ error: 'Failed to update assignments' }, { status: 500 })

  // Insert new ones (if any)
  if (catalog_item_ids.length > 0) {
    const rows = catalog_item_ids.map(cid => ({ campaign_id: id, catalog_item_id: cid }))
    const { error: insErr } = await admin.from('campaign_catalog_items').insert(rows)
    if (insErr) return NextResponse.json({ error: 'Failed to save assignments' }, { status: 500 })
  }

  return NextResponse.json({ assigned_ids: catalog_item_ids })
}
