/**
 * @file LandingContent.tsx
 * @description Client component for the public landing page.
 *
 * When active campaigns exist, the page becomes a campaign selector — customers
 * see only the campaign cards and choose which one to order from. Each campaign
 * links to its own branded page at /campaign/[slug].
 *
 * When no campaigns are active, the full landing page is shown (hero, trust
 * strip, mission section, shirt catalog preview, "Who Can Order" grid,
 * "How It Works" timeline, and footer) — completely unchanged from before.
 */

'use client'

import Link from 'next/link'
import Image from 'next/image'
import { buttonVariants } from '@/components/ui/button'
import {
  School, Building2, User, Briefcase,
  CheckCircle, Shield, CreditCard, FileText, ArrowRight,
} from 'lucide-react'
import type { ShirtCatalogItem, Campaign } from '@/types'
import ShirtViewer from '@/components/shared/ShirtViewer'
import LanguageSelector from '@/components/shared/LanguageSelector'
import { useT } from '@/contexts/LanguageContext'

interface LandingContentProps {
  catalog: ShirtCatalogItem[]
  missionBannerUrl: string | null
  badgeUrl: string | null
  campaigns: Campaign[]
}

export default function LandingContent({ catalog, missionBannerUrl, badgeUrl, campaigns }: LandingContentProps) {
  const t = useT()
  const badgeSrc = badgeUrl || '/badge.jpeg'

  // ─── Shared layout elements ───────────────────────────────────

  const accentBar = (
    <div
      className="h-[3px] w-full flex-shrink-0"
      style={{ background: 'linear-gradient(90deg, #00352F 0%, #CEDC00 60%, #00352F 100%)' }}
    />
  )

  const header = (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderBottomColor: 'rgba(0,0,0,0.05)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden p-0.5">
            <Image src="/logo.png" alt="LIH" width={32} height={32} className="object-contain" />
          </div>
          <div>
            <p className="font-semibold leading-none" style={{ color: '#00352F', fontSize: '13px' }}>
              <span className="hidden sm:inline">{t('common', 'orgName')}</span>
              <span className="sm:hidden">LIH Foundation</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <Link
            href="/admin/login"
            className={buttonVariants({ variant: 'outline', size: 'sm', className: 'text-xs border-gray-200 text-gray-500 hover:text-[#00352F] hover:border-[#00352F] hover:bg-[#E5F2F0] transition-all duration-200 rounded-lg h-8' })}
          >
            {t('common', 'adminLogin')}
          </Link>
        </div>
      </div>
    </header>
  )

  const footer = (
    <footer
      className="relative py-7 px-4 sm:px-6 overflow-hidden"
      style={{
        backgroundImage: 'url(/ellipsis-bg.jpeg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: 'rgba(4,12,20,0.62)' }} />
      <div className="relative max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Image
            src="/ellipsis-cl.png"
            alt="Ellipsis Technology Consultants"
            width={140}
            height={60}
            className="object-contain"
            style={{ maxHeight: 44, width: 'auto', filter: 'invert(1) hue-rotate(170deg)', mixBlendMode: 'screen' }}
          />
        </div>
        <div className="flex flex-col items-center sm:items-end gap-0.5">
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>
            &copy; 2025 Copyright Ellipsis. All Rights Reserved.
          </p>
          <p style={{ fontSize: '10px', color: 'rgba(28,200,212,0.65)', fontStyle: 'italic' }}>
            Driven by innovation. Defined by trust. Delivered with precision.
          </p>
        </div>
      </div>
    </footer>
  )

  // ─── Campaign selector view ───────────────────────────────────
  // Shown when any campaign is active — replaces the full landing page.

  if (campaigns.length > 0) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F4F0' }}>
        {accentBar}
        {header}

        <main className="flex-1 py-14 sm:py-20 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">

            {/* Title */}
            <div className="text-center mb-10">
              <h1 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                {t('landing', 'chooseCampaign')}
              </h1>
              <p className="text-gray-500" style={{ fontSize: '15px' }}>
                {t('landing', 'chooseCampaignSub')}
              </p>
            </div>

            {/* Campaign cards */}
            <div className={`grid gap-5 sm:gap-6 ${campaigns.length === 1 ? 'max-w-md mx-auto' : 'grid-cols-1 md:grid-cols-2'}`}>
              {campaigns.map(campaign => {
                const href = campaign.slug ? `/campaign/${campaign.slug}` : '/order'
                return (
                  <div
                    key={campaign.id}
                    className="bg-white rounded-2xl border-2 overflow-hidden transition-all duration-200 hover:border-[#00352F]/40 hover:shadow-lg group"
                    style={{ borderColor: 'rgba(206,220,0,0.4)' }}
                  >
                    {/* Banner — shown in full (no cropping) at its natural aspect ratio */}
                    {campaign.banner_url ? (
                      <div className="w-full overflow-hidden bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={campaign.banner_url}
                          alt={campaign.name}
                          className="w-full h-auto block transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-full h-2"
                        style={{ background: 'linear-gradient(90deg, #00352F 0%, #CEDC00 100%)' }}
                      />
                    )}

                    {/* Body */}
                    <div className="p-5">
                      <div className="flex items-start gap-3 mb-4">
                        {campaign.badge_url && (
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0 shadow-sm">
                            <Image src={campaign.badge_url} alt={campaign.name} fill className="object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h2 className="font-heading font-bold text-gray-900 text-lg leading-tight">{campaign.name}</h2>
                          {campaign.description && (
                            <p className="text-gray-500 text-sm mt-1 leading-snug line-clamp-2">{campaign.description}</p>
                          )}
                          {(campaign.start_date || campaign.end_date) && (
                            <p className="text-xs mt-1.5 font-medium" style={{ color: '#00352F' }}>
                              {campaign.start_date && campaign.end_date
                                ? `${campaign.start_date} – ${campaign.end_date}`
                                : campaign.end_date
                                  ? `${t('landing', 'ends')} ${campaign.end_date}`
                                  : `${t('landing', 'from')} ${campaign.start_date}`}
                            </p>
                          )}
                        </div>
                      </div>

                      <Link
                        href={href}
                        className={buttonVariants({ size: 'sm', className: 'w-full text-white font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 btn-brand-shadow' })}
                        style={{ backgroundColor: '#00352F' }}
                      >
                        {t('landing', 'orderNow')} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </main>

        {footer}
      </div>
    )
  }

  // ─── Full landing page (no active campaigns) ──────────────────

  const primaryOrderHref = '/order'

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F4F0' }}>

      {accentBar}
      {header}

      <main className="flex-1">

        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="relative py-12 sm:py-20 lg:py-28 px-4 sm:px-6 overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                radial-gradient(ellipse 60% 80% at 90% 10%, rgba(206,220,0,0.14) 0%, transparent 60%),
                radial-gradient(ellipse 50% 60% at 5% 90%, rgba(0,53,47,0.08) 0%, transparent 55%),
                linear-gradient(160deg, #E5F2F0 0%, #daecea 55%, #e5f2f0 100%)
              `,
            }}
          />

          <div className="max-w-5xl mx-auto relative">
            <div className="flex flex-col-reverse lg:flex-row items-center gap-10 lg:gap-20">

              <div className="flex-1 text-center lg:text-left w-full">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-5"
                  style={{
                    border: '1px solid rgba(206,220,0,0.5)',
                    backgroundColor: 'rgba(255,255,255,0.75)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#CEDC00' }} />
                  <span className="font-bold uppercase tracking-wider" style={{ color: '#00352F', fontSize: '10px' }}>
                    {t('landing', 'heroTag')}
                  </span>
                </div>

                <h1
                  className="font-heading font-bold leading-[1.1] mb-5"
                  style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: '#111827' }}
                >
                  {t('landing', 'heroTitle').split('Institution').length > 1 ? (
                    <>
                      {t('landing', 'heroTitle').split('Institution')[0]}
                      <span style={{ color: '#00352F' }}>Institution</span>
                      {t('landing', 'heroTitle').split('Institution')[1]}
                    </>
                  ) : (
                    t('landing', 'heroTitle')
                  )}
                </h1>

                <p className="text-gray-600 mb-7 leading-relaxed mx-auto lg:mx-0" style={{ maxWidth: '420px', fontSize: '15px' }}>
                  {t('landing', 'heroSubtitle')}
                </p>

                <Link
                  href={primaryOrderHref}
                  className={buttonVariants({ size: 'lg', className: 'w-full sm:w-auto text-white h-12 px-8 text-base font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 btn-brand-shadow' })}
                  style={{ backgroundColor: '#00352F' }}
                >
                  {t('landing', 'placeAnOrder')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>

                <p className="mt-4 flex items-center justify-center lg:justify-start gap-1.5 text-gray-400" style={{ fontSize: '11px' }}>
                  <Shield className="w-3 h-3 flex-shrink-0" style={{ color: '#CEDC00' }} />
                  {t('landing', 'securePayment')}
                </p>
              </div>

              <div className="flex-shrink-0 flex items-center justify-center">
                <div className="relative">
                  <div
                    className="absolute rounded-full border-2 border-dashed pointer-events-none"
                    style={{ inset: '-18px', borderColor: 'rgba(206,220,0,0.38)' }}
                  />
                  <div
                    className="absolute inset-[-4px] rounded-full pointer-events-none"
                    style={{ boxShadow: '0 0 48px 16px rgba(206,220,0,0.15)' }}
                  />
                  <div
                    className="relative rounded-full overflow-hidden border-[5px] border-white"
                    style={{
                      width: 'clamp(170px, 28vw, 288px)',
                      height: 'clamp(170px, 28vw, 288px)',
                      boxShadow: '0 24px 64px rgba(0,53,47,0.22)',
                    }}
                  >
                    <Image
                      src={badgeSrc}
                      alt="Que Nadie en PR Envejezca Solo — Living in Harmony Foundation"
                      fill
                      className="object-contain"
                      priority
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Trust Strip ─────────────────────────────────────── */}
        <section className="py-4 bg-white border-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2.5">
              {[
                { icon: Shield,      key: 'securePaypalPayments' },
                { icon: CheckCircle, key: 'instantConfirmation' },
                { icon: FileText,    key: 'orderTracking' },
                { icon: CreditCard,  key: 'multiplePayment' },
              ].map(({ icon: Icon, key }) => (
                <div key={key} className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#00352F' }} />
                  <span className="text-gray-500 font-medium whitespace-nowrap" style={{ fontSize: '11px' }}>{t('landing', key)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Mission ─────────────────────────────────────────── */}
        {missionBannerUrl ? (
          <section className="w-full">
            <Image
              src={missionBannerUrl}
              alt="Living in Harmony Foundation — Mission Banner"
              width={0}
              height={0}
              sizes="100vw"
              className="w-full h-auto block"
              priority
            />
          </section>
        ) : (
          <section
            className="relative py-16 sm:py-20 px-4 sm:px-6 overflow-hidden"
            style={{ backgroundColor: '#00352F' }}
          >
            <div
              className="absolute right-[-10%] top-[-40%] w-[500px] h-[500px] rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(206,220,0,0.1) 0%, transparent 65%)' }}
            />
            <div
              className="absolute left-[-8%] bottom-[-30%] w-[340px] h-[340px] rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(206,220,0,0.07) 0%, transparent 65%)' }}
            />
            <div className="max-w-3xl mx-auto text-center relative">
              <div className="flex justify-center mb-5">
                <div
                  className="w-14 h-14 rounded-2xl overflow-hidden border-2"
                  style={{ borderColor: 'rgba(255,255,255,0.18)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                >
                  <Image src="/logo-full.jpeg" alt="Living in Harmony Foundation" width={56} height={56} className="object-cover w-full h-full" />
                </div>
              </div>
              <p className="font-bold uppercase tracking-[0.25em] mb-3" style={{ color: '#CEDC00', fontSize: '11px' }}>
                {t('landing', 'ourMission')}
              </p>
              <h2 className="font-heading text-white font-bold italic leading-snug mb-4" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.6rem)' }}>
                &ldquo;Que Nadie en PR Envejezca Solo&rdquo;
              </h2>
              <div className="w-10 h-0.5 mx-auto mb-5" style={{ backgroundColor: '#CEDC00' }} />
              <p className="leading-relaxed mx-auto" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '480px', fontSize: '14px' }}>
                {t('landing', 'missionSub')}
              </p>
            </div>
          </section>
        )}

        {/* ── Shirt Catalog ───────────────────────────────────── */}
        {catalog.length > 0 && (
          <section className="py-16 sm:py-20 px-4 sm:px-6 bg-white">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-10 sm:mb-12">
                <div
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 mb-4 font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: '#E5F2F0',
                    color: '#00352F',
                    border: '1px solid rgba(206,220,0,0.35)',
                    fontSize: '10px',
                  }}
                >
                  {t('landing', 'availableStyles')}
                </div>
                <h2 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900">{t('landing', 'ourShirts')}</h2>
                <p className="text-gray-500 mt-3 mx-auto leading-relaxed" style={{ maxWidth: '380px', fontSize: '14px' }}>
                  {t('landing', 'shirtDesc')}
                </p>
              </div>

              <div className={`grid gap-4 sm:gap-6 ${
                catalog.length === 1 ? 'max-w-xs mx-auto' :
                catalog.length === 2 ? 'grid-cols-2 max-w-xl mx-auto' :
                catalog.length === 3 ? 'grid-cols-2 sm:grid-cols-3 max-w-4xl mx-auto' :
                'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
              }`}>
                {catalog.map(item => (
                  <div key={item.id} className="group">
                    <div className="mb-3 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-[#00352F]/10 rounded-2xl">
                      <ShirtViewer
                        frontUrl={item.image_url}
                        backUrl={item.back_image_url ?? null}
                        name={item.name}
                      />
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{item.description}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="text-center mt-12">
                <Link
                  href={primaryOrderHref}
                  className={buttonVariants({ size: 'lg', className: 'w-full sm:w-auto text-white px-10 h-12 text-base font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 btn-brand-shadow' })}
                  style={{ backgroundColor: '#00352F' }}
                >
                  {t('landing', 'orderNow')} <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── Who Can Order ───────────────────────────────────── */}
        <section style={{ backgroundColor: '#F5F4F0' }} className="py-16 sm:py-20 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-gray-900">{t('landing', 'whoCanOrder')}</h2>
              <p className="text-gray-500 mt-2" style={{ fontSize: '14px' }}>{t('landing', 'whoSub')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {[
                { icon: School,    titleKey: 'schools',        descKey: 'schoolsSub' },
                { icon: Building2, titleKey: 'government',     descKey: 'governmentSub' },
                { icon: User,      titleKey: 'personal',       descKey: 'personalSub' },
                { icon: Briefcase, titleKey: 'privateCompany', descKey: 'privateCompanySub' },
              ].map(({ icon: Icon, titleKey, descKey }) => (
                <div
                  key={titleKey}
                  className="flex items-start gap-4 p-5 rounded-2xl bg-white shadow-sm transition-all duration-200 hover:shadow-md border-l-[3px]"
                  style={{ borderLeftColor: '#CEDC00' }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#E5F2F0' }}
                  >
                    <Icon className="w-5 h-5" style={{ color: '#00352F' }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-0.5" style={{ fontSize: '14px' }}>{t('landing', titleKey)}</h3>
                    <p className="text-gray-500 leading-relaxed" style={{ fontSize: '13px' }}>{t('landing', descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works — Timeline ─────────────────────────── */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 bg-white">
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-gray-900">{t('landing', 'howItWorks')}</h2>
              <p className="text-gray-500 mt-2" style={{ fontSize: '14px' }}>{t('landing', 'howSub')}</p>
            </div>
            <div className="relative">
              <div
                className="absolute top-5 bottom-5 w-px"
                style={{ left: '19px', background: 'linear-gradient(to bottom, #00352F 0%, #CEDC00 100%)' }}
              />
              <div className="space-y-3">
                {[
                  { n: '1', titleKey: 'step1Title', descKey: 'step1Desc' },
                  { n: '2', titleKey: 'step2Title', descKey: 'step2Desc' },
                  { n: '3', titleKey: 'step3Title', descKey: 'step3Desc' },
                ].map(({ n, titleKey, descKey }) => (
                  <div key={n} className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-heading font-bold relative z-10 shadow-md"
                      style={{ backgroundColor: '#00352F', fontSize: '14px' }}
                    >
                      {n}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="bg-white border rounded-2xl p-4 shadow-sm" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-gray-900" style={{ fontSize: '14px' }}>{t('landing', titleKey)}</h3>
                            <p className="text-gray-500 mt-0.5 leading-relaxed" style={{ fontSize: '13px' }}>{t('landing', descKey)}</p>
                          </div>
                          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#00352F' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────── */}
        <section
          className="relative py-16 sm:py-20 px-4 sm:px-6 overflow-hidden"
          style={{ backgroundColor: '#00352F' }}
        >
          <div
            className="absolute top-[-20%] right-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(206,220,0,0.12) 0%, transparent 65%)' }}
          />
          <div className="max-w-2xl mx-auto text-center relative">
            <div className="flex justify-center mb-6">
              <div
                className="relative w-16 h-16 rounded-full overflow-hidden border-2"
                style={{ borderColor: 'rgba(255,255,255,0.2)' }}
              >
                <Image src={badgeSrc} alt="LIH Badge" fill className="object-contain" />
              </div>
            </div>
            <h2 className="font-heading text-white font-bold leading-snug mb-4" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)' }}>
              {t('landing', 'readyTitle')}
            </h2>
            <p className="mb-8 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px' }}>
              {t('landing', 'readySub')}
            </p>
            <Link
              href={primaryOrderHref}
              className={buttonVariants({ size: 'lg', className: 'w-full sm:w-auto h-12 px-10 text-base font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5' })}
              style={{ backgroundColor: 'white', color: '#00352F', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}
            >
              {t('landing', 'orderYourShirts')}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </section>

      </main>

      {footer}
    </div>
  )
}
