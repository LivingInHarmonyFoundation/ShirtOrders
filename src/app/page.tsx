import { createAdminClient } from '@/lib/supabase/server'
import type { ShirtCatalogItem } from '@/types'
import LandingContent from './LandingContent'

export const dynamic = 'force-dynamic'

async function getCatalog(): Promise<ShirtCatalogItem[]> {
  try {
    const admin = await createAdminClient()
    const { data } = await admin
      .from('shirt_catalog')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })
    return data || []
  } catch {
    return []
  }
}

async function getPageAssets(): Promise<{ missionBannerUrl: string | null; badgeUrl: string | null }> {
  try {
    const admin = await createAdminClient()
    const { data } = await admin
      .from('app_settings')
      .select('mission_banner_url, badge_url')
      .single()
    return {
      missionBannerUrl: data?.mission_banner_url ?? null,
      badgeUrl: data?.badge_url ?? null,
    }
  } catch {
    return { missionBannerUrl: null, badgeUrl: null }
  }
}

export default async function LandingPage() {
  const [catalog, { missionBannerUrl, badgeUrl }] = await Promise.all([getCatalog(), getPageAssets()])

  return (
    <LandingContent
      catalog={catalog}
      missionBannerUrl={missionBannerUrl}
      badgeUrl={badgeUrl}
    />
  )
}
