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
import ShirtDetailsCard, { OrderItemSummary } from '@/components/order/ShirtDetailsCard'
import InstitutionFields from '@/components/order/InstitutionFields'
import InstitutionTypePicker from '@/components/order/InstitutionTypePicker'
import { CatalogPicker } from '@/components/order/OrderPickers'
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
            <CatalogPicker
              stepNumber="1"
              catalog={catalog}
              selectedItem={selectedCatalogItem}
              onSelect={setSelectedCatalogItem}
            />
          )}

          {/* Institution Type — hidden when locked via ?institution= param */}
          {!lockedInstitution && (
            <InstitutionTypePicker
              stepNumber={String(baseStep)}
              settings={settings}
              selectedType={institutionType}
              onSelect={type => {
                setInstitutionType(type)
                setValue('institution_type', type, { shouldValidate: true })
                if (type !== 'government') setSelectedGovOrg(null)
              }}
              error={errors.institution_type?.message}
            />
          )}

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

          {/* Institution-specific fields */}
          <InstitutionFields
            institutionType={institutionType}
            stepNumber={String(baseStep + 2)}
            register={register}
            errors={errors}
            setValue={setValue}
            govOrgs={govOrgs}
            selectedGovOrg={selectedGovOrg}
            onGovOrgChange={name => {
              const found = govOrgs.find(o => o.name === name) || null
              setSelectedGovOrg(found)
              setValue('organization_name', name, { shouldValidate: true })
              setValue('department_office', '', { shouldValidate: false })
            }}
            privateCompanies={privateCompanies}
            lockedSchoolName={lockedSchoolName}
            lockedCompanyName={lockedCompanyName}
          />

          {/* Shirt Details */}
          <ShirtDetailsCard
            stepNumber={institutionType ? String(baseStep + 3) : String(baseStep + 2)}
            selectedCatalogItem={selectedCatalogItem}
            showSelectedShirtSummary={catalog.length === 1 && !!selectedCatalogItem}
            sizes={sizes}
            selectedSize={watchedSize}
            onSelectSize={size => setValue('shirt_size', size, { shouldValidate: true })}
            sizeError={errors.shirt_size?.message}
            quantityReg={register('quantity', { valueAsNumber: true })}
            quantityError={errors.quantity?.message}
            notesReg={register('notes')}
          />

          {/* Order Summary */}
          <OrderItemSummary
            catalogItemName={selectedCatalogItem?.name}
            size={watchedSize}
            quantity={watchedQty}
            unitPrice={unitPrice}
          />

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
