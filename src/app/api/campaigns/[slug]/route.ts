/**
 * @file route.ts
 * @description Public GET endpoint — returns a campaign by slug along with app_settings
 * fallback values for banner/badge. Used by the campaign-specific order page at
 * /campaign/[slug].
 *
 * Uses createAdminClient() (service role) since no user session exists here.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = await createAdminClient()

  const { data: campaign, error } = await admin
    .from('campaigns')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const { data: settingsRow } = await admin
    .from('app_settings')
    .select('mission_banner_url, badge_url')
    .single()

  const settings = {
    banner_url: settingsRow?.mission_banner_url ?? null,
    badge_url: settingsRow?.badge_url ?? null,
  }

  // Fetch catalog items assigned to this campaign; fall back to all active items if none assigned
  const { data: assignedRows } = await admin
    .from('campaign_catalog_items')
    .select('shirt_catalog(id, name, description, image_url, back_image_url, display_order, price, available_sizes)')
    .eq('campaign_id', campaign.id)

  let catalog_items = (assignedRows ?? [])
    .map((r: { shirt_catalog: unknown }) => r.shirt_catalog)
    .filter(Boolean)

  if (catalog_items.length === 0) {
    const { data: all } = await admin
      .from('shirt_catalog')
      .select('id, name, description, image_url, back_image_url, display_order, price, available_sizes')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })
    catalog_items = all ?? []
  }

  return NextResponse.json({ campaign, settings, catalog_items })
}
