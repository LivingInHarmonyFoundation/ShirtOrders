/**
 * @file page.tsx
 * @description Admin application settings page. Controls app name, shirt pricing,
 * available sizes, enabled institution types, payment methods, the post-order
 * confirmation message, push-notification config, and brand image uploads.
 *
 * Key non-obvious details:
 * - admin_phone is the ntfy.sh topic name, NOT a real phone number.
 * - Mission banner and badge image uploads reuse the catalog upload endpoint.
 * - Both image uploads enforce a 5 MB client-side size limit.
 * - personalAllowedPaymentMethods === null means "all methods" (default).
 * - Mission/badge image sections are gated behind canManageSettings permission.
 *
 * Auth: provided by the parent (protected) layout.
 */
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
import { Save, Loader2, DollarSign, School, Building2, MessageSquare, User, Briefcase, ImagePlus, Upload, Trash2, CreditCard, Banknote, Plus, Percent } from 'lucide-react'
import Image from 'next/image'
import type { AppSettings } from '@/types'
import { useRole } from '@/components/admin/role-provider'
import { useT } from '@/contexts/LanguageContext'

const PRESET_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

/**
 * SettingsPage — admin settings form. All fields (except image uploads, which save
 * immediately on pick) are committed together via a single PATCH on "Save Settings".
 * Image uploads use a two-step flow: upload to storage, then PATCH the URL into settings.
 */
