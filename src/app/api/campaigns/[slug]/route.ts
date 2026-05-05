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

  return NextResponse.json({ campaign, settings })
}
