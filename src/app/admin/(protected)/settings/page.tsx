/**
 * @file page.tsx
 * @description Admin application settings page. Controls app name, shirt pricing,
 * available sizes, enabled institution types, payment methods, the post-order
 * confirmation message, push-notification config, and brand image uploads.
 *
 * Key non-obvious details:
 * - admin_phone is the ntfy.sh topic name, NOT a real phone number.
 * - personalAllowedPaymentMethods === null means "all methods" (default).
 *
 * Auth: provided by the parent (protected) layout.
 */
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Save, Loader2, School, Building2, MessageSquare, User, Briefcase, Trash2, CreditCard, Banknote, Plus, Percent, Users, Ruler, X, Landmark } from 'lucide-react'
import type { AppSettings, OrderFee, InstitutionType, SizeGroup } from '@/types'
import { deriveDefaultSizeGroups, sortSizesForDisplay } from '@/lib/utils'
import { useRole } from '@/components/admin/role-provider'
import { useT } from '@/contexts/LanguageContext'

/**
 * SettingsPage — admin settings form. All fields (except image uploads, which save
 * immediately on pick) are committed together via a single PATCH on "Save Settings".
 * Image uploads use a two-step flow: upload to storage, then PATCH the URL into settings.
 */
export default function SettingsPage() {
  const t = useT()
  useRole()

  // ── State ──
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [schoolEnabled, setSchoolEnabled] = useState(true)
  const [govEnabled, setGovEnabled] = useState(true)
  const [personalEnabled, setPersonalEnabled] = useState(true)
  const [privateCompanyEnabled, setPrivateCompanyEnabled] = useState(true)
  const [staffEnabled, setStaffEnabled] = useState(false)
  const [municipalityEnabled, setMunicipalityEnabled] = useState(true)
  const [cashEnabled, setCashEnabled] = useState(false)
  const [cashEnabledSchool, setCashEnabledSchool] = useState(false)
  const [cashEnabledGovernment, setCashEnabledGovernment] = useState(false)
  const [cashEnabledPrivateCompany, setCashEnabledPrivateCompany] = useState(false)
  const [personalAllowedPaymentMethods, setPersonalAllowedPaymentMethods] = useState<string[] | null>(null)
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const [adminPhone, setAdminPhone] = useState('')
  const [smsNotifications, setSmsNotifications] = useState(false)

  // Order fees
  const [orderFees, setOrderFees] = useState<OrderFee[]>([])
  // Size categories: the customer-facing grouping of sizes. `sizePool` is every
  // size the app knows about (global list + all catalog items' sizes).
  const [sizeGroups, setSizeGroups] = useState<SizeGroup[]>([])
  const [sizePool, setSizePool] = useState<string[]>([])
  const [newFeeName, setNewFeeName] = useState('')
  const [newFeeType, setNewFeeType] = useState<'percentage' | 'fixed'>('percentage')
  const [newFeeValue, setNewFeeValue] = useState('')
  const [newFeeAppliesTo, setNewFeeAppliesTo] = useState<InstitutionType[]>([])

  // ── Effects ──

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/settings').then(r => r.json()),
      fetch('/api/admin/catalog').then(r => r.json()).catch(() => ({ items: [] })),
    ])
      .then(([{ settings }, { items }]) => {
        // Pool = global sizes + every catalog item's sizes + already-grouped sizes.
        const pool: string[] = []
        for (const s of settings?.available_sizes ?? []) if (!pool.includes(s)) pool.push(s)
        for (const item of items ?? []) for (const s of item.available_sizes ?? []) if (!pool.includes(s)) pool.push(s)
        for (const g of settings?.size_groups ?? []) for (const s of g.sizes) if (!pool.includes(s)) pool.push(s)
        setSizePool(pool)
        // No categories saved yet → prefill with the same defaults customers see,
        // so the admin edits the effective grouping rather than starting blank.
        setSizeGroups(
          settings?.size_groups?.length ? settings.size_groups : deriveDefaultSizeGroups(pool)
        )
        if (settings) {
          setSettings(settings)
          setSchoolEnabled(settings.school_orders_enabled ?? true)
          setGovEnabled(settings.government_orders_enabled ?? true)
          setPersonalEnabled(settings.personal_orders_enabled ?? true)
          setPrivateCompanyEnabled(settings.private_company_orders_enabled ?? true)
          setStaffEnabled(settings.staff_orders_enabled ?? false)
          setMunicipalityEnabled(settings.municipality_orders_enabled ?? true)
          setCashEnabled(settings.cash_enabled ?? false)
          setCashEnabledSchool(settings.cash_enabled_school ?? false)
          setCashEnabledGovernment(settings.cash_enabled_government ?? false)
          setCashEnabledPrivateCompany(settings.cash_enabled_private_company ?? false)
          setPersonalAllowedPaymentMethods(settings.personal_allowed_payment_methods ?? null)
          setConfirmationMessage(settings.confirmation_message || '')
          setAdminPhone(settings.admin_phone || '')
          setSmsNotifications(settings.sms_notifications_enabled ?? false)
          setOrderFees(settings.order_fees || [])
        }
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  // ── Handlers ──

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

  // ── Size-category handlers ──
  // A size lives in at most one category: toggling it into a group removes it
  // from every other group; toggling it off leaves it unassigned ("Other").
  const toggleGroupSize = (groupIndex: number, size: string) => {
    setSizeGroups(prev => prev.map((g, i) => {
      if (i === groupIndex) {
        return g.sizes.includes(size)
          ? { ...g, sizes: g.sizes.filter(s => s !== size) }
          : { ...g, sizes: [...g.sizes, size] }
      }
      return { ...g, sizes: g.sizes.filter(s => s !== size) }
    }))
  }

  const renameGroup = (groupIndex: number, name: string) => {
    setSizeGroups(prev => prev.map((g, i) => (i === groupIndex ? { ...g, name } : g)))
  }

  const addGroup = () => setSizeGroups(prev => [...prev, { name: '', sizes: [] }])

  const removeGroup = (groupIndex: number) =>
    setSizeGroups(prev => prev.filter((_, i) => i !== groupIndex))

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_orders_enabled: schoolEnabled,
          government_orders_enabled: govEnabled,
          personal_orders_enabled: personalEnabled,
          private_company_orders_enabled: privateCompanyEnabled,
          staff_orders_enabled: staffEnabled,
          municipality_orders_enabled: municipalityEnabled,
          cash_enabled: cashEnabled,
          cash_enabled_school: cashEnabledSchool,
          cash_enabled_government: cashEnabledGovernment,
          cash_enabled_private_company: cashEnabledPrivateCompany,
          personal_allowed_payment_methods: personalAllowedPaymentMethods,
          confirmation_message: confirmationMessage,
          admin_phone: adminPhone || null,
          sms_notifications_enabled: smsNotifications,
          order_fees: orderFees,
          size_groups: sizeGroups
            .map(g => ({ name: g.name.trim(), sizes: g.sizes }))
            .filter(g => g.name && g.sizes.length > 0),
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

      {/* Size Categories */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Ruler className="w-4 h-4" /> {t('admin', 'sizeGroupsTitle')}
          </CardTitle>
          <CardDescription>{t('admin', 'sizeGroupsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sizeGroups.map((group, gi) => (
            <div key={gi} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Input
                  value={group.name}
                  onChange={e => renameGroup(gi, e.target.value)}
                  placeholder={t('admin', 'categoryNamePlaceholder')}
                  className="h-8 text-sm max-w-[220px] font-medium"
                />
                <button
                  type="button"
                  onClick={() => removeGroup(gi)}
                  className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sortSizesForDisplay(sizePool).map(size => {
                  const inThisGroup = group.sizes.includes(size)
                  const inOtherGroup = !inThisGroup && sizeGroups.some((g, i) => i !== gi && g.sizes.includes(size))
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => toggleGroupSize(gi, size)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border-2 transition-colors ${
                        inThisGroup
                          ? 'border-[#00352F] bg-[#E5F2F0] text-[#00352F]'
                          : inOtherGroup
                            ? 'border-gray-100 text-gray-300 hover:border-gray-300 hover:text-gray-500'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {size}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {(() => {
            const assigned = new Set(sizeGroups.flatMap(g => g.sizes))
            const unassigned = sizePool.filter(s => !assigned.has(s))
            return unassigned.length > 0 ? (
              <p className="text-xs text-gray-400">
                {t('admin', 'unassignedSizes')} {sortSizesForDisplay(unassigned).join(', ')}
              </p>
            ) : null
          })()}

          <Button type="button" size="sm" variant="outline" onClick={addGroup} className="text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> {t('admin', 'addCategory')}
          </Button>
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
                  school: t('admin', 'schoolType'), government: t('admin', 'governmentType'), personal: t('admin', 'personalType'), private_company: t('admin', 'privateCompanyType'), municipality: t('admin', 'municipalityType'),
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
                  {t('admin', 'percentageType')}
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
                  {t('admin', 'fixedType')}
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
                  { key: 'municipality', label: t('admin', 'municipalityType') },
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
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t('admin', 'staffOrdersLabel')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin', 'staffOrdersDesc')}</p>
              </div>
            </div>
            <Switch checked={staffEnabled} onCheckedChange={setStaffEnabled} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Landmark className="w-4 h-4 text-teal-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t('admin', 'municipalityOrdersLabel')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin', 'municipalityOrdersDesc')}</p>
              </div>
            </div>
            <Switch checked={municipalityEnabled} onCheckedChange={setMunicipalityEnabled} />
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
          {/* Per-institution cash toggles */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-green-600" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">{t('admin', 'cashPaymentLabel')}</p>
            </div>
            {[
              { label: t('admin', 'institutionSchool'), checked: cashEnabledSchool, onChange: setCashEnabledSchool },
              { label: t('admin', 'institutionGovernment'), checked: cashEnabledGovernment, onChange: setCashEnabledGovernment },
              { label: t('admin', 'institutionPrivateCompany'), checked: cashEnabledPrivateCompany, onChange: setCashEnabledPrivateCompany },
            ].map(({ label, checked, onChange }) => (
              <div key={label} className="flex items-center justify-between pl-6">
                <p className="text-sm text-gray-700 dark:text-gray-300">{label}</p>
                <Switch checked={checked} onCheckedChange={onChange} />
              </div>
            ))}
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
