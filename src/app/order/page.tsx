/**
 * @file page.tsx
 * @description Public order form — the primary entry point for all order types.
 * Accessible without authentication; the active campaign acts as the access gate
 * (orders are blocked when no campaign is active or the active one has expired).
 *
 * Supports four institution types: school, government, personal, and
 * private_company. Conditional fields are validated server-side via a Zod
 * schema with `superRefine`. Items are added to a CartContext (sessionStorage),
 * and the full checkout payload is forwarded to CartDrawer for final submission.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader2, ShoppingBag, ShoppingCart } from 'lucide-react'
import { formatPhone } from '@/lib/utils'
import Image from 'next/image'
import Link from 'next/link'
import CartIcon from '@/components/shared/CartIcon'
import CartDrawer from '@/components/shared/CartDrawer'
import LanguageSelector from '@/components/shared/LanguageSelector'
import PoweredByFooter from '@/components/shared/PoweredByFooter'
import PersonalInfoCard from '@/components/order/PersonalInfoCard'
import ShirtDetailsCard, { OrderItemSummary } from '@/components/order/ShirtDetailsCard'
import InstitutionFields from '@/components/order/InstitutionFields'
import InstitutionTypePicker from '@/components/order/InstitutionTypePicker'
import { CampaignPicker, CatalogPicker } from '@/components/order/OrderPickers'
import { orderFormSchema, type OrderFormData } from '@/components/order/orderFormSchema'
import { useCart } from '@/contexts/CartContext'
import { useT } from '@/contexts/LanguageContext'
import type { AppSettings, InstitutionType, ShirtCatalogItem, GovOrg, PrivateCompany, Campaign } from '@/types'

// Uses the shared multi-institution schema (see components/order/orderFormSchema.ts)
type FormData = OrderFormData

export default function OrderPage() {
  const t = useT()
  const { addItem, openCart, items: cartItems, totalItems, savedCheckoutInfo, saveCheckoutInfo } = useCart()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [catalog, setCatalog] = useState<ShirtCatalogItem[]>([])
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<ShirtCatalogItem | null>(null)
  const [govOrgs, setGovOrgs] = useState<GovOrg[]>([])
  const [selectedGovOrg, setSelectedGovOrg] = useState<GovOrg | null>(null)
  const [privateCompanies, setPrivateCompanies] = useState<PrivateCompany[]>([])
  // null = loading; [] = none active; [one] = single (no picker); [two+] = picker shown
  const [activeCampaigns, setActiveCampaigns] = useState<Campaign[] | null>(null)
  // Set when the campaigns request fails (network/HTTP error) — distinct from "no
  // active campaign", so we can show a retry screen instead of "orders closed".
  const [loadError, setLoadError] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [inventoryRows, setInventoryRows] = useState<{ catalog_item_id: string | null; shirt_size: string; quantity: number }[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [institutionType, setInstitutionType] = useState<InstitutionType | ''>('')
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
    campaign_id?: string
  }>(null)

  const { register, handleSubmit, setValue, watch, reset, trigger, getValues, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: { quantity: 1 },
  })

  const watchedSize = watch('shirt_size')
  const watchedQty = watch('quantity')
  const unitPrice = selectedCatalogItem?.price ?? settings?.shirt_price ?? 15
  const allSizes: string[] = selectedCatalogItem?.available_sizes ?? settings?.available_sizes ?? ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  const itemInventory = inventoryRows.filter(r =>
    selectedCatalogItem
      ? r.catalog_item_id === selectedCatalogItem.id || r.catalog_item_id === null
      : r.catalog_item_id === null
  )
  const sizes = itemInventory.length > 0
    ? allSizes.filter(s => {
        const specific = itemInventory.find(r => r.catalog_item_id !== null && r.shirt_size === s)
        const general  = itemInventory.find(r => r.catalog_item_id === null  && r.shirt_size === s)
        const row = specific ?? general
        return !row || row.quantity > 0
      })
    : allSizes

  const loadInitialData = useCallback(() => {
    setLoadError(false)

    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(({ settings }) => { if (settings) setSettings(settings) })
      .catch(() => {})

    fetch('/api/catalog')
      .then(r => r.json())
      .then(({ items }) => {
        if (items?.length > 0) setCatalog(items)
      })
      .catch(() => {})

    fetch('/api/government-orgs')
      .then(r => r.json())
      .then(({ orgs }) => { if (orgs?.length > 0) setGovOrgs(orgs) })
      .catch(() => {})

    fetch('/api/private-companies')
      .then(r => r.json())
      .then(({ companies }) => { if (companies?.length > 0) setPrivateCompanies(companies) })
      .catch(() => {})

    // Campaigns drive the "orders closed" decision, so a failure here must NOT be
    // mistaken for "no active campaign". Treat a non-OK response as a load error
    // and surface a retry screen instead of the closed-for-orders dead-end.
    fetch('/api/campaigns/active')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load campaigns')
        return r.json()
      })
      .then(({ campaigns }) => setActiveCampaigns(campaigns ?? []))
      .catch(() => setLoadError(true))

    fetch('/api/inventory')
      .then(r => r.json())
      .then(({ rows }) => { if (rows) setInventoryRows(rows) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Auto-select if only one shirt
  useEffect(() => {
    if (catalog.length === 1) setSelectedCatalogItem(catalog[0])
  }, [catalog])

  // Pre-fill personal info if the customer already added to cart on another campaign
  useEffect(() => {
    if (!savedCheckoutInfo) return
    reset({ ...savedCheckoutInfo, quantity: 1 } as FormData)
    if (savedCheckoutInfo.institution_type) {
      setInstitutionType(savedCheckoutInfo.institution_type as InstitutionType)
      setValue('institution_type', savedCheckoutInfo.institution_type as InstitutionType)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Form Handlers ───────────────────────────────────────────

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
        campaign_id: selectedCampaign?.id ?? activeCampaigns?.[0]?.id,
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

  // handleCheckoutValidate — called by CartDrawer before navigating to checkout.
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
      campaign_id: selectedCampaign?.id ?? activeCampaigns?.[0]?.id,
    })
    return true
  }

  // ─── Campaign Gate ────────────────────────────────────────────
  const campaignClosed = activeCampaigns !== null && activeCampaigns.length === 0

  const showCatalogPicker = catalog.length > 1
  const showCampaignPicker = activeCampaigns !== null && activeCampaigns.length > 1
  // base step number for institution type card (campaign picker + catalog picker contribute 1 each when shown)
  const baseStep = (showCampaignPicker ? 1 : 0) + (showCatalogPicker ? 1 : 0) + 1

  // Network/HTTP failure loading the form — offer a retry rather than a dead-end.
  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center" style={{ backgroundColor: '#F5F4F0' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: '#E5F2F0' }}>
          <ShoppingBag className="w-8 h-8" style={{ color: '#00352F' }} />
        </div>
        <p className="text-gray-600 max-w-sm leading-relaxed mb-6">{t('errors', 'failedToLoad')}</p>
        <button
          onClick={loadInitialData}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:-translate-y-0.5"
          style={{ backgroundColor: '#00352F' }}
        >
          {t('common', 'tryAgain')}
        </button>
      </div>
    )
  }

  if (activeCampaigns === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F4F0' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#00352F' }} />
      </div>
    )
  }

  if (campaignClosed) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F5F4F0' }}>
        <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg, #00352F 0%, #CEDC00 60%, #00352F 100%)' }} />
        <header className="border-b" style={{ backgroundColor: 'rgba(255,255,255,0.92)', borderBottomColor: 'rgba(0,0,0,0.05)' }}>
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden p-0.5">
                <Image src="/logo.png" alt="Living in Harmony Foundation" width={32} height={32} className="object-contain" />
              </div>
              <div>
                <p className="font-semibold leading-none" style={{ color: '#00352F', fontSize: '13px' }}>
                  <span className="hidden sm:inline">Living in Harmony Foundation</span>
                  <span className="sm:hidden">LIH Foundation</span>
                </p>
              </div>
            </div>
            <LanguageSelector />
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: '#E5F2F0' }}>
            <ShoppingBag className="w-8 h-8" style={{ color: '#00352F' }} />
          </div>
          <h1 className="font-heading text-2xl font-bold text-gray-900 mb-3">{t('errors', 'ordersClosed')}</h1>
          <p className="text-gray-500 max-w-sm leading-relaxed mb-8">{t('errors', 'ordersNotOpen')}</p>
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
      {/* Brand accent bar */}
      <div
        className="h-[3px] w-full"
        style={{ background: 'linear-gradient(90deg, #00352F 0%, #CEDC00 60%, #00352F 100%)' }}
      />
      {/* Header */}
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
              <Image src="/logo.png" alt="Living in Harmony Foundation" width={32} height={32} className="object-contain" />
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
              href="/"
              className="text-gray-400 hover:text-[#00352F] transition-colors flex items-center gap-1 font-medium"
              style={{ fontSize: '12px' }}
            >
              <span>←</span> {t('common', 'back')}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-gray-900">{t('order', 'title')}</h1>
          <p className="text-gray-500 mt-1" style={{ fontSize: '14px' }}>
            {t('order', 'subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* Campaign Picker — only shown when multiple campaigns are active */}
          {showCampaignPicker && (
            <CampaignPicker
              stepNumber="1"
              campaigns={activeCampaigns}
              selectedCampaign={selectedCampaign}
              onSelect={setSelectedCampaign}
            />
          )}

          {/* Shirt Style Picker — only shown when multiple options exist */}
          {showCatalogPicker && (
            <CatalogPicker
              stepNumber={showCampaignPicker ? '2' : '1'}
              catalog={catalog}
              selectedItem={selectedCatalogItem}
              onSelect={setSelectedCatalogItem}
            />
          )}

          {/* Institution Type */}
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

          {/* Cart summary strip (when cart has items) */}
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
            disabled={isAdding || !institutionType || (showCatalogPicker && !selectedCatalogItem) || (showCampaignPicker && !selectedCampaign)}
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

      {/* Cart Drawer */}
      <CartDrawer
        checkoutPayload={checkoutPayload}
        onCheckoutValidate={handleCheckoutValidate}
      />
    </div>
  )
}
