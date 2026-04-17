'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Save, Loader2, DollarSign, School, Building2, Tag, MessageSquare, User, Briefcase, ImagePlus, Upload, Trash2, CreditCard, Banknote } from 'lucide-react'
import Image from 'next/image'
import type { AppSettings } from '@/types'
import { useRole } from '@/components/admin/role-provider'

const PRESET_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

export default function SettingsPage() {
  const { permissions } = useRole()

  // ── State ──
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [appName, setAppName] = useState('')
  const [shirtPrice, setShirtPrice] = useState('')
  const [availableSizes, setAvailableSizes] = useState<string[]>([])
  const [customSizeInput, setCustomSizeInput] = useState('')
  const [schoolEnabled, setSchoolEnabled] = useState(true)
  const [govEnabled, setGovEnabled] = useState(true)
  const [personalEnabled, setPersonalEnabled] = useState(true)
  const [privateCompanyEnabled, setPrivateCompanyEnabled] = useState(true)
  const [cashEnabled, setCashEnabled] = useState(false)
  const [personalAllowedPaymentMethods, setPersonalAllowedPaymentMethods] = useState<string[] | null>(null)
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const [adminPhone, setAdminPhone] = useState('')
  const [smsNotifications, setSmsNotifications] = useState(false)

  // Image uploads
  const [missionBannerUrl, setMissionBannerUrl] = useState<string | null>(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const bannerRef = useRef<HTMLInputElement>(null)

  const [badgeUrl, setBadgeUrl] = useState<string | null>(null)
  const [uploadingBadge, setUploadingBadge] = useState(false)
  const badgeRef = useRef<HTMLInputElement>(null)

  // ── Effects ──

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(({ settings }) => {
        if (settings) {
          setSettings(settings)
          setAppName(settings.app_name || '')
          setShirtPrice(String(settings.shirt_price || '15.00'))
          setAvailableSizes(settings.available_sizes || PRESET_SIZES)
          setSchoolEnabled(settings.school_orders_enabled ?? true)
          setGovEnabled(settings.government_orders_enabled ?? true)
          setPersonalEnabled(settings.personal_orders_enabled ?? true)
          setPrivateCompanyEnabled(settings.private_company_orders_enabled ?? true)
          setCashEnabled(settings.cash_enabled ?? false)
          setPersonalAllowedPaymentMethods(settings.personal_allowed_payment_methods ?? null)
          setConfirmationMessage(settings.confirmation_message || '')
          setAdminPhone(settings.admin_phone || '')
          setSmsNotifications(settings.sms_notifications_enabled ?? false)
          setMissionBannerUrl(settings.mission_banner_url || null)
          setBadgeUrl(settings.badge_url || null)
        }
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  // ── Handlers ──

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return }
    if (bannerRef.current) bannerRef.current.value = ''

    setUploadingBanner(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const upRes = await fetch('/api/admin/catalog/upload', { method: 'POST', body: fd })
      const upJson = await upRes.json()
      if (!upRes.ok) { toast.error(upJson.error || 'Upload failed'); return }

      const patchRes = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission_banner_url: upJson.url }),
      })
      if (!patchRes.ok) { toast.error('Failed to save banner'); return }

      setMissionBannerUrl(upJson.url)
      toast.success('Mission banner updated')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setUploadingBanner(false)
    }
  }

  const handleBannerRemove = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission_banner_url: null }),
      })
      if (!res.ok) { toast.error('Failed to remove banner'); return }
      setMissionBannerUrl(null)
      toast.success('Mission banner removed — text version restored')
    } catch {
      toast.error('Something went wrong')
    }
  }

  const handleBadgeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return }
    if (badgeRef.current) badgeRef.current.value = ''

    setUploadingBadge(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const upRes = await fetch('/api/admin/catalog/upload', { method: 'POST', body: fd })
      const upJson = await upRes.json()
      if (!upRes.ok) { toast.error(upJson.error || 'Upload failed'); return }

      const patchRes = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badge_url: upJson.url }),
      })
      if (!patchRes.ok) { toast.error('Failed to save badge'); return }

      setBadgeUrl(upJson.url)
      toast.success('Badge updated')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setUploadingBadge(false)
    }
  }

  const handleBadgeRemove = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badge_url: null }),
      })
      if (!res.ok) { toast.error('Failed to remove badge'); return }
      setBadgeUrl(null)
      toast.success('Badge removed — default badge restored')
    } catch {
      toast.error('Something went wrong')
    }
  }

  const toggleSize = (size: string) => {
    setAvailableSizes(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    )
  }

  const addCustomSize = () => {
    const val = customSizeInput.trim().toUpperCase()
    if (!val || availableSizes.includes(val)) { setCustomSizeInput(''); return }
    setAvailableSizes(prev => [...prev, val])
    setCustomSizeInput('')
  }

  const handleSave = async () => {
    const price = parseFloat(shirtPrice)
    if (isNaN(price) || price <= 0) {
      toast.error('Shirt price must be a positive number')
      return
    }
    if (availableSizes.length === 0) {
      toast.error('At least one shirt size must be enabled')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_name: appName,
          shirt_price: price,
          available_sizes: availableSizes,
          school_orders_enabled: schoolEnabled,
          government_orders_enabled: govEnabled,
          personal_orders_enabled: personalEnabled,
          private_company_orders_enabled: privateCompanyEnabled,
          cash_enabled: cashEnabled,
          personal_allowed_payment_methods: personalAllowedPaymentMethods,
          confirmation_message: confirmationMessage,
          admin_phone: adminPhone || null,
          sms_notifications_enabled: smsNotifications,
        }),
      })
      if (res.ok) {
        const { settings } = await res.json()
        setSettings(settings)
        toast.success('Settings saved successfully')
      } else {
        toast.error('Failed to save settings')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-32" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Configure your order management system</p>
      </div>

      {/* App Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Tag className="w-4 h-4" /> Application
          </CardTitle>
          <CardDescription className="text-xs">General app settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="app_name">App Name</Label>
            <Input
              id="app_name"
              value={appName}
              onChange={e => setAppName(e.target.value)}
              placeholder="Institution Shirt Order Manager"
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Mission Banner ──────────────────────────────────── */}
      {permissions.canManageSettings && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ImagePlus className="w-4 h-4" /> Mission Banner
            </CardTitle>
            <CardDescription className="text-xs">
              The image displayed in the &ldquo;Our Mission&rdquo; section on the public landing page.
              When set, replaces the text version. Only admins and owners can change this.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Hidden file input */}
            <input
              ref={bannerRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleBannerUpload}
            />

            {missionBannerUrl ? (
              <>
                {/* Preview */}
                <div
                  className="relative w-full rounded-xl overflow-hidden border border-gray-100"
                  style={{ height: '180px' }}
                >
                  <Image
                    src={missionBannerUrl}
                    alt="Mission banner preview"
                    fill
                    className="object-cover"
                  />
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => bannerRef.current?.click()}
                    disabled={uploadingBanner}
                  >
                    {uploadingBanner
                      ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading…</>
                      : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Replace Image</>}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleBannerRemove}
                    disabled={uploadingBanner}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remove Banner
                  </Button>
                </div>
                <p className="text-[11px] text-gray-400">
                  Removing the banner restores the styled text version on the public page.
                </p>
              </>
            ) : (
              <>
                {/* Empty state */}
                <div
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-10 cursor-pointer hover:border-[#CEDC00]/50 hover:bg-[#E5F2F0]/30 transition-colors"
                  onClick={() => bannerRef.current?.click()}
                >
                  <ImagePlus className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-sm font-medium text-gray-500">No banner set</p>
                  <p className="text-xs text-gray-400 mt-0.5">Click to upload an image</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => bannerRef.current?.click()}
                  disabled={uploadingBanner}
                  style={{ borderColor: '#00352F', color: '#00352F' }}
                >
                  {uploadingBanner
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading…</>
                    : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Banner</>}
                </Button>
              </>
            )}

            <p className="text-[11px] text-gray-400">
              Recommended: wide image (16:4 or 16:5 ratio). Max 5 MB. JPG, PNG, or WebP.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Badge Image ─────────────────────────────────── */}
      {permissions.canManageSettings && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ImagePlus className="w-4 h-4" /> Badge Image
            </CardTitle>
            <CardDescription className="text-xs">
              The circular badge displayed in the hero, CTA, and footer of the public landing page.
              When set, replaces the default badge everywhere it appears.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={badgeRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleBadgeUpload}
            />

            {badgeUrl ? (
              <>
                {/* Preview — circular to match how it appears on the site */}
                <div className="flex items-center gap-5">
                  <div
                    className="relative rounded-full overflow-hidden border-4 border-white flex-shrink-0"
                    style={{ width: 120, height: 120, boxShadow: '0 4px 24px rgba(0,53,47,0.18)' }}
                  >
                    <Image src={badgeUrl} alt="Badge preview" fill className="object-contain" />
                  </div>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>Shown as a circle on the landing page.</p>
                    <p>Use a square image for best results.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => badgeRef.current?.click()}
                    disabled={uploadingBadge}
                  >
                    {uploadingBadge
                      ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading…</>
                      : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Replace Badge</>}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleBadgeRemove}
                    disabled={uploadingBadge}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remove Badge
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-10 cursor-pointer hover:border-[#CEDC00]/50 hover:bg-[#E5F2F0]/30 transition-colors"
                  onClick={() => badgeRef.current?.click()}
                >
                  <ImagePlus className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-sm font-medium text-gray-500">No custom badge set</p>
                  <p className="text-xs text-gray-400 mt-0.5">Click to upload an image</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => badgeRef.current?.click()}
                  disabled={uploadingBadge}
                  style={{ borderColor: '#00352F', color: '#00352F' }}
                >
                  {uploadingBadge
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading…</>
                    : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Badge</>}
                </Button>
              </>
            )}

            <p className="text-[11px] text-gray-400">
              Recommended: square image (1:1 ratio). Max 5 MB. JPG, PNG, or WebP.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pricing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Pricing
          </CardTitle>
          <CardDescription className="text-xs">Set the shirt price and available sizes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="shirt_price">Price Per Shirt (USD)</Label>
            <div className="relative mt-1 max-w-[160px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <Input
                id="shirt_price"
                type="number"
                min="0.01"
                step="0.01"
                value={shirtPrice}
                onChange={e => setShirtPrice(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>
          <Separator />
          <div>
            <Label>Available Shirt Sizes</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-2">Toggle sizes on/off, or add custom sizes (e.g. "Youth M", "2XL")</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_SIZES.map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => toggleSize(size)}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    availableSizes.includes(size)
                      ? 'border-[#00352F] bg-[#E5F2F0] text-[#00352F] dark:bg-[#00352F]/20 dark:text-green-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {size}
                </button>
              ))}
              {/* Custom sizes (non-preset) */}
              {availableSizes.filter(s => !PRESET_SIZES.includes(s)).map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => toggleSize(size)}
                  className="px-4 py-2 rounded-lg border-2 border-[#CEDC00] bg-[#CEDC00]/10 text-[#00352F] text-sm font-medium transition-all flex items-center gap-1.5"
                  title="Click to remove custom size"
                >
                  {size}
                  <span className="text-xs text-[#00352F]/50 hover:text-red-500">×</span>
                </button>
              ))}
            </div>
            {/* Add custom size */}
            <div className="flex gap-2 max-w-xs">
              <Input
                placeholder="Custom size, e.g. Youth M"
                value={customSizeInput}
                onChange={e => setCustomSizeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSize() } }}
                className="h-9 text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addCustomSize}
                disabled={!customSizeInput.trim()}
                className="h-9 px-3"
              >
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Institution types */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <School className="w-4 h-4" /> Institution Types
          </CardTitle>
          <CardDescription className="text-xs">Enable or disable institution order types</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <School className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">School Orders</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Allow schools to place orders</p>
              </div>
            </div>
            <Switch checked={schoolEnabled} onCheckedChange={setSchoolEnabled} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Government Orders</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Allow government organizations to place orders</p>
              </div>
            </div>
            <Switch checked={govEnabled} onCheckedChange={setGovEnabled} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Personal Orders</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Allow individuals to place personal orders</p>
              </div>
            </div>
            <Switch checked={personalEnabled} onCheckedChange={setPersonalEnabled} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Briefcase className="w-4 h-4 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Private Company Orders</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Allow private companies to place orders</p>
              </div>
            </div>
            <Switch checked={privateCompanyEnabled} onCheckedChange={setPrivateCompanyEnabled} />
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Payment Methods
          </CardTitle>
          <CardDescription className="text-xs">Configure which payment methods are available at checkout</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* PayPal / Venmo / Card — always on, controlled by PayPal SDK */}
          <div className="p-3 bg-[#E5F2F0] rounded-lg text-xs text-[#00352F] space-y-1">
            <p className="font-medium">PayPal, Venmo & Card — Always Available</p>
            <p className="text-[#00594F]">
              These payment buttons are handled by PayPal&apos;s secure checkout. To enable or disable Venmo and card payments,
              configure funding sources in your <strong>PayPal merchant dashboard</strong>.
            </p>
          </div>
          <Separator />
          {/* Cash toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Banknote className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Cash Payment</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Show a cash option below the PayPal buttons at checkout</p>
              </div>
            </div>
            <Switch checked={cashEnabled} onCheckedChange={setCashEnabled} />
          </div>
          <Separator />
          {/* Personal orders payment methods */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Personal Orders — Payment Methods</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Allowed payment methods for personal orders</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['paypal', 'venmo', 'card', 'cash'] as const).map(method => {
                const labels = { paypal: 'PayPal', venmo: 'Venmo', card: 'Card', cash: 'Cash' }
                const enabled = personalAllowedPaymentMethods === null || personalAllowedPaymentMethods.includes(method)
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      const all = ['paypal', 'venmo', 'card', 'cash']
                      const current = personalAllowedPaymentMethods
                      let updated: string[] | null
                      if (current === null) {
                        updated = all.filter(m => m !== method)
                      } else if (enabled) {
                        updated = current.filter(m => m !== method)
                      } else {
                        updated = [...current, method]
                      }
                      if (updated !== null && updated.length === all.length) updated = null
                      setPersonalAllowedPaymentMethods(updated)
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      enabled
                        ? 'bg-[#00352F] text-white border-[#00352F]'
                        : 'bg-white dark:bg-gray-900 text-gray-500 border-gray-200 dark:border-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {enabled && <span className="mr-1">✓</span>}
                    {labels[method]}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-gray-400">
              {personalAllowedPaymentMethods === null
                ? 'All methods enabled (default)'
                : personalAllowedPaymentMethods.length === 0
                  ? 'No payment methods allowed'
                  : `${personalAllowedPaymentMethods.length} method${personalAllowedPaymentMethods.length === 1 ? '' : 's'} enabled`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Confirmation Message
          </CardTitle>
          <CardDescription className="text-xs">Shown to customers after they complete their order</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={confirmationMessage}
            onChange={e => setConfirmationMessage(e.target.value)}
            placeholder="Thank you for your order! We will process it shortly."
            rows={3}
            className="resize-none"
          />
        </CardContent>
      </Card>

      {/* Push notifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Phone Notifications
          </CardTitle>
          <CardDescription className="text-xs">Get a push notification on your phone when a new order comes in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Push Notifications</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Free alerts via the ntfy app — no phone number purchase needed</p>
            </div>
            <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} />
          </div>
          {smsNotifications && (
            <div>
              <Label htmlFor="admin_phone">ntfy Topic Name</Label>
              <Input
                id="admin_phone"
                type="text"
                value={adminPhone}
                onChange={e => setAdminPhone(e.target.value)}
                placeholder="e.g. shirt-orders-lih-2026"
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">
                Pick any unique private name. Install the <strong>ntfy</strong> app (iOS/Android), subscribe to this topic, and you&apos;ll receive a notification for every new order.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pb-6">
        <Button onClick={handleSave} disabled={saving} className="text-white" style={{ backgroundColor: '#00352F' }}>
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Save className="w-4 h-4 mr-2" /> Save Settings</>}
        </Button>
        {settings && (
          <p className="text-xs text-gray-400">
            Last updated: {new Date(settings.updated_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  )
}
