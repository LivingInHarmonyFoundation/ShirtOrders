import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  School, Building2, User, Briefcase,
  CheckCircle, Shield, CreditCard, FileText, ShoppingBag, ArrowRight,
} from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import type { ShirtCatalogItem } from '@/types'

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

async function getMissionBannerUrl(): Promise<string | null> {
  try {
    const admin = await createAdminClient()
    const { data } = await admin
      .from('app_settings')
      .select('mission_banner_url')
      .single()
    return data?.mission_banner_url ?? null
  } catch {
    return null
  }
}

export default async function LandingPage() {
  const [catalog, missionBannerUrl] = await Promise.all([getCatalog(), getMissionBannerUrl()])

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F4F0' }}>

      {/* ── Brand accent bar ────────────────────────────────── */}
      <div
        className="h-[3px] w-full flex-shrink-0"
        style={{ background: 'linear-gradient(90deg, #1B4D2E 0%, #8DC63F 60%, #1B4D2E 100%)' }}
      />

      {/* ── Header ─────────────────────────────────────────── */}
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
              <p className="font-semibold leading-none" style={{ color: '#1B4D2E', fontSize: '13px' }}>
                <span className="hidden sm:inline">Living in Harmony Foundation</span>
                <span className="sm:hidden">LIH Foundation</span>
              </p>
              <p className="text-gray-400 mt-0.5" style={{ fontSize: '11px' }}>Shirt Order Manager</p>
            </div>
          </div>
          <Link href="/admin/login">
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-gray-200 text-gray-500 hover:text-[#1B4D2E] hover:border-[#1B4D2E] hover:bg-[#EFF8E8] transition-all duration-200 rounded-lg h-8"
            >
              Admin Login
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="relative py-12 sm:py-20 lg:py-28 px-4 sm:px-6 overflow-hidden">
          {/* Layered gradient bg */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                radial-gradient(ellipse 60% 80% at 90% 10%, rgba(141,198,63,0.14) 0%, transparent 60%),
                radial-gradient(ellipse 50% 60% at 5% 90%, rgba(27,77,46,0.08) 0%, transparent 55%),
                linear-gradient(160deg, #EFF8E8 0%, #d9efd9 55%, #e5f5e5 100%)
              `,
            }}
          />

          <div className="max-w-5xl mx-auto relative">
            {/*
              flex-col-reverse: badge appears ABOVE text on mobile
              lg:flex-row: side-by-side on desktop
            */}
            <div className="flex flex-col-reverse lg:flex-row items-center gap-10 lg:gap-20">

              {/* ── Text (below badge on mobile, left on desktop) ── */}
              <div className="flex-1 text-center lg:text-left w-full">
                {/* Pill */}
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-5"
                  style={{
                    border: '1px solid rgba(141,198,63,0.5)',
                    backgroundColor: 'rgba(255,255,255,0.75)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: '#8DC63F' }}
                  />
                  <span
                    className="font-bold uppercase tracking-wider"
                    style={{ color: '#1B4D2E', fontSize: '10px' }}
                  >
                    Official Order Portal
                  </span>
                </div>

                <h1
                  className="font-heading font-bold leading-[1.1] mb-5"
                  style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: '#111827' }}
                >
                  Order Your{' '}
                  <span style={{ color: '#1B4D2E' }}>Institution</span>{' '}
                  Shirts
                </h1>

                <p className="text-gray-600 mb-7 leading-relaxed mx-auto lg:mx-0" style={{ maxWidth: '420px', fontSize: '15px' }}>
                  Place your shirt order online in minutes — secure payment,
                  instant confirmation, and easy tracking.
                </p>

                {/* CTA — full-width on mobile */}
                <Link href="/order" className="block sm:inline-block">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto text-white h-12 px-8 text-base font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 btn-brand-shadow"
                    style={{ backgroundColor: '#1B4D2E' }}
                  >
                    Place an Order
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>

                <p className="mt-4 flex items-center justify-center lg:justify-start gap-1.5 text-gray-400" style={{ fontSize: '11px' }}>
                  <Shield className="w-3 h-3 flex-shrink-0" style={{ color: '#8DC63F' }} />
                  Secure payment · Instant confirmation · No account needed
                </p>
              </div>

              {/* ── Badge (above text on mobile, right on desktop) ── */}
              <div className="flex-shrink-0 flex items-center justify-center">
                <div className="relative">
                  {/* Dashed outer ring */}
                  <div
                    className="absolute rounded-full border-2 border-dashed pointer-events-none"
                    style={{
                      inset: '-18px',
                      borderColor: 'rgba(141,198,63,0.38)',
                    }}
                  />
                  {/* Glow */}
                  <div
                    className="absolute inset-[-4px] rounded-full pointer-events-none"
                    style={{ boxShadow: '0 0 48px 16px rgba(141,198,63,0.15)' }}
                  />
                  {/* Image */}
                  <div
                    className="relative rounded-full overflow-hidden border-[5px] border-white"
                    style={{
                      width: 'clamp(170px, 28vw, 288px)',
                      height: 'clamp(170px, 28vw, 288px)',
                      boxShadow: '0 24px 64px rgba(27,77,46,0.22)',
                    }}
                  >
                    <Image
                      src="/badge.jpeg"
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
                { icon: Shield,      label: 'Stripe-Secured Payments' },
                { icon: CheckCircle, label: 'Instant Confirmation' },
                { icon: FileText,    label: 'Order Tracking Included' },
                { icon: CreditCard,  label: 'Multiple Payment Options' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#8DC63F' }} />
                  <span className="text-gray-500 font-medium whitespace-nowrap" style={{ fontSize: '11px' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Mission ─────────────────────────────────────────── */}
        {missionBannerUrl ? (
          /* Custom banner image — natural aspect ratio, never cropped */
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
          /* Default text version */
          <section
            className="relative py-16 sm:py-20 px-4 sm:px-6 overflow-hidden"
            style={{ backgroundColor: '#1B4D2E' }}
          >
            <div
              className="absolute right-[-10%] top-[-40%] w-[500px] h-[500px] rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(141,198,63,0.1) 0%, transparent 65%)' }}
            />
            <div
              className="absolute left-[-8%] bottom-[-30%] w-[340px] h-[340px] rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(141,198,63,0.07) 0%, transparent 65%)' }}
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
              <p className="font-bold uppercase tracking-[0.25em] mb-3" style={{ color: '#8DC63F', fontSize: '11px' }}>
                Our Mission
              </p>
              <h2 className="font-heading text-white font-bold italic leading-snug mb-4" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.6rem)' }}>
                &ldquo;Que Nadie en PR Envejezca Solo&rdquo;
              </h2>
              <div className="w-10 h-0.5 mx-auto mb-5" style={{ backgroundColor: '#8DC63F' }} />
              <p className="leading-relaxed mx-auto" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '480px', fontSize: '14px' }}>
                Únete a la lucha contra la soledad NO Deseada — Every shirt purchased supports
                Living in Harmony Foundation&rsquo;s mission to end unwanted loneliness in Puerto Rico.
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
                    backgroundColor: '#EFF8E8',
                    color: '#1B4D2E',
                    border: '1px solid rgba(141,198,63,0.35)',
                    fontSize: '10px',
                  }}
                >
                  Available Styles
                </div>
                <h2 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900">Our Shirts</h2>
                <p className="text-gray-500 mt-3 mx-auto leading-relaxed" style={{ maxWidth: '380px', fontSize: '14px' }}>
                  Quality shirts representing the Living in Harmony Foundation.
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
                    <div
                      className="relative aspect-square rounded-2xl overflow-hidden mb-3 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-[#1B4D2E]/10"
                      style={{ backgroundColor: '#EFF8E8' }}
                    >
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ShoppingBag className="w-12 h-12 sm:w-16 sm:h-16" style={{ color: 'rgba(141,198,63,0.35)' }} />
                        </div>
                      )}
                      {/* Hover overlay */}
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{ background: 'linear-gradient(to top, rgba(27,77,46,0.1) 0%, transparent 60%)' }}
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
                <Link href="/order" className="block sm:inline-block">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto text-white px-10 h-12 text-base font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 btn-brand-shadow"
                    style={{ backgroundColor: '#1B4D2E' }}
                  >
                    Order Now <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── Who Can Order ───────────────────────────────────── */}
        <section style={{ backgroundColor: '#F5F4F0' }} className="py-16 sm:py-20 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-gray-900">Who Can Order?</h2>
              <p className="text-gray-500 mt-2" style={{ fontSize: '14px' }}>Open to institutions and individuals across Puerto Rico</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {[
                { icon: School,    title: 'Schools',                  desc: 'Students, teachers, and staff. Include grade and classroom details.' },
                { icon: Building2, title: 'Government Organizations', desc: 'Government agencies, departments, and offices.' },
                { icon: User,      title: 'Personal Orders',           desc: 'Individuals ordering for personal use. Delivery address at checkout.' },
                { icon: Briefcase, title: 'Private Companies',         desc: 'Businesses and private organizations. Include company and department details.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 p-5 rounded-2xl bg-white shadow-sm transition-all duration-200 hover:shadow-md border-l-[3px]"
                  style={{ borderLeftColor: '#8DC63F' }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#EFF8E8' }}
                  >
                    <Icon className="w-5 h-5" style={{ color: '#1B4D2E' }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-0.5" style={{ fontSize: '14px' }}>{title}</h3>
                    <p className="text-gray-500 leading-relaxed" style={{ fontSize: '13px' }}>{desc}</p>
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
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-gray-900">How It Works</h2>
              <p className="text-gray-500 mt-2" style={{ fontSize: '14px' }}>Order your shirts in 3 simple steps</p>
            </div>

            {/* Timeline */}
            <div className="relative">
              {/* Connecting line */}
              <div
                className="absolute top-5 bottom-5 w-px"
                style={{
                  left: '19px',
                  background: 'linear-gradient(to bottom, #1B4D2E 0%, #8DC63F 100%)',
                }}
              />

              <div className="space-y-3">
                {[
                  { n: '1', title: 'Fill Out the Form',  desc: 'Enter your institution type, contact details, and shirt preferences.' },
                  { n: '2', title: 'Review & Pay',       desc: 'Review your order summary and complete payment securely via Stripe.' },
                  { n: '3', title: 'Get Confirmation',   desc: 'Receive your order confirmation number instantly by email.' },
                ].map(({ n, title, desc }) => (
                  <div key={n} className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-heading font-bold relative z-10 shadow-md"
                      style={{ backgroundColor: '#1B4D2E', fontSize: '14px' }}
                    >
                      {n}
                    </div>
                    <div className="flex-1 pb-4">
                      <div
                        className="bg-white border rounded-2xl p-4 shadow-sm"
                        style={{ borderColor: 'rgba(0,0,0,0.06)' }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-gray-900" style={{ fontSize: '14px' }}>{title}</h3>
                            <p className="text-gray-500 mt-0.5 leading-relaxed" style={{ fontSize: '13px' }}>{desc}</p>
                          </div>
                          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#8DC63F' }} />
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
          style={{ backgroundColor: '#0D2E1A' }}
        >
          <div
            className="absolute top-[-20%] right-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(141,198,63,0.12) 0%, transparent 65%)' }}
          />
          <div className="max-w-2xl mx-auto text-center relative">
            <div className="flex justify-center mb-6">
              <div
                className="relative w-16 h-16 rounded-full overflow-hidden border-2"
                style={{ borderColor: 'rgba(255,255,255,0.2)' }}
              >
                <Image src="/badge.jpeg" alt="LIH Badge" fill className="object-contain" />
              </div>
            </div>
            <h2 className="font-heading text-white font-bold leading-snug mb-4" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)' }}>
              Ready to Place Your Order?
            </h2>
            <p className="mb-8 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px' }}>
              Takes less than 5 minutes. No account required. Instant confirmation.
            </p>
            <Link href="/order" className="block sm:inline-block">
              <Button
                size="lg"
                className="w-full sm:w-auto h-12 px-10 text-base font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  backgroundColor: 'white',
                  color: '#1B4D2E',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
                }}
              >
                Order Your Shirts
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </section>

      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer
        className="bg-white py-7 px-4 sm:px-6"
        style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="relative w-9 h-9 flex-shrink-0 rounded-full overflow-hidden border"
              style={{ borderColor: 'rgba(27,77,46,0.15)' }}
            >
              <Image src="/badge.jpeg" alt="LIH" fill className="object-contain" />
            </div>
            <div>
              <p className="font-semibold" style={{ color: '#1B4D2E', fontSize: '13px' }}>Living in Harmony Foundation</p>
              <p className="text-gray-400 italic" style={{ fontSize: '11px' }}>Únete a la lucha contra la soledad NO Deseada</p>
            </div>
          </div>
          <p className="text-gray-400" style={{ fontSize: '11px' }}>
            &copy; {new Date().getFullYear()} Living in Harmony Foundation. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
