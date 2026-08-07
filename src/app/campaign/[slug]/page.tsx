'use client'

import { useState, useEffect, use } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, ShoppingBag, Calendar, ArrowRight } from 'lucide-react'
import ShirtViewer from '@/components/shared/ShirtViewer'
import LanguageSelector from '@/components/shared/LanguageSelector'
import PoweredByFooter from '@/components/shared/PoweredByFooter'
import PendingOrderBanner from '@/components/shared/PendingOrderBanner'
import { useT } from '@/contexts/LanguageContext'
import type { Campaign, ShirtCatalogItem } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────

function isEffectivelyActive(campaign: Campaign, now = new Date()): boolean {
  if (!campaign.is_active) return false
  const today = now.toISOString().split('T')[0]
  if (campaign.is_recurring && campaign.start_date && campaign.end_date) {
    const s = new Date(campaign.start_date)
    const e = new Date(campaign.end_date)
    const nowMD = now.getMonth() * 100 + now.getDate()
    const startMD = s.getMonth() * 100 + s.getDate()
    const endMD = e.getMonth() * 100 + e.getDate()
    const inWindow =
      startMD <= endMD
        ? nowMD >= startMD && nowMD <= endMD
        : nowMD >= startMD || nowMD <= endMD
    return inWindow
  }
  if (campaign.end_date && campaign.end_date < today) return false
  return true
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Shared layout shells ─────────────────────────────────────

function AccentBar() {
  return (
    <div
      className="h-[3px] w-full flex-shrink-0"
      style={{ background: 'linear-gradient(90deg, #00352F 0%, #CEDC00 60%, #00352F 100%)' }}
    />
  )
}

function MinimalHeader({ logoSrc }: { logoSrc: string }) {
  return (
    <header
      className="border-b"
      style={{
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderBottomColor: 'rgba(0,0,0,0.05)',
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden p-0.5">
            <Image src={logoSrc} alt="Logo" width={32} height={32} className="object-contain" />
          </div>
          <p className="font-semibold leading-none" style={{ color: '#00352F', fontSize: '13px' }}>
            <span className="hidden sm:inline">Living in Harmony Foundation</span>
            <span className="sm:hidden">LIH Foundation</span>
          </p>
        </div>
        <LanguageSelector />
      </div>
    </header>
  )
}

// ─── Page ─────────────────────────────────────────────────────

export default function CampaignShowcasePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const t = useT()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [fallbackSettings, setFallbackSettings] = useState<{
    banner_url: string | null
    badge_url: string | null
  }>({ banner_url: null, badge_url: null })
  const [loadState, setLoadState] = useState<'loading' | 'notfound' | 'ready'>('loading')
  const [catalog, setCatalog] = useState<ShirtCatalogItem[]>([])
  const [heroItem, setHeroItem] = useState<ShirtCatalogItem | null>(null)

  // ─── Data fetching ───────────────────────────────────────────

  useEffect(() => {
    fetch(`/api/campaigns/${slug}`)
      .then(r => {
        if (!r.ok) { setLoadState('notfound'); return null }
        return r.json()
      })
      .then(json => {
        if (!json) return
        setCampaign(json.campaign)
        setFallbackSettings(json.settings)
        if (json.catalog_items?.length > 0) {
          setCatalog(json.catalog_items)
          setHeroItem(json.catalog_items[0])
        }
        setLoadState('ready')
      })
      .catch(() => setLoadState('notfound'))
  }, [slug])

  // ─── Derived values ──────────────────────────────────────────

  const effectiveBannerUrl = campaign?.banner_url || fallbackSettings.banner_url || null
  const effectiveBadgeUrl = campaign?.badge_url || fallbackSettings.badge_url || null
  const logoSrc = effectiveBadgeUrl || '/logo.png'

  // ─── Loading ─────────────────────────────────────────────────

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F4F0' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#00352F' }} />
      </div>
    )
  }

  // ─── Not found ───────────────────────────────────────────────

  if (loadState === 'notfound') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F5F4F0' }}>
        <AccentBar />
        <MinimalHeader logoSrc="/logo.png" />
        <main className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
            style={{ backgroundColor: '#E5F2F0' }}
          >
            <ShoppingBag className="w-8 h-8" style={{ color: '#00352F' }} />
          </div>
          <h1 className="font-heading text-2xl font-bold text-gray-900 mb-3">
            {t('order', 'campaignNotFound')}
          </h1>
          <p className="text-gray-500 max-w-sm leading-relaxed mb-8">
            {t('order', 'campaignNotFoundDesc')}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:-translate-y-0.5"
            style={{ backgroundColor: '#00352F' }}
          >
            ← {t('common', 'backToHome')}
          </Link>
        </main>
      </div>
    )
  }

  // ─── Campaign ended ──────────────────────────────────────────

  if (campaign && !isEffectivelyActive(campaign)) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F5F4F0' }}>
        <AccentBar />
        <MinimalHeader logoSrc={logoSrc} />
        <main className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
            style={{ backgroundColor: '#E5F2F0' }}
          >
            <ShoppingBag className="w-8 h-8" style={{ color: '#00352F' }} />
          </div>
          <h1 className="font-heading text-2xl font-bold text-gray-900 mb-3">
            {campaign.name}
          </h1>
          <p className="text-gray-500 max-w-sm leading-relaxed">
            {campaign.ended_message || t('errors', 'campaignEnded')}
          </p>
        </main>
      </div>
    )
  }

  // ─── Ready ───────────────────────────────────────────────────

  const multipleItems = catalog.length > 1
  const displayItem = heroItem ?? catalog[0] ?? null

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F4F0' }}>
      {/* Accent bar */}
      <AccentBar />

      {/* Sticky header */}
      <header
        className="border-b sticky top-0 z-10"
        style={{
          backgroundColor: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottomColor: 'rgba(0,0,0,0.05)',
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Badge + name */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden p-0.5 flex-shrink-0">
              <Image
                src={logoSrc}
                alt={campaign?.name ?? 'Campaign logo'}
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <p
              className="font-semibold leading-none truncate"
              style={{ color: '#00352F', fontSize: '13px' }}
            >
              <span className="hidden sm:inline">{campaign?.name}</span>
              <span className="sm:hidden">LIH Foundation</span>
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <LanguageSelector />
            <Link
              href="/"
              className="text-gray-400 hover:text-[#00352F] transition-colors flex items-center gap-1 font-medium"
              style={{ fontSize: '12px' }}
            >
              <span>←</span> {t('common', 'back')}
            </Link>
          </div>
        </div>
      </header>

      {/* Banner image — shown in full (no cropping) at its natural aspect ratio */}
      {effectiveBannerUrl && (
        <div className="w-full overflow-hidden bg-white">
          <Image
            src={effectiveBannerUrl}
            alt={campaign?.name ?? 'Campaign banner'}
            width={0}
            height={0}
            sizes="100vw"
            className="w-full h-auto"
          />
        </div>
      )}

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <PendingOrderBanner />

        {/* Campaign identity card */}
        <div className="flex items-start gap-4">
          {effectiveBadgeUrl && (
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-100 shadow-sm flex-shrink-0 bg-white">
              <Image
                src={effectiveBadgeUrl}
                alt={campaign?.name ?? 'Badge'}
                width={48}
                height={48}
                className="object-contain w-full h-full"
              />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold text-gray-900 leading-tight">
              {campaign?.name}
            </h1>
            {campaign?.description && (
              <p className="text-gray-500 mt-1 text-sm leading-relaxed">
                {campaign.description}
              </p>
            )}
            {(campaign?.start_date || campaign?.end_date) && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400 font-medium">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  {campaign.start_date && formatDate(campaign.start_date)}
                  {campaign.start_date && campaign.end_date && ' → '}
                  {campaign.end_date && formatDate(campaign.end_date)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Shirt section */}
        {catalog.length > 0 && (
          <div>
            {/* Section heading */}
            <div className="flex items-center gap-3 mb-5">
              <h2 className="font-heading text-base font-semibold text-gray-700 whitespace-nowrap">
                {t('landing', 'yourShirt')}
              </h2>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Single item */}
            {!multipleItems && displayItem && (
              <div className="flex flex-col items-center">
                <div className="max-w-xs w-full mx-auto">
                  <ShirtViewer
                    frontUrl={displayItem.image_url}
                    backUrl={displayItem.back_image_url ?? null}
                    name={displayItem.name}
                    variant="square"
                  />
                </div>
                <div className="mt-4 text-center">
                  <p className="font-semibold text-gray-900">{displayItem.name}</p>
                </div>
              </div>
            )}

            {/* Multiple items */}
            {multipleItems && displayItem && (
              <div className="space-y-4">
                {/* Hero viewer */}
                <div className="max-w-sm w-full mx-auto">
                  <ShirtViewer
                    frontUrl={displayItem.image_url}
                    backUrl={displayItem.back_image_url ?? null}
                    name={displayItem.name}
                    variant="square"
                  />
                </div>

                {/* Selected item name + price */}
                <div className="text-center">
                  <p className="font-semibold text-gray-900">{displayItem.name}</p>
                </div>

                {/* Thumbnail scroll row */}
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
                  {catalog.map(item => {
                    const isSelected = heroItem?.id === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setHeroItem(item)}
                        className="w-36 flex-shrink-0 rounded-xl border-2 overflow-hidden transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        style={{
                          borderColor: isSelected ? '#00352F' : '#E5E7EB',
                        }}
                        aria-pressed={isSelected}
                        aria-label={item.name}
                      >
                        <ShirtViewer
                          frontUrl={item.image_url}
                          backUrl={item.back_image_url ?? null}
                          name={item.name}
                          variant="compact"
                        />
                        <div
                          className="px-2 py-2 text-left"
                          style={{ backgroundColor: isSelected ? '#E5F2F0' : '#FFFFFF' }}
                        >
                          <p
                            className="text-xs font-semibold leading-tight truncate"
                            style={{ color: isSelected ? '#00352F' : '#1F2937' }}
                          >
                            {item.name}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Order Now CTA */}
        <div className="pt-2">
          <Link
            href={`/campaign/${slug}/order`}
            className="block w-full text-center py-4 rounded-2xl text-white font-bold text-lg transition-all hover:-translate-y-0.5 active:translate-y-0"
            style={{ backgroundColor: '#00352F' }}
          >
            <span className="inline-flex items-center gap-2">
              {t('landing', 'orderNow')}
              <ArrowRight className="w-5 h-5" />
            </span>
          </Link>
        </div>

        {/* Footer */}
        <PoweredByFooter />
      </main>
    </div>
  )
}
