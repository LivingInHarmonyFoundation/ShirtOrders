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

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteError = searchParams.get('error') === 'invite_expired'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

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
          Your invite link has expired or is invalid. Please ask to be re-invited.
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="admin@example.com"
          required
          autoComplete="email"
          className="h-11 rounded-xl border-gray-200 bg-white focus:border-[#1B4D2E] focus:ring-[#1B4D2E]/20"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
          className="h-11 rounded-xl border-gray-200 bg-white focus:border-[#1B4D2E] focus:ring-[#1B4D2E]/20"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 text-white font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 btn-brand-shadow mt-2"
        style={{ backgroundColor: '#1B4D2E' }}
      >
        {loading
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing in...</>
          : 'Sign In'}
      </Button>
    </form>
  )
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#F5F4F0' }}>

      {/* ── Left brand panel (desktop only) ────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-10"
        style={{ backgroundColor: '#0D2E1A' }}
      >
        {/* Top: logo */}
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-green-400/70 hover:text-green-300 transition-colors text-sm mb-16">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center p-1.5">
              <Image src="/logo.png" alt="LIH" width={40} height={40} className="object-contain" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm leading-none">Living in Harmony</p>
              <p className="text-green-400 text-xs mt-0.5">Foundation</p>
            </div>
          </div>
          <h2 className="font-heading text-white text-3xl font-bold leading-snug mb-4">
            Admin<br />Dashboard
          </h2>
          <p className="text-white/50 text-sm leading-relaxed max-w-[280px]">
            Manage orders, track deliveries, and oversee your shirt order program from one place.
          </p>
        </div>

        {/* Bottom: badge + mission */}
        <div className="flex items-center gap-4 pt-8 border-t border-white/10">
          <div className="relative w-14 h-14 flex-shrink-0 rounded-full overflow-hidden border-2 border-white/20">
            <Image src="/badge.jpeg" alt="LIH Badge" fill className="object-contain" />
          </div>
          <p className="text-white/40 text-xs italic leading-relaxed">
            &ldquo;Que Nadie en PR Envejezca Solo&rdquo;
          </p>
        </div>
      </div>

      {/* ── Right form panel ────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 min-h-screen">
        <div className="w-full max-w-sm">

          {/* Mobile: back link + brand */}
          <div className="lg:hidden mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1B4D2E] transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" /> Back to home
            </Link>
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center p-2 shadow-md border border-gray-100">
                <Image src="/logo.png" alt="Living in Harmony Foundation" width={52} height={52} className="object-contain" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-[#1B4D2E] text-sm leading-tight">Living in Harmony Foundation</p>
                <p className="text-gray-400 text-xs mt-0.5">Shirt Order Manager</p>
              </div>
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            {/* Header */}
            <div className="mb-6">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: '#EFF8E8' }}
              >
                <Lock className="w-5 h-5" style={{ color: '#1B4D2E' }} />
              </div>
              <h1 className="font-heading text-xl font-bold text-gray-900">Admin Login</h1>
              <p className="text-gray-500 text-sm mt-1">Sign in to access the dashboard</p>
            </div>

            <Suspense fallback={
              <div className="space-y-4">
                <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
                <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
                <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
              </div>
            }>
              <LoginForm />
            </Suspense>
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            Admin access only. Unauthorized access is prohibited.
          </p>
        </div>
      </div>
    </div>
  )
}