export default function SettingsPage() {
  const t = useT()
  const { permissions } = useRole()

  // ── State ──
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form fields
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

  // Order fees
  const [orderFees, setOrderFees] = useState<import('@/types').OrderFee[]>([])
  const [newFeeName, setNewFeeName] = useState('')
  const [newFeeType, setNewFeeType] = useState<'percentage' | 'fixed'>('percentage')
  const [newFeeValue, setNewFeeValue] = useState('')
  const [newFeeAppliesTo, setNewFeeAppliesTo] = useState<import('@/types').InstitutionType[]>([])

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
          setOrderFees(settings.order_fees || [])
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

  const addFee = () => {
    const val = parseFloat(newFeeValue)
    if (!newFeeName.trim() || isNaN(val) || val <= 0) return
    if (newFeeType === 'percentage' && val > 100) return
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
    setOrderFees(prev => [...prev, {
      id,
      name: newFeeName.trim(),
      type: newFeeType,
      value: val,
      applies_to: newFeeAppliesTo.length > 0 ? newFeeAppliesTo : null,
    }])
    setNewFeeName('')
    setNewFeeValue('')
    setNewFeeAppliesTo([])
  }

  const toggleFeeTarget = (type: import('@/types').InstitutionType) => {
    setNewFeeAppliesTo(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const removeFee = (id: string) => {
    setOrderFees(prev => prev.filter(f => f.id !== id))
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
          order_fees: orderFees,
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admin', 'settingsTitle')}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{t('admin', 'settingsSubtitle')}</p>
      </div>

      {/* ── Mission Banner ──────────────────────────────────── */}
      {permissions.canManageSettings && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ImagePlus className="w-4 h-4" /> {t('admin', 'missionBannerTitle')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('admin', 'missionBannerDesc')}
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
                      ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> {t('admin', 'uploading')}</>
                      : <><Upload className="w-3.5 h-3.5 mr-1.5" /> {t('admin', 'replaceImage')}</>}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleBannerRemove}
                    disabled={uploadingBanner}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> {t('admin', 'removeBanner')}
                  </Button>
                </div>
                <p className="text-[11px] text-gray-400">
                  {t('admin', 'removingBannerNote')}
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
                  <p className="text-sm font-medium text-gray-500">{t('admin', 'noBannerSet')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t('admin', 'clickToUpload')}</p>
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
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> {t('admin', 'uploading')}</>
                    : <><Upload className="w-3.5 h-3.5 mr-1.5" /> {t('admin', 'uploadBanner')}</>}
                </Button>
              </>
            )}

            <p className="text-[11px] text-gray-400">
              {t('admin', 'bannerRecommended')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Badge Image ─────────────────────────────────── */}
      {permissions.canManageSettings && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ImagePlus className="w-4 h-4" /> {t('admin', 'badgeImageTitle')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('admin', 'badgeImageDesc')}
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
                    <p>{t('admin', 'shownAsCircle')}</p>
                    <p>{t('admin', 'squareImageBest')}</p>
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
                      ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> {t('admin', 'uploading')}</>
                      : <><Upload className="w-3.5 h-3.5 mr-1.5" /> {t('admin', 'replaceBadge')}</>}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleBadgeRemove}
                    disabled={uploadingBadge}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> {t('admin', 'removeBadge')}
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
                  <p className="text-sm font-medium text-gray-500">{t('admin', 'noCustomBadge')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t('admin', 'clickToUpload')}</p>
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
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> {t('admin', 'uploading')}</>
                    : <><Upload className="w-3.5 h-3.5 mr-1.5" /> {t('admin', 'uploadBadge')}</>}
                </Button>
              </>
            )}

            <p className="text-[11px] text-gray-400">
              {t('admin', 'badgeRecommended')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pricing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> {t('admin', 'pricingTitle')}
          </CardTitle>
          <CardDescription className="text-xs">{t('admin', 'pricingDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="shirt_price">{t('admin', 'pricePerShirt')}</Label>
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
            <Label>{t('admin', 'availableSizesLabel')}</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-2">{t('admin', 'availableSizesDesc')}</p>
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
                placeholder={t('admin', 'customSizePlaceholder')}
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
                {t('admin', 'addSizeButton')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Fees & Taxes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Percent className="w-4 h-4" /> {t('admin', 'orderFeesTitle')}
          </CardTitle>
          <CardDescription className="text-xs">
            {t('admin', 'orderFeesDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing fees list */}
          {orderFees.length > 0 ? (
            <div className="space-y-2">
              {orderFees.map(fee => {
                const targetLabels: Record<string, string> = {
                  school: t('admin', 'schoolType'), government: t('admin', 'governmentType'), personal: t('admin', 'personalType'), private_company: t('admin', 'privateCompanyType'),
                }
                const scopeText = !fee.applies_to || fee.applies_to.length === 0
                  ? t('admin', 'allOrdersScope')
                  : fee.applies_to.map(ft => targetLabels[ft]).join(', ')
                return (
                  <div key={fee.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                        fee.type === 'percentage'
                          ? 'bg-[#CEDC00]/20 text-[#00352F]'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {fee.type === 'percentage' ? '%' : '$'}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{fee.name}</p>
                        <p className="text-xs text-gray-500">
                          {fee.type === 'percentage' ? `${fee.value}% ${t('admin', 'percentOfSubtotal')}` : `$${fee.value.toFixed(2)} ${t('admin', 'flatFee')}`}
                          {' · '}
                          <span className="italic">{scopeText}</span>
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFee(fee.id)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">{t('admin', 'noFeesConfigured')}</p>
          )}

          <Separator />

          {/* Add fee form */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('admin', 'addFeeLabel')}</p>
            <Input
              placeholder={t('admin', 'feeNamePlaceholder')}
              value={newFeeName}
              onChange={e => setNewFeeName(e.target.value)}
              className="h-9 text-sm"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFee() } }}
            />
            <div className="flex gap-2 items-center flex-wrap">
              {/* Type toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setNewFeeType('percentage')}
                  className={`px-3 py-2 font-medium transition-colors ${
                    newFeeType === 'percentage'
                      ? 'bg-[#00352F] text-white'
                      : 'bg-white dark:bg-gray-900 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  % {t('admin', 'percentageType')}
                </button>
                <button
                  type="button"
                  onClick={() => setNewFeeType('fixed')}
                  className={`px-3 py-2 font-medium transition-colors ${
                    newFeeType === 'fixed'
                      ? 'bg-[#00352F] text-white'
                      : 'bg-white dark:bg-gray-900 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  $ {t('admin', 'fixedType')}
                </button>
              </div>
              {/* Value input */}
              <div className="relative max-w-[120px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  {newFeeType === 'percentage' ? '%' : '$'}
                </span>
                <Input
                  type="number"
                  min="0.01"
                  max={newFeeType === 'percentage' ? '100' : undefined}
                  step="0.01"
                  value={newFeeValue}
                  onChange={e => setNewFeeValue(e.target.value)}
                  className="pl-7 h-9 text-sm"
                  placeholder="0.00"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFee() } }}
                />
              </div>
            </div>
            {/* Applies-to selector */}
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500">{t('admin', 'applyToLabel')} <span className="font-medium">({t('admin', 'leaveUncheckedNote')})</span></p>
              <div className="flex gap-2 flex-wrap">
                {([
                  { key: 'school', label: t('admin', 'schoolType') },
                  { key: 'government', label: t('admin', 'governmentType') },
                  { key: 'personal', label: t('admin', 'personalType') },
                  { key: 'private_company', label: t('admin', 'privateCompanyType') },
                ] as const).map(({ key, label }) => {
                  const active = newFeeAppliesTo.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleFeeTarget(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        active
                          ? 'bg-[#00352F] text-white border-[#00352F]'
                          : 'bg-white dark:bg-gray-900 text-gray-500 border-gray-200 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {active && <span className="mr-1">✓</span>}{label}
                    </button>
                  )
                })}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={addFee}
              disabled={!newFeeName.trim() || !newFeeValue}
              className="h-9 text-white"
              style={{ backgroundColor: '#00352F' }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> {t('admin', 'addFeeButton')}
            </Button>
            <p className="text-[11px] text-gray-400">
              {t('admin', 'feesSavedNote')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Institution types */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <School className="w-4 h-4" /> {t('admin', 'institutionTypesTitle')}
          </CardTitle>
          <CardDescription className="text-xs">{t('admin', 'institutionTypesDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <School className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t('admin', 'schoolOrdersLabel')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin', 'schoolOrdersDesc')}</p>
              </div>
            </div>
            <Switch checked={schoolEnabled} onCheckedChange={setSchoolEnabled} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t('admin', 'governmentOrdersLabel')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin', 'governmentOrdersDesc')}</p>
              </div>
            </div>
            <Switch checked={govEnabled} onCheckedChange={setGovEnabled} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t('admin', 'personalOrdersLabel')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin', 'personalOrdersDesc')}</p>
              </div>
            </div>
            <Switch checked={personalEnabled} onCheckedChange={setPersonalEnabled} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Briefcase className="w-4 h-4 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t('admin', 'privateCompanyOrdersLabel')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin', 'privateCompanyOrdersDesc')}</p>
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
            <CreditCard className="w-4 h-4" /> {t('admin', 'paymentMethodsTitle')}
          </CardTitle>
          <CardDescription className="text-xs">{t('admin', 'paymentMethodsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* PayPal / Venmo / Card — always on, controlled by PayPal SDK */}
          <div className="p-3 bg-[#E5F2F0] rounded-lg text-xs text-[#00352F] space-y-1">
            <p className="font-medium">{t('admin', 'paypalAlwaysTitle')}</p>
            <p className="text-[#00594F]">
              {t('admin', 'paypalAlwaysDesc')}
            </p>
          </div>
          <Separator />
          {/* Cash toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Banknote className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t('admin', 'cashPaymentLabel')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin', 'cashPaymentDesc')}</p>
              </div>
            </div>
            <Switch checked={cashEnabled} onCheckedChange={setCashEnabled} />
          </div>
          <Separator />
          {/* Personal orders payment methods */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{t('admin', 'personalPaymentLabel')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin', 'personalPaymentDesc')}</p>
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
                ? t('admin', 'allMethodsEnabled')
                : personalAllowedPaymentMethods.length === 0
                  ? t('admin', 'noMethodsAllowed')
                  : `${personalAllowedPaymentMethods.length} ${personalAllowedPaymentMethods.length === 1 ? t('admin', 'methodsEnabled') : t('admin', 'methodsEnabledPlural')} ${t('admin', 'enabledSuffix')}`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> {t('admin', 'confirmationTitle')}
          </CardTitle>
          <CardDescription className="text-xs">{t('admin', 'confirmationDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={confirmationMessage}
            onChange={e => setConfirmationMessage(e.target.value)}
            placeholder={t('admin', 'confirmationPlaceholder')}
            rows={3}
            className="resize-none"
          />
        </CardContent>
      </Card>

      {/* Push notifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> {t('admin', 'phoneNotificationsTitle')}
          </CardTitle>
          <CardDescription className="text-xs">{t('admin', 'phoneNotificationsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{t('admin', 'pushNotificationsLabel')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin', 'pushNotificationsDesc')}</p>
            </div>
            <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} />
          </div>
          {smsNotifications && (
            <div>
              <Label htmlFor="admin_phone">{t('admin', 'ntfyTopicLabel')}</Label>
              <Input
                id="admin_phone"
                type="text"
                value={adminPhone}
                onChange={e => setAdminPhone(e.target.value)}
                placeholder={t('admin', 'ntfyTopicPlaceholder')}
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">
                {t('admin', 'ntfyTopicDesc')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pb-6">
        <Button onClick={handleSave} disabled={saving} className="text-white" style={{ backgroundColor: '#00352F' }}>
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('admin', 'savingSettings')}</> : <><Save className="w-4 h-4 mr-2" /> {t('admin', 'saveSettings')}</>}
        </Button>
        {settings && (
          <p className="text-xs text-gray-400">
            {t('admin', 'lastUpdated')}: {new Date(settings.updated_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  )
}
