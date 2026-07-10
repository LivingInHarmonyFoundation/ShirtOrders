/**
 * @file layout.tsx
 * @description Server layout for the campaign landing route. Its sole job is to provide
 * per-campaign SSR metadata (title + Open Graph / Twitter card) so a shared campaign link
 * renders a rich preview in texts and social posts. The page itself stays a client
 * component; this layout only renders {children}.
 *
 * Uses createAdminClient() (service-role) to read the campaign by slug — orders/settings
 * RLS is locked down, and campaigns are read server-side here.
 */
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params

  try {
    const admin = await createAdminClient()
    const { data: campaign } = await admin
      .from('campaigns')
      .select('name, description, banner_url, badge_url')
      .eq('slug', slug)
      .maybeSingle()

    if (!campaign) {
      return { title: 'Campaign — Living in Harmony Foundation' }
    }

    const description = campaign.description || 'Order shirts to support this campaign.'
    const image = campaign.banner_url || campaign.badge_url || '/logo-full.jpeg'

    return {
      title: `${campaign.name} — Living in Harmony Foundation`,
      description,
      openGraph: {
        title: campaign.name,
        description,
        images: [{ url: image }],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: campaign.name,
        description,
        images: [image],
      },
    }
  } catch {
    return { title: 'Campaign — Living in Harmony Foundation' }
  }
}

export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
