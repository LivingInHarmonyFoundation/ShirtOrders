'use client'

import { useState, useEffect, use, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { School, Building2, Loader2, CheckCircle2, ShoppingBag, ShoppingCart, Users } from 'lucide-react'
import { cn, formatCurrency, formatPhone } from '@/lib/utils'
import Image from 'next/image'
import Link from 'next/link'
import ShirtViewer from '@/components/shared/ShirtViewer'
import CartIcon from '@/components/shared/CartIcon'
import CartDrawer from '@/components/shared/CartDrawer'
import LanguageSelector from '@/components/shared/LanguageSelector'
import PoweredByFooter from '@/components/shared/PoweredByFooter'
import PersonalInfoCard from '@/components/order/PersonalInfoCard'
import { useCart } from '@/contexts/CartContext'
import { useT } from '@/contexts/LanguageContext'
import { Briefcase, User } from 'lucide-react'
import type { AppSettings, InstitutionType, ShirtCatalogItem, GovOrg, PrivateCompany, Campaign } from '@/types'

// ─── Zod Validation Schema ────────────────────────────────────
const schema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional().refine(v => !v || v.replace(/\D/g, '').length === 10, { message: 'Enter a valid 10-digit phone number' }),
  institution_type: z.enum(['school', 'government', 'personal', 'private_company', 'staff'] as const),
  school_name: z.string().optional(),
  grade: z.string().optional(),
  classroom: z.string().optional(),
  organization_name: z.string().optional(),
  department_office: z.string().optional(),
  company_name: z.string().optional(),
  company_department: z.string().optional(),
  delivery_street: z.string().optional(),
  delivery_street2: z.string().optional(),
  delivery_city: z.string().optional(),
  delivery_state: z.string().optional(),
  delivery_zip: z.string().optional(),
  shirt_size: z.string().min(1, 'Please select a size'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.institution_type === 'school') {
    if (!data.school_name) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'School name is required', path: ['school_name'] })
    if (!data.grade) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Grade is required', path: ['grade'] })
    if (!data.classroom) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Classroom is required', path: ['classroom'] })
  }
  if (data.institution_type === 'government') {
    if (!data.organization_name) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Organization name is required', path: ['organization_name'] })
    if (!data.department_office) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Department/Office is required', path: ['department_office'] })
  }
  if (data.institution_type === 'private_company') {
    if (!data.company_name) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Company name is required', path: ['company_name'] })
  }
  if (data.institution_type === 'personal') {
    if (!data.delivery_street) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Street address is required', path: ['delivery_street'] })
    if (!data.delivery_city) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'City is required', path: ['delivery_city'] })
    if (!data.delivery_state) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'State is required', path: ['delivery_state'] })
    if (!data.delivery_zip) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ZIP code is required', path: ['delivery_zip'] })
  }
})

type FormData = z.infer<typeof schema>

function isEffectivelyActive(campaign: Campaign, now = new Date()): boolean {
  if (!campaign.is_active) return false
  const today = now.toISOString().split('T')[0]
  if (campaign.is_recurring && campaign.start_date && campaign.end_date) {
    const s = new Date(campaign.start_date)
    const e = new Date(campaign.end_date)
    const nowMD = now.getMonth() * 100 + now.getDate()
    const startMD = s.getMonth() * 100 + s.getDate()
    const endMD = e.getMonth() * 100 + e.getDate()
    const inWindow = startMD <= endMD ? nowMD >= startMD && nowMD <= endMD : nowMD >= startMD || nowMD <= endMD
    return inWindow
  }
  if (campaign.end_date && campaign.end_date < today) return false
  return true
}

