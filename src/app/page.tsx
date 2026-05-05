import { createAdminClient } from '@/lib/supabase/server'
import type { ShirtCatalogItem, Campaign } from '@/types'
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

async function getActiveCampaigns(): Promise<Campaign[]> {
  try {
    const admin = await createAdminClient()
    const { data } = await admin
      .from('campaigns')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    return (data || []).filter((c: Campaign) => {
      if (c.is_recurring && c.start_date && c.end_date) {
        const s = new Date(c.start_date)
        const e = new Date(c.end_date)
        const nowMD = now.getMonth() * 100 + now.getDate()
        const startMD = s.getMonth() * 100 + s.getDate()
        const endMD = e.getMonth() * 100 + e.getDate()
        return startMD <= endMD ? nowMD >= startMD && nowMD <= endMD : nowMD >= startMD || nowMD <= endMD
      }
      if (c.end_date && c.end_date < todayStr) return false
      return true
    })
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
  const [catalog, { missionBannerUrl, badgeUrl }, activeCampaigns] = await Promise.all([
    getCatalog(),
    getPageAssets(),
    getActiveCampaigns(),
  ])

  return (
    <LandingContent
      catalog={catalog}
      missionBannerUrl={missionBannerUrl}
      badgeUrl={badgeUrl}
      campaigns={activeCampaigns}
    />
  )
}
