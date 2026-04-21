'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'
import LanguageSelector from '@/components/shared/LanguageSelector'
import { useT } from '@/contexts/LanguageContext'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteError = searchParams.get('error') === 'invite_expired'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const t = useT()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message || 'Invalid email or password')
      setLoading(false)
      return
    }
    router.push('/admin/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleLogin} className="space-y-5">
      {inviteError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t('admin', 'inviteExpired')}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-medium text-gray-700">{t('admin', 'emailLabel')}</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="admin@example.com"
          required
          autoComplete="email"
          className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-[#00352F] transition-colors"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-sm font-medium text-gray-700">{t('admin', 'passwordLabel')}</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
          className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-[#00352F] transition-colors"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 text-white font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 btn-brand-shadow mt-1"
        style={{ backgroundColor: '#00352F' }}
      >
        {loading
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('admin', 'signingIn')}</>
          : t('admin', 'signIn')}
      </Button>
    </form>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginContent />
    </Suspense>
  )
}

function AdminLoginContent() {
  const t = useT()
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Left brand panel — desktop only ────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-10"
        style={{ backgroundColor: '#00352F' }}
      >
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm mb-14 transition-colors"
            style={{ color: 'rgba(206,220,0,0.6)' }}
          >
            <ArrowLeft className="w-4 h-4" /> {t('admin', 'backToHome')}
          </Link>

          <div className="flex items-center gap-3 mb-10">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center p-1.5"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            >
              <Image src="/logo.png" alt="LIH" width={36} height={36} className="object-contain" />
            </div>
            <div>
              <p className="font-semibold text-white leading-none" style={{ fontSize: '13px' }}>Living in Harmony</p>
              <p style={{ color: '#CEDC00', fontSize: '12px' }} className="mt-0.5">Foundation</p>
            </div>
          </div>

          <h2 className="font-heading text-white text-3xl font-bold leading-tight mb-4">
            Admin<br />Dashboard
          </h2>
          <p className="leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', maxWidth: '260px' }}>
            Manage orders, track deliveries, and oversee the shirt order program from one place.
          </p>
        </div>

        <div
          className="flex items-center gap-4 pt-6 border-t"
          style={{ borderTopColor: 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="relative w-12 h-12 flex-shrink-0 rounded-full overflow-hidden border-2"
            style={{ borderColor: 'rgba(255,255,255,0.2)' }}
          >
            <Image src="/badge.jpeg" alt="LIH Badge" fill className="object-contain" />
          </div>
          <p className="italic leading-snug" style={{ color: 'rgba(255,255,255,0.38)', fontSize: '12px' }}>
            &ldquo;Que Nadie en PR Envejezca Solo&rdquo;
          </p>
        </div>
      </div>

      {/* ── Right form panel ────────────────────────────────── */}
      <div className="flex-1 flex flex-col" style={{ backgroundColor: '#F5F4F0' }}>
        {/* Language toggle — top-right of form panel */}
        <div className="flex justify-end px-5 pt-4">
          <LanguageSelector />
        </div>

        {/* Mobile-only: full-width branded green top section */}
        <div
          className="lg:hidden relative overflow-hidden"
          style={{ backgroundColor: '#00352F' }}
        >
          {/* Decorative glow */}
          <div
            className="absolute right-[-20%] top-[-40%] w-64 h-64 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(206,220,0,0.1) 0%, transparent 70%)' }}
          />
          <div className="relative px-6 pt-10 pb-10 text-center">
            <div
              className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center p-2.5"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}
            >
              <Image src="/logo.png" alt="Living in Harmony Foundation" width={56} height={56} className="object-contain" />
            </div>
            <h1 className="font-heading text-white text-xl font-bold leading-tight mb-1">
              Living in Harmony Foundation
            </h1>
            <p className="font-heading italic" style={{ color: '#CEDC00', fontSize: '13px' }}>
              &ldquo;Que Nadie en PR Envejezca Solo&rdquo;
            </p>
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 flex flex-col items-center justify-start lg:justify-center px-5 py-8">
          <div className="w-full" style={{ maxWidth: '380px' }}>

            {/* Back link — mobile only, shown below the green header */}
            <div className="lg:hidden mb-5">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#00352F] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> {t('admin', 'backToHome')}
              </Link>
            </div>

            {/* Card */}
            <div
              className="bg-white rounded-2xl p-6 sm:p-7"
              style={{
                boxShadow: '0 2px 16px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.05)',
              }}
            >
              <div className="mb-6">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: '#E5F2F0' }}
                >
                  <Lock className="w-5 h-5" style={{ color: '#00352F' }} />
                </div>
                <h2 className="font-heading text-xl font-bold text-gray-900">{t('admin', 'loginTitle')}</h2>
                <p className="text-gray-500 mt-1" style={{ fontSize: '13px' }}>{t('admin', 'loginDesc')}</p>
              </div>

              <Suspense
                fallback={
                  <div className="space-y-4">
                    <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
                    <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
                    <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
                  </div>
                }
              >
                <LoginForm />
              </Suspense>
            </div>

            <p className="text-center mt-5" style={{ color: 'rgba(0,0,0,0.35)', fontSize: '11px' }}>
              {t('admin', 'adminOnly')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