function CampaignOrderInner({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const searchParams = useSearchParams()
  // Institution lock — carried from school/company links via query params
  const lockedSchoolLinkId  = searchParams.get('school_link_id')
  const lockedSchoolName    = searchParams.get('school_name')
  const lockedCompanyLinkId = searchParams.get('company_link_id')
  const lockedCompanyName   = searchParams.get('company_name')
  const lockedInstitution: InstitutionType | null =
    lockedSchoolLinkId  ? 'school' :
    lockedCompanyLinkId ? 'private_company' :
    (searchParams.get('institution') as InstitutionType | null)
  const t = useT()
  const { addItem, openCart, items: cartItems, totalItems, savedCheckoutInfo, saveCheckoutInfo } = useCart()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [fallbackSettings, setFallbackSettings] = useState<{ banner_url: string | null; badge_url: string | null }>({ banner_url: null, badge_url: null })
  const [loadState, setLoadState] = useState<'loading' | 'notfound' | 'ready'>('loading')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [catalog, setCatalog] = useState<ShirtCatalogItem[]>([])
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<ShirtCatalogItem | null>(null)
  const [inventoryRows, setInventoryRows] = useState<{ catalog_item_id: string | null; shirt_size: string; quantity: number }[]>([])
  const [govOrgs, setGovOrgs] = useState<GovOrg[]>([])
  const [selectedGovOrg, setSelectedGovOrg] = useState<GovOrg | null>(null)
  const [privateCompanies, setPrivateCompanies] = useState<PrivateCompany[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [institutionType, setInstitutionType] = useState<InstitutionType | ''>(lockedInstitution ?? '')
  const [checkoutPayload, setCheckoutPayload] = useState<null | {
    full_name: string
    email: string
    phone?: string
    institution_type: string
    school_name?: string
    grade?: string
    classroom?: string
    organization_name?: string
    department_office?: string
    company_name?: string
    company_department?: string
    delivery_address?: string
    notes?: string
    school_link_id?: string
    company_link_id?: string
    campaign_id?: string
  }>(null)

  const { register, handleSubmit, setValue, watch, reset, trigger, getValues, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1 },
  })

  const watchedSize = watch('shirt_size')
  const watchedQty = watch('quantity')
  const unitPrice = selectedCatalogItem?.price ?? settings?.shirt_price ?? 15
  // All sizes defined for this item (or global fallback)
  const allSizes: string[] = selectedCatalogItem?.available_sizes ?? settings?.available_sizes ?? ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  // Filter out sizes with confirmed zero stock. If there are no inventory rows at
  // all for this item we show all sizes (inventory tracking may not be set up).
  const itemInventory = inventoryRows.filter(r =>
    selectedCatalogItem
      ? r.catalog_item_id === selectedCatalogItem.id || r.catalog_item_id === null
      : r.catalog_item_id === null
  )
  const sizes = itemInventory.length > 0
    ? allSizes.filter(s => {
        // Prefer catalog-specific row; fall back to general row
        const specific = itemInventory.find(r => r.catalog_item_id !== null && r.shirt_size === s)
        const general  = itemInventory.find(r => r.catalog_item_id === null  && r.shirt_size === s)
        const row = specific ?? general
        return !row || row.quantity > 0
      })
    : allSizes

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
        if (json.catalog_items?.length > 0) setCatalog(json.catalog_items)
        setLoadState('ready')
      })
      .catch(() => setLoadState('notfound'))

    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(({ settings: s }) => { if (s) setSettings(s) })
      .catch(() => {})

    fetch('/api/government-orgs')
      .then(r => r.json())
      .then(({ orgs }) => { if (orgs?.length > 0) setGovOrgs(orgs) })
      .catch(() => {})

    fetch('/api/private-companies')
      .then(r => r.json())
      .then(({ companies }) => { if (companies?.length > 0) setPrivateCompanies(companies) })
      .catch(() => {})

    fetch('/api/inventory')
      .then(r => r.json())
      .then(({ rows }) => { if (rows) setInventoryRows(rows) })
      .catch(() => {})
  }, [slug])

  useEffect(() => {
    if (catalog.length === 1) setSelectedCatalogItem(catalog[0])
  }, [catalog])

  // Lock institution type and pre-fill entity name when arriving from an institution link.
  useEffect(() => {
    if (!lockedInstitution) return
    setValue('institution_type', lockedInstitution, { shouldValidate: false })
    if (lockedSchoolName)   setValue('school_name',   lockedSchoolName,   { shouldValidate: false })
    if (lockedCompanyName)  setValue('company_name',  lockedCompanyName,  { shouldValidate: false })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill personal info if the customer already added to cart on another campaign
  useEffect(() => {
    if (!savedCheckoutInfo) return
    // Don't override a URL-locked institution with saved info.
    const effectiveType = lockedInstitution ?? (savedCheckoutInfo.institution_type as InstitutionType | undefined)
    reset({ ...savedCheckoutInfo, institution_type: effectiveType, quantity: 1 } as FormData)
    if (effectiveType) {
      setInstitutionType(effectiveType)
      setValue('institution_type', effectiveType)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: FormData) => {
    if (catalog.length > 1 && !selectedCatalogItem) {
      toast.error(t('order', 'selectShirtFirst'))
      return
    }
    setIsAdding(true)
    try {
      const delivery_address = data.institution_type === 'personal'
        ? [data.delivery_street, data.delivery_street2, data.delivery_city, data.delivery_state, data.delivery_zip]
            .filter(Boolean).join(', ')
        : undefined

      const payload = {
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        institution_type: data.institution_type,
        school_name: data.school_name,
        grade: data.grade,
        classroom: data.classroom,
        organization_name: data.organization_name,
        department_office: data.department_office,
        company_name: data.company_name,
        company_department: data.company_department,
        delivery_address,
        notes: data.notes,
        campaign_id: campaign?.id,
        school_link_id: lockedSchoolLinkId ?? undefined,
        company_link_id: lockedCompanyLinkId ?? undefined,
      }
      setCheckoutPayload(payload)
      saveCheckoutInfo({ ...data })

      addItem({
        catalog_item_id: selectedCatalogItem?.id ?? null,
        catalog_item_name: selectedCatalogItem?.name ?? 'Shirt',
        catalog_item_image: selectedCatalogItem?.image_url ?? null,
        shirt_size: data.shirt_size,
        quantity: Number(data.quantity),
        unit_price: unitPrice,
      })

      setValue('shirt_size', '', { shouldValidate: false })
      setValue('quantity', 1, { shouldValidate: false })
      if (catalog.length > 1) setSelectedCatalogItem(null)

      toast.success(`${data.quantity}× ${data.shirt_size} ${t('order', 'addedToCartSuffix')}`)
      openCart()
    } finally {
      setIsAdding(false)
    }
  }

  const handleCheckoutValidate = async () => {
    const result = await trigger(['full_name', 'email', 'institution_type'])
    if (!result) return false

    const data = getValues()
    const delivery_address = data.institution_type === 'personal'
      ? [data.delivery_street, data.delivery_street2, data.delivery_city, data.delivery_state, data.delivery_zip]
          .filter(Boolean).join(', ')
      : undefined
    setCheckoutPayload({
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      institution_type: data.institution_type,
      school_name: data.school_name,
      grade: data.grade,
      classroom: data.classroom,
      organization_name: data.organization_name,
      department_office: data.department_office,
      company_name: data.company_name,
      company_department: data.company_department,
      delivery_address,
      notes: data.notes,
      campaign_id: campaign?.id,
      school_link_id: lockedSchoolLinkId ?? undefined,
      company_link_id: lockedCompanyLinkId ?? undefined,
    })
    return true
  }

  const showCatalogPicker = catalog.length > 1
  const baseStep = (showCatalogPicker ? 1 : 0) + 1

  const institutionOptions = [
    { value: 'school' as const,          labelKey: 'school' as const,          icon: School,    enabled: settings?.school_orders_enabled !== false },
    { value: 'government' as const,      labelKey: 'government' as const,      icon: Building2, enabled: settings?.government_orders_enabled !== false },
    { value: 'personal' as const,        labelKey: 'personal' as const,        icon: User,      enabled: settings?.personal_orders_enabled !== false },
    { value: 'private_company' as const, labelKey: 'privateCompany' as const,  icon: Briefcase, enabled: settings?.private_company_orders_enabled !== false },
    { value: 'staff' as const,           labelKey: 'staff' as const,           icon: Users,     enabled: settings?.staff_orders_enabled === true },
  ]

  const effectiveBannerUrl = campaign?.banner_url || fallbackSettings.banner_url || null
  const effectiveBadgeUrl = campaign?.badge_url || fallbackSettings.badge_url || null
  const logoSrc = effectiveBadgeUrl || '/logo.png'

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F4F0' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#00352F' }} />
      </div>
    )
  }

  if (loadState === 'notfound') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F5F4F0' }}>
        <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg, #00352F 0%, #CEDC00 60%, #00352F 100%)' }} />
        <header className="border-b" style={{ backgroundColor: 'rgba(255,255,255,0.92)', borderBottomColor: 'rgba(0,0,0,0.05)' }}>
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden p-0.5">
                <Image src="/logo.png" alt="Living in Harmony Foundation" width={32} height={32} className="object-contain" />
              </div>
              <p className="font-semibold leading-none" style={{ color: '#00352F', fontSize: '13px' }}>
                <span className="hidden sm:inline">Living in Harmony Foundation</span>
                <span className="sm:hidden">LIH Foundation</span>
              </p>
            </div>
            <LanguageSelector />
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: '#E5F2F0' }}>
            <ShoppingBag className="w-8 h-8" style={{ color: '#00352F' }} />
          </div>
          <h1 className="font-heading text-2xl font-bold text-gray-900 mb-3">{t('order', 'campaignNotFound')}</h1>
          <p className="text-gray-500 max-w-sm leading-relaxed mb-8">{t('order', 'campaignNotFoundDesc')}</p>
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

  if (campaign && !isEffectivelyActive(campaign)) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F5F4F0' }}>
        <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg, #00352F 0%, #CEDC00 60%, #00352F 100%)' }} />
        <header className="border-b" style={{ backgroundColor: 'rgba(255,255,255,0.92)', borderBottomColor: 'rgba(0,0,0,0.05)' }}>
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden p-0.5">
                <Image src={logoSrc} alt="Living in Harmony Foundation" width={32} height={32} className="object-contain" />
              </div>
              <p className="font-semibold leading-none" style={{ color: '#00352F', fontSize: '13px' }}>
                <span className="hidden sm:inline">Living in Harmony Foundation</span>
                <span className="sm:hidden">LIH Foundation</span>
              </p>
            </div>
            <LanguageSelector />
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: '#E5F2F0' }}>
            <ShoppingBag className="w-8 h-8" style={{ color: '#00352F' }} />
          </div>
          <h1 className="font-heading text-2xl font-bold text-gray-900 mb-3">{campaign.name}</h1>
          <p className="text-gray-500 max-w-sm leading-relaxed mb-8">
            {campaign.ended_message || t('errors', 'campaignEnded')}
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F4F0' }}>
      <div
        className="h-[3px] w-full"
        style={{ background: 'linear-gradient(90deg, #00352F 0%, #CEDC00 60%, #00352F 100%)' }}
      />
      <header
        className="border-b sticky top-0 z-10"
        style={{
          backgroundColor: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottomColor: 'rgba(0,0,0,0.05)',
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden p-0.5">
              <Image src={logoSrc} alt="Living in Harmony Foundation" width={32} height={32} className="object-contain" />
            </div>
            <div>
              <p className="font-semibold leading-none" style={{ color: '#00352F', fontSize: '13px' }}>
                <span className="hidden sm:inline">Living in Harmony Foundation</span>
                <span className="sm:hidden">LIH Foundation</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <CartIcon />
            <Link
              href={`/campaign/${slug}`}
              className="text-gray-400 hover:text-[#00352F] transition-colors flex items-center gap-1 font-medium"
              style={{ fontSize: '12px' }}
            >
              <span>←</span> {t('common', 'back')}
            </Link>
          </div>
        </div>
      </header>

      {effectiveBannerUrl && (
        <div className="w-full max-h-48 overflow-hidden">
          <Image
            src={effectiveBannerUrl}
            alt={campaign?.name ?? 'Campaign banner'}
            width={0}
            height={0}
            sizes="100vw"
            className="w-full h-auto object-cover max-h-48"
          />
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-gray-900">{campaign?.name}</h1>
          {campaign?.description && (
            <p className="text-gray-500 mt-1" style={{ fontSize: '14px' }}>{campaign.description}</p>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* Shirt Style Picker — only shown when multiple options exist */}
          {showCatalogPicker && (
            <Card className={cn('border-2 shadow-sm transition-colors', !selectedCatalogItem ? 'border-amber-300 bg-amber-50/60' : 'border-[#CEDC00]/40')}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold font-heading flex-shrink-0"
                    style={{ backgroundColor: '#00352F' }}
                  >
                    1
                  </div>
                  <div>
                    <CardTitle className="text-base">{t('order', 'chooseShirt')} *</CardTitle>
                    <CardDescription className="mt-0.5">{t('order', 'chooseShirtSub')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {catalog.map(item => {
                    const selected = selectedCatalogItem?.id === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedCatalogItem(item)}
                        className={cn(
                          'relative rounded-xl border-2 overflow-hidden text-left transition-all focus:outline-none',
                          selected
                            ? 'border-[#00352F] shadow-md ring-2 ring-[#00352F]/20'
                            : 'border-gray-200 hover:border-[#00352F]/40'
                        )}
                      >
                        <div className="relative" onClick={e => e.stopPropagation()}>
                          <ShirtViewer
                            frontUrl={item.image_url}
                            backUrl={item.back_image_url ?? null}
                            name={item.name}
                            variant="compact"
                          />
                          {selected && (
                            <div className="absolute top-2 right-2 z-10 w-6 h-6 bg-[#00352F] rounded-full flex items-center justify-center shadow pointer-events-none">
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                        <div className={cn('p-2.5', selected ? 'bg-[#E5F2F0]' : 'bg-white')}>
                          <p className={cn('text-xs font-semibold leading-tight', selected ? 'text-[#00352F]' : 'text-gray-800')}>
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
                {!selectedCatalogItem && (
                  <p className="text-amber-600 text-xs mt-3 font-medium">{t('order', 'selectShirtToContinue')}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Institution Type — hidden when locked via ?institution= param */}
          {!lockedInstitution && <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold font-heading flex-shrink-0"
                  style={{ backgroundColor: '#00352F' }}
                >
                  {String(baseStep)}
                </div>
                <div>
                  <CardTitle className="text-base">{t('order', 'orderType')}</CardTitle>
                  <CardDescription className="mt-0.5">{t('order', 'orderTypeSub')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t('order', 'orderType')}>
                {institutionOptions.filter(o => o.enabled).map(({ value, labelKey, icon: Icon }) => {
                  const active = institutionType === value
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setInstitutionType(value)
                        setValue('institution_type', value, { shouldValidate: true })
                        if (value !== 'government') setSelectedGovOrg(null)
                      }}
                      className={cn(
                        'relative flex flex-col items-center gap-3 py-5 px-3 rounded-2xl border-2 transition-all duration-150 overflow-hidden',
                        active
                          ? 'border-[#00352F] bg-[#E5F2F0] shadow-md'
                          : 'border-gray-200 bg-white hover:border-[#CEDC00]/50 hover:bg-[#F9FCF7]'
                      )}
                    >
                      {active && (
                        <div
                          className="absolute top-0 left-0 right-0 h-[3px]"
                          style={{ backgroundColor: '#00352F' }}
                        />
                      )}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                        style={{ backgroundColor: active ? 'rgba(0,53,47,0.12)' : '#F3F4F6' }}
                      >
                        <Icon className="w-5 h-5" style={{ color: active ? '#00352F' : '#6B7280' }} />
                      </div>
                      <span
                        className="text-xs font-semibold leading-none"
                        style={{ color: active ? '#00352F' : '#374151' }}
                      >
                        {t('order', labelKey)}
                      </span>
                    </button>
                  )
                })}
              </div>
              {errors.institution_type && (
                <p role="alert" className="text-red-600 text-xs mt-2">{errors.institution_type.message}</p>
              )}
            </CardContent>
          </Card>}

          {/* Personal Info */}
          <PersonalInfoCard
            stepNumber={String(baseStep + 1)}
            fullNameReg={register('full_name')}
            emailReg={register('email')}
            phoneReg={register('phone')}
            onPhoneChange={v => setValue('phone', formatPhone(v), { shouldValidate: true })}
            fullNameError={errors.full_name?.message}
            emailError={errors.email?.message}
            phoneError={errors.phone?.message}
          />

          {/* School fields */}
          {institutionType === 'school' && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold font-heading flex-shrink-0" style={{ backgroundColor: '#00352F' }}>
                    {String(baseStep + 2)}
                  </div>
                  <CardTitle className="text-base">{t('order', 'schoolInfo')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t('order', 'schoolName')}</Label>
                  {lockedSchoolName ? (
                    <div className="mt-1 flex items-center gap-2 px-3 py-2 bg-[#E5F2F0] border border-[#CEDC00]/30 rounded-lg">
                      <School className="w-4 h-4 text-[#00352F] flex-shrink-0" />
                      <span className="text-sm text-[#00352F] font-semibold">{lockedSchoolName}</span>
                      <span className="ml-auto text-xs text-[#00352F]/50 bg-[#CEDC00]/20 px-2 py-0.5 rounded">{t('order', 'preFilledLabel')}</span>
                    </div>
                  ) : (
                    <>
                      <Input id="school_name" {...register('school_name')} aria-invalid={!!errors.school_name} placeholder={t('order', 'schoolNamePlaceholder')} className="mt-1" />
                      {errors.school_name && <p role="alert" className="text-red-600 text-xs mt-1">{errors.school_name.message}</p>}
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="grade">{t('order', 'gradeGroup')} *</Label>
                    <Input id="grade" {...register('grade')} aria-invalid={!!errors.grade} placeholder={t('order', 'gradeGroupPlaceholder')} className="mt-1" />
                    {errors.grade && <p role="alert" className="text-red-600 text-xs mt-1">{errors.grade.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="classroom">{t('order', 'classroom')} *</Label>
                    <Input id="classroom" {...register('classroom')} aria-invalid={!!errors.classroom} placeholder={t('order', 'classroomPlaceholder')} className="mt-1" />
                    {errors.classroom && <p role="alert" className="text-red-600 text-xs mt-1">{errors.classroom.message}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Government fields */}
          {institutionType === 'government' && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold font-heading flex-shrink-0" style={{ backgroundColor: '#00352F' }}>
                    {String(baseStep + 2)}
                  </div>
                  <CardTitle className="text-base">{t('order', 'orgInfo')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="organization_name">{t('order', 'orgName')} *</Label>
                  {govOrgs.length > 0 ? (
                    <select
                      id="organization_name"
                      {...register('organization_name')} aria-invalid={!!errors.organization_name}
                      onChange={e => {
                        const found = govOrgs.find(o => o.name === e.target.value) || null
                        setSelectedGovOrg(found)
                        setValue('organization_name', e.target.value, { shouldValidate: true })
                        setValue('department_office', '', { shouldValidate: false })
                      }}
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">{t('order', 'selectOrg')}</option>
                      {govOrgs.map(org => (
                        <option key={org.id} value={org.name}>{org.name}</option>
                      ))}
                    </select>
                  ) : (
                    <Input id="organization_name" {...register('organization_name')} aria-invalid={!!errors.organization_name} placeholder={t('order', 'govOrgInputPlaceholder')} className="mt-1" />
                  )}
                  {errors.organization_name && <p role="alert" className="text-red-600 text-xs mt-1">{errors.organization_name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="department_office">{t('order', 'deptOffice')} *</Label>
                  {selectedGovOrg?.departments && selectedGovOrg.departments.length > 0 ? (
                    <select
                      id="department_office"
                      {...register('department_office')} aria-invalid={!!errors.department_office}
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">{t('order', 'selectDept')}</option>
                      {selectedGovOrg.departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  ) : (
                    <Input id="department_office" {...register('department_office')} aria-invalid={!!errors.department_office} placeholder={t('order', 'deptPlaceholder')} className="mt-1" />
                  )}
                  {errors.department_office && <p role="alert" className="text-red-600 text-xs mt-1">{errors.department_office.message}</p>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Private Company fields */}
          {institutionType === 'private_company' && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold font-heading flex-shrink-0" style={{ backgroundColor: '#00352F' }}>
                    {String(baseStep + 2)}
                  </div>
                  <CardTitle className="text-base">{t('order', 'companyInfo')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="company_name">{t('order', 'companyName')} *</Label>
                  {lockedCompanyName ? (
                    <div className="mt-1 flex items-center gap-2 px-3 py-2 bg-[#E5F2F0] border border-[#CEDC00]/30 rounded-lg">
                      <Briefcase className="w-4 h-4 text-[#00352F] flex-shrink-0" />
                      <span className="text-sm text-[#00352F] font-semibold">{lockedCompanyName}</span>
                      <span className="ml-auto text-xs text-[#00352F]/50 bg-[#CEDC00]/20 px-2 py-0.5 rounded">{t('order', 'preFilledLabel')}</span>
                    </div>
                  ) : privateCompanies.length > 0 ? (
                    <select
                      id="company_name"
                      {...register('company_name')} aria-invalid={!!errors.company_name}
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">{t('order', 'selectCompany')}</option>
                      {privateCompanies.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <Input id="company_name" {...register('company_name')} aria-invalid={!!errors.company_name} placeholder={t('order', 'companyInputPlaceholder')} className="mt-1" />
                  )}
                  {!lockedCompanyName && errors.company_name && <p role="alert" className="text-red-600 text-xs mt-1">{errors.company_name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="company_department">{t('order', 'companyDept')} <span className="text-gray-400">{t('common', 'optional')}</span></Label>
                  <Input id="company_department" {...register('company_department')} aria-invalid={!!errors.company_department} placeholder={t('order', 'companyDeptPlaceholder')} className="mt-1" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Personal — delivery address */}
          {institutionType === 'personal' && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold font-heading flex-shrink-0" style={{ backgroundColor: '#00352F' }}>
                    {String(baseStep + 2)}
                  </div>
                  <div>
                    <CardTitle className="text-base">{t('order', 'deliveryInfo')}</CardTitle>
                    <CardDescription className="mt-0.5">{t('order', 'deliveryInfoSub')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="delivery_street">{t('order', 'streetAddress')} *</Label>
                  <Input id="delivery_street" {...register('delivery_street')} aria-invalid={!!errors.delivery_street} placeholder={t('order', 'streetAddressPlaceholder')} className="mt-1" />
                  {errors.delivery_street && <p role="alert" className="text-red-600 text-xs mt-1">{errors.delivery_street.message}</p>}
                </div>
                <div>
                  <Label htmlFor="delivery_street2">{t('order', 'streetAddress2')}</Label>
                  <Input id="delivery_street2" {...register('delivery_street2')} placeholder={t('order', 'streetAddress2Placeholder')} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="delivery_city">{t('order', 'city')} *</Label>
                    <Input id="delivery_city" {...register('delivery_city')} aria-invalid={!!errors.delivery_city} placeholder={t('order', 'cityPlaceholder')} className="mt-1" />
                    {errors.delivery_city && <p role="alert" className="text-red-600 text-xs mt-1">{errors.delivery_city.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="delivery_state">{t('order', 'state')} *</Label>
                    <Input id="delivery_state" {...register('delivery_state')} aria-invalid={!!errors.delivery_state} placeholder={t('order', 'statePlaceholder')} className="mt-1" />
                    {errors.delivery_state && <p role="alert" className="text-red-600 text-xs mt-1">{errors.delivery_state.message}</p>}
                  </div>
                </div>
                <div className="max-w-[160px]">
                  <Label htmlFor="delivery_zip">{t('order', 'zipCode')} *</Label>
                  <Input id="delivery_zip" {...register('delivery_zip')} aria-invalid={!!errors.delivery_zip} placeholder={t('order', 'zipPlaceholder')} className="mt-1" />
                  {errors.delivery_zip && <p role="alert" className="text-red-600 text-xs mt-1">{errors.delivery_zip.message}</p>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Shirt Details */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold font-heading flex-shrink-0"
                  style={{ backgroundColor: '#00352F' }}
                >
                  {institutionType ? String(baseStep + 3) : String(baseStep + 2)}
                </div>
                <CardTitle className="text-base">{t('order', 'shirtDetails')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {catalog.length === 1 && selectedCatalogItem && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#E5F2F0] border border-[#CEDC00]/30">
                  {selectedCatalogItem.image_url ? (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                      <Image src={selectedCatalogItem.image_url} alt={selectedCatalogItem.name} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-6 h-6 text-[#00352F]/40" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">{t('order', 'selectedShirt')}</p>
                    <p className="font-semibold text-[#00352F] text-sm">{selectedCatalogItem.name}</p>
                  </div>
                </div>
              )}

              <div>
                <Label>{t('order', 'shirtSize')} *</Label>
                <div className="flex flex-wrap gap-2 mt-2" role="radiogroup" aria-label={t('order', 'shirtSize')}>
                  {sizes.map(size => (
                    <button
                      key={size}
                      type="button"
                      role="radio"
                      aria-checked={watchedSize === size}
                      onClick={() => setValue('shirt_size', size, { shouldValidate: true })}
                      className={cn(
                        'min-w-[52px] px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-150',
                        watchedSize === size
                          ? 'border-[#00352F] bg-[#E5F2F0] text-[#00352F] shadow-sm'
                          : 'border-gray-200 bg-white hover:border-[#00352F]/30 hover:bg-[#F5F4F0] text-gray-600'
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                {errors.shirt_size && <p role="alert" className="text-red-600 text-xs mt-1">{errors.shirt_size.message}</p>}
              </div>

              <div>
                <Label htmlFor="quantity">{t('order', 'quantity')} *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max="999"
                  {...register('quantity', { valueAsNumber: true })}
                  className="mt-1 max-w-[140px]"
                />
                {errors.quantity && <p role="alert" className="text-red-600 text-xs mt-1">{errors.quantity.message}</p>}
              </div>

              <div>
                <Label htmlFor="notes">{t('order', 'notes')}</Label>
                <Textarea id="notes" {...register('notes')} aria-invalid={!!errors.notes} placeholder={t('order', 'notesPlaceholder')} className="mt-1" rows={3} />
              </div>
            </CardContent>
          </Card>

          {/* Order Summary */}
          {watchedSize && watchedQty > 0 && (
            <Card className="border-0 shadow-sm" style={{ backgroundColor: '#E5F2F0' }}>
              <CardContent className="p-5">
                <h3 className="font-heading font-semibold text-base mb-3" style={{ color: '#00352F' }}>{t('order', 'thisItem')}</h3>
                <div className="space-y-1 text-sm">
                  {selectedCatalogItem && (
                    <div className="flex justify-between text-gray-600">
                      <span>{t('order', 'style')}</span>
                      <span className="font-medium text-gray-800">{selectedCatalogItem.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>{t('order', 'sizeRow')} {watchedSize} × {watchedQty}</span>
                    <span>{formatCurrency(unitPrice)} {t('order', 'each')}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold text-gray-900">
                    <span>{t('order', 'subtotal')}</span>
                    <span className="text-[#00352F]">{formatCurrency(unitPrice * (watchedQty || 0))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cart summary strip */}
          {cartItems.length > 0 && (
            <button
              type="button"
              onClick={openCart}
              className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl border-2 text-sm font-semibold transition-all hover:bg-[#E5F2F0]"
              style={{ borderColor: '#CEDC00', backgroundColor: '#F5FCDE' }}
            >
              <div className="flex items-center gap-2" style={{ color: '#00352F' }}>
                <ShoppingCart className="w-4 h-4" />
                <span>{totalItems} {totalItems !== 1 ? t('cart', 'items') : t('cart', 'item')} {t('cart', 'inCart')}</span>
              </div>
              <span style={{ color: '#00352F' }}>{t('cart', 'viewCart')}</span>
            </button>
          )}

          <Button
            type="submit"
            disabled={isAdding || !institutionType || (showCatalogPicker && !selectedCatalogItem)}
            className="w-full text-white h-12 text-base font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 btn-brand-shadow disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
            style={{ backgroundColor: '#00352F' }}
          >
            {isAdding ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('order', 'adding')}</>
            ) : (
              <><ShoppingCart className="w-4 h-4 mr-2" /> {t('order', 'addToCart')}</>
            )}
          </Button>
        </form>
      </main>

      <footer className="pb-4">
        <PoweredByFooter />
      </footer>

      <CartDrawer
        checkoutPayload={checkoutPayload}
        onCheckoutValidate={handleCheckoutValidate}
      />
    </div>
  )
}

export default function CampaignSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F4F0' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#00352F' }} />
      </div>
    }>
      <CampaignOrderInner params={params} />
    </Suspense>
  )
}
