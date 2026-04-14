'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { KeyRound, Loader2, Eye, EyeOff, CheckCircle2, Check, X } from 'lucide-react'
import Image from 'next/image'

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const rules = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'One uppercase letter (A–Z)', pass: /[A-Z]/.test(password) },
    { label: 'One number (0–9)', pass: /[0-9]/.test(password) },
  ]
  const score = rules.filter(r => r.pass).length
  const allRulesPass = score === 3
  const mismatch = confirm.length > 0 && password !== confirm
  const valid = allRulesPass && password === confirm

  const strengthColor = score === 0 ? '' : score === 1 ? 'bg-red-400' : score === 2 ? 'bg-yellow-400' : 'bg-[#CEDC00]'
  const strengthLabel = ['', 'Weak', 'Almost there', 'Strong'][score]
  const strengthTextColor = score === 1 ? 'text-red-500' : score === 2 ? 'text-yellow-600' : 'text-[#00352F]'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Failed to set password')
        return
      }
      setDone(true)
      setTimeout(() => router.push('/admin/dashboard'), 1800)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F5F4F0' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center p-2 border border-gray-100">
            <Image
              src="/logo.png"
              alt="Living in Harmony Foundation"
              width={48}
              height={48}
              className="object-contain"
            />
          </div>
        </div>

        {done ? (
          <Card>
            <CardContent className="py-12 flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 bg-[#E5F2F0] rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-[#00352F]" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Password set!</h2>
              <p className="text-gray-500 text-sm">Taking you to the dashboard...</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="text-center pb-2">
              <div className="w-10 h-10 bg-[#E5F2F0] rounded-xl flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-5 h-5 text-[#00352F]" />
              </div>
              <CardTitle className="text-xl">Create Your Password</CardTitle>
              <CardDescription>
                Choose a new password for your account. You&apos;ll use it every time you log in.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* New password */}
                <div>
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 8 chars, 1 uppercase, 1 number"
                      autoFocus
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Strength bar + checklist */}
                  {password.length > 0 && (
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-1">
                        {[1, 2, 3].map(i => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${i <= score ? strengthColor : 'bg-gray-200'}`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs font-medium ${strengthTextColor}`}>{strengthLabel}</p>
                      <div className="space-y-1">
                        {rules.map(rule => (
                          <div key={rule.label} className="flex items-center gap-2">
                            {rule.pass
                              ? <Check className="w-3.5 h-3.5 text-[#CEDC00] flex-shrink-0" />
                              : <X className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
                            <span className={`text-xs ${rule.pass ? 'text-gray-400 line-through' : 'text-gray-500'}`}>
                              {rule.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <Label htmlFor="confirm">Confirm Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="confirm"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      className={`pr-10 ${mismatch ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {mismatch && <p className="text-red-500 text-xs mt-1">Passwords do not match</p>}
                </div>

                <Button
                  type="submit"
                  disabled={!valid || submitting}
                  className="w-full text-white mt-2"
                  style={{ backgroundColor: '#00352F' }}
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Setting password...</>
                    : 'Set Password & Continue'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
