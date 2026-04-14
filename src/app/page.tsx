import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  School, Building2, User, Briefcase,
  CheckCircle, Shield, CreditCard, FileText, ShoppingBag, ArrowRight,
} from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import type { ShirtCatalogItem } from '@/types'

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

export default async function LandingPage() {
  const catalog = await getCatalog()

  const features = [
    { icon: ShoppingBag, title: 'Easy Ordering',  desc: 'Simple form for placing shirt orders' },
    { icon: CreditCard,  title: 'Secure Payment', desc: 'Pay safely with Stripe-powered checkout' },
    { icon: FileText,    title: 'Order Tracking', desc: 'Get a confirmation with your order number' },
    { icon: Shield,      title: 'Safe & Secure',  desc: 'Your data is protected and private' },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F4F0' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          backgroundColor: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottomColor: 'rgba(0,0,0,0.06)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden p-0.5">
              <Image src="/logo.png" alt="LIH" width={32} height={32} className="object-contain" />
            </div>
            <div>
              <p className="font-semibold text-[13px] leading-none" style={{ color: '#1B4D2E' }}>
                Living in Harmony Foundation
              </p>
              <p className="text-gray-400 text-[11px] mt-0.5">Shirt Order Manager</p>
            </div>
          </div>
          <Link href="/admin/login">
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-gray-200 text-gray-500 hover:text-[#1B4D2E] hover:border-[#1B4D2E] hover:bg-[#EFF8E8] transition-all duration-200"
            >
              Admin Login
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="relative py-20 sm:py-28 px-4 sm:px-6 overflow-hidden">
          {/* Layered gradient background */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 130% 100% at 5% 0%, #EFF8E8 0%, #d4edda 50%, #eaf4ea 100%)',
            }}
          />
          {/* Decorative blobs */}
          <div
            className="absolute top-[-15%] right-[-8%] w-[520px] h-[520px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(141,198,63,0.13) 0%, transparent 70%)' }}
          />
          <div
            className="absolute bottom-[-15%] left-[-5%] w-[380px] h-[380px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(27,77,46,0.07) 0%, transparent 70%)' }}
          />

          <div className="max-w-5xl mx-auto relative">
            <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20">

              {/* Text */}
              <div className="flex-1 text-center lg:text-left">
                {/* Pill badge */}
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-6 border"
                  style={{
                    borderColor: 'rgba(141,198,63,0.45)',
                    backgroundColor: 'rgba(255,255,255,0.65)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: '#8DC63F' }}
                  />
                  <span className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: '#1B4D2E' }}>
                    Official Order Portal
                  </span>
                </div>

                <h1
                  className="font-heading text-[2.6rem] sm:text-5xl lg:text-[3.4rem] font-bold leading-[1.08] mb-5"
                  style={{ color: '#111827' }}
                >
                  Order Your<br />
                  <span style={{ color: '#1B4D2E' }}>Institution</span><br />
                  Shirts
                </h1>

                <p className="text-base sm:text-lg text-gray-600 mb-8 max-w-md mx-auto lg:mx-0 leading-relaxed">
                  Place your shirt order online in minutes. Secure payment, instant confirmation,
                  and easy tracking for schools, government agencies, companies, and individuals.
                </p>

                <Link href="/order">
                  <Button
                    size="lg"
                    className="text-white px-8 h-12 text-base font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 btn-brand-shadow"
                    style={{ backgroundColor: '#1B4D2E' }}
                  >
                    Place an Order
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>

              {/* Badge image */}
              <div className="flex-shrink-0">
                <div className="relative">
                  {/* Outer dashed ring */}
                  <div
                    className="absolute rounded-full border-2 border-dashed pointer-events-none"
                    style={{
                      inset: '-18px',
                      borderColor: 'rgba(141,198,63,0.35)',
                    }}
                  />
                  {/* Soft glow behind */}
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      boxShadow: '0 0 60px 20px rgba(141,198,63,0.15)',
                    }}
                  />
                  {/* Main circle */}
                  <div
                    className="relative w-56 h-56 sm:w-64 sm:h-64 md:w-[280px] md:h-[280px] rounded-full overflow-hidden border-[5px] border-white"
                    style={{
                      boxShadow: '0 24px 64px rgba(27,77,46,0.22), 0 0 0 10px rgba(141,198,63,0.12)',
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

        {/* ── Mission Banner ──────────────────────────────────── */}
        <section style={{ backgroundColor: '#1B4D2E' }} className="py-14 sm:py-16 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex justify-center mb-6">
              <div
                className="w-16 h-16 rounded-2xl overflow-hidden border-2 flex-shrink-0"
                style={{ borderColor: 'rgba(255,255,255,0.2)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
              >
                <Image
                  src="/logo-full.jpeg"
                  alt="Living in Harmony Foundation"
                  width={64}
                  height={64}
                  className="object-cover w-full h-full"
                />
              </div>
            </div>
            <p
              className="text-[11px] font-bold uppercase tracking-[0.22em] mb-4"
              style={{ color: '#8DC63F' }}
            >
              Our Mission
            </p>
            <h2 className="font-heading text-white text-2xl sm:text-3xl md:text-4xl font-bold italic leading-snug mb-4">
              &ldquo;Que Nadie en PR Envejezca Solo&rdquo;
            </h2>
            <p className="text-sm sm:text-base leading-relaxed max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Únete a la lucha contra la soledad NO Deseada — Every shirt purchased supports
              Living in Harmony Foundation&rsquo;s mission to end unwanted loneliness in Puerto Rico.
            </p>
          </div>
        </section>

        {/* ── Shirt Catalog ───────────────────────────────────── */}
        {catalog.length > 0 && (
          <section className="py-20 px-4 sm:px-6 bg-white">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <div
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-4 text-[11px] font-semibold uppercase tracking-wider border"
                  style={{ borderColor: 'rgba(141,198,63,0.4)', backgroundColor: '#EFF8E8', color: '#1B4D2E' }}
                >
                  Available Styles
                </div>
                <h2 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900">Our Shirts</h2>
                <p className="text-gray-500 mt-3 max-w-md mx-auto text-sm leading-relaxed">
                  Choose from our selection of quality shirts available for your institution.
                </p>
              </div>

              <div
                className={`grid gap-6 ${
                  catalog.length === 1 ? 'max-w-xs mx-auto' :
                  catalog.length === 2 ? 'sm:grid-cols-2 max-w-2xl mx-auto' :
                  catalog.length === 3 ? 'sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto' :
                  'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                }`}
              >
                {catalog.map(item => (
                  <div key={item.id} className="group">
                    <div
                      className="relative aspect-square rounded-2xl overflow-hidden mb-4 transition-all duration-300"
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
                          <ShoppingBag className="w-16 h-16" style={{ color: 'rgba(141,198,63,0.4)' }} />
                        </div>
                      )}
                      {/* Hover overlay */}
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{ background: 'linear-gradient(to top, rgba(27,77,46,0.08) 0%, transparent 60%)' }}
                      />
                    </div>
                    <div className="px-1">
                      <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
                      {item.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center mt-14">
                <Link href="/order">
                  <Button
                    size="lg"
                    className="text-white px-10 h-12 text-base font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 btn-brand-shadow"
                    style={{ backgroundColor: '#1B4D2E' }}
                  >
                    Order Now
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── Who Can Order ───────────────────────────────────── */}
        <section style={{ backgroundColor: '#F5F4F0' }} className="py-20 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-gray-900">Who Can Order?</h2>
              <p className="text-gray-500 mt-2 text-sm">Open to institutions and individuals across Puerto Rico</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: School,    title: 'Schools',                  desc: 'Students, teachers, and staff. Include grade and classroom details.' },
                { icon: Building2, title: 'Government Organizations', desc: 'Government agencies, departments, and offices.' },
                { icon: User,      title: 'Personal Orders',           desc: 'Individuals ordering for personal use. Delivery address collected at checkout.' },
                { icon: Briefcase, title: 'Private Companies',         desc: 'Businesses and private organizations. Include company and department details.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-transparent shadow-sm transition-all duration-200 hover:shadow-md hover:border-[#8DC63F]/25"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#EFF8E8' }}
                  >
                    <Icon className="w-5 h-5" style={{ color: '#1B4D2E' }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm mb-0.5">{title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────── */}
        <section className="py-20 px-4 sm:px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-gray-900">Why Order With Us?</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {features.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="text-center">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: '#EFF8E8' }}
                  >
                    <Icon className="w-5 h-5" style={{ color: '#1B4D2E' }} />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1.5 text-sm">{title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Steps ───────────────────────────────────────────── */}
        <section style={{ backgroundColor: '#F5F4F0' }} className="py-20 px-4 sm:px-6">
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-gray-900">3 Simple Steps</h2>
              <p className="text-gray-500 mt-2 text-sm">Ordering takes just a few minutes</p>
            </div>
            <div className="space-y-3">
              {[
                { step: '01', title: 'Fill Out the Form',  desc: 'Enter your details and shirt preferences' },
                { step: '02', title: 'Review & Pay',       desc: 'Review your order summary and pay securely' },
                { step: '03', title: 'Get Confirmation',   desc: 'Receive your order confirmation instantly' },
              ].map(({ step, title, desc }) => (
                <div
                  key={step}
                  className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-transparent shadow-sm"
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-heading font-bold text-sm"
                    style={{ backgroundColor: '#1B4D2E' }}
                  >
                    {step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
                    <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
                  </div>
                  <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#8DC63F' }} />
                </div>
              ))}
            </div>
            <div className="text-center mt-10">
              <Link href="/order">
                <Button
                  size="lg"
                  className="text-white px-10 h-12 font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 btn-brand-shadow"
                  style={{ backgroundColor: '#1B4D2E' }}
                >
                  Start Your Order
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t bg-white py-8 px-4 sm:px-6" style={{ borderTopColor: 'rgba(0,0,0,0.06)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="relative w-10 h-10 flex-shrink-0 rounded-full overflow-hidden border-2"
                style={{ borderColor: 'rgba(27,77,46,0.15)' }}
              >
                <Image
                  src="/badge.jpeg"
                  alt="Living in Harmony Foundation"
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1B4D2E' }}>
                  Living in Harmony Foundation
                </p>
                <p className="text-xs text-gray-400 italic mt-0.5">
                  Únete a la lucha contra la soledad NO Deseada
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              &copy; {new Date().getFullYear()} Living in Harmony Foundation. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
