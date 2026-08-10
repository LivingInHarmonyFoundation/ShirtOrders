/**
 * @file page.tsx
 * @description Staff-only order page, reachable ONLY via the direct link the admin
 * shares (/order/staff) — the "Staff" option is deliberately absent from the public
 * order form's type picker. Gated by app_settings.staff_orders_enabled: when the
 * toggle is off, the page shows a "link unavailable" state and the orders API also
 * rejects staff orders server-side.
 *
 * Structurally mirrors the company slug page, minus the entity lookup. Pricing is
 * size-aware (size_prices → item price → global), matching the main order forms.
 * Shares the CartContext / CartDrawer checkout flow.
 */

'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Users, Loader2, AlertCircle, CheckCircle2, ShoppingBag, ShoppingCart } from 'lucide-react'
import { cn, formatCurrency, formatPhone } from '@/lib/utils'
import Image from 'next/image'
import ShirtViewer from '@/components/shared/ShirtViewer'
import SizePicker from '@/components/order/SizePicker'
import PendingOrderBanner from '@/components/shared/PendingOrderBanner'
import CartIcon from '@/components/shared/CartIcon'
import CartDrawer from '@/components/shared/CartDrawer'
import PoweredByFooter from '@/components/shared/PoweredByFooter'
import LanguageSelector from '@/components/shared/LanguageSelector'
import { useCart } from '@/contexts/CartContext'
import { useT } from '@/contexts/LanguageContext'
import type { AppSettings, ShirtCatalogItem } from '@/types'

const schema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional().refine(v => !v || v.replace(/\D/g, '').length === 10, { message: 'Enter a valid 10-digit phone number' }),
  shirt_size: z.string().min(1, 'Please select a size'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

/**
 * StaffOrderPage — link-only order form for foundation staff members.
 * No entity lookup: institution_type is fixed to 'staff'.
 */
export default function StaffOrderPage() {
  const t = useT()

  const { addItem, openCart, items: cartItems, totalItems } = useCart()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [catalog, setCatalog] = useState<ShirtCatalogItem[]>([])
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<ShirtCatalogItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [checkoutPayload, setCheckoutPayload] = useState<null | {
    full_name: string
    email: string
    phone?: string
    institution_type: string
    notes?: string
  }>(null)

  const { register, handleSubmit, setValue, watch, trigger, getValues, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1 },
  })

  const watchedSize = watch('shirt_size')
  const watchedQty = watch('quantity')
  // Price follows the selected size: per-size override → item base price → global.
  const unitPrice =
    (watchedSize ? selectedCatalogItem?.size_prices?.[watchedSize] : undefined)
    ?? selectedCatalogItem?.price
    ?? settings?.shirt_price
    ?? 15

  // ─── Data Fetching ───────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/admin/settings').then(r => r.json()),
      fetch('/api/catalog').then(r => r.json()),
    ]).then(([settingsData, catalogData]) => {
      if (settingsData.settings) setSettings(settingsData.settings)
      if (catalogData.items?.length > 0) {
        setCatalog(catalogData.items)
        if (catalogData.items.length === 1) setSelectedCatalogItem(catalogData.items[0])
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const staffEnabled = settings?.staff_orders_enabled === true

  const buildPayload = (data: Pick<FormData, 'full_name' | 'email' | 'phone' | 'notes'>) => ({
    full_name: data.full_name,
    email: data.email,
    phone: data.phone,
    institution_type: 'staff',
    notes: data.notes,
  })

  const onSubmit = async (data: FormData) => {
    setIsAdding(true)
    try {
      setCheckoutPayload(buildPayload(data))

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
    const result = await trigger(['full_name', 'email'])
    if (!result) return false
    setCheckoutPayload(buildPayload(getValues()))
    return true
  }

  const sizes: string[] = selectedCatalogItem?.available_sizes ?? settings?.available_sizes ?? ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  const showCatalogPicker = catalog.length > 1

  const Header = () => (
    <header className="border-b bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-0.5 border border-gray-100">
            <Image src="/logo.png" alt="Living in Harmony Foundation" width={36} height={36} className="object-contain" />
          </div>
          <div>
            <p className="font-bold text-[#00352F] text-sm leading-none">Living in Harmony Foundation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <CartIcon />
        </div>
      </div>
    </header>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F4F0] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#00352F]" />
      </div>
    )
  }

  if (!staffEnabled) {
    return (
      <div className="min-h-screen bg-[#F5F4F0]">
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('errors', 'linkUnavailable')}</h1>
          <p className="text-gray-500">{t('order', 'staffLinkDisabled')}</p>
        </main>
        <CartDrawer checkoutPayload={null} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Staff banner */}
        <div className="mb-6 rounded-2xl px-5 py-4 flex items-center gap-3 text-white shadow-md" style={{ backgroundColor: '#00352F' }}>
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[#CEDC00] text-xs font-semibold uppercase tracking-wide">{t('order', 'staffOrderTitle')}</p>
            <p className="font-bold text-lg leading-tight">Living in Harmony Foundation</p>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('order', 'title')}</h1>
          <p className="text-gray-500 mt-1 text-sm">{t('order', 'staffOrderSub')}</p>
        </div>

        <PendingOrderBanner />
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Shirt Style Picker */}
          {showCatalogPicker && (
            <Card className={cn('border-2 transition-colors', !selectedCatalogItem ? 'border-amber-300 bg-amber-50' : 'border-[#CEDC00]/40')}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('order', 'chooseShirt')} *</CardTitle>
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
                          'relative rounded-xl border-2 overflow-hidden text-left transition-all',
                          selected ? 'border-[#00352F] shadow-md ring-2 ring-[#00352F]/20' : 'border-gray-200 hover:border-[#00352F]/40'
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
                          <p className={cn('text-xs font-semibold leading-tight', selected ? 'text-[#00352F]' : 'text-gray-800')}>{item.name}</p>
                          {item.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>}
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

          {/* Personal Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('order', 'personalInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="full_name">{t('order', 'fullName')} *</Label>
                <Input id="full_name" {...register('full_name')} aria-invalid={!!errors.full_name} placeholder={t('order', 'fullNamePlaceholder')} className="mt-1" />
                {errors.full_name && <p role="alert" className="text-red-600 text-xs mt-1">{errors.full_name.message}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">{t('order', 'emailAddress')} *</Label>
                  <Input id="email" type="email" {...register('email')} aria-invalid={!!errors.email} placeholder={t('order', 'emailPlaceholder')} className="mt-1" />
                  {errors.email && <p role="alert" className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <Label htmlFor="phone">{t('order', 'phone')} <span className="text-gray-400">{t('common', 'optional')}</span></Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    {...register('phone')} aria-invalid={!!errors.phone}
                    onChange={e => setValue('phone', formatPhone(e.target.value), { shouldValidate: true })}
                    placeholder="(787) 555 - 1234"
                    maxLength={16}
                    className="mt-1"
                  />
                  {errors.phone && <p role="alert" className="text-red-600 text-xs mt-1">{errors.phone.message}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shirt Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('order', 'shirtDetails')}</CardTitle>
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
                <SizePicker
                  sizes={sizes}
                  selectedSize={watchedSize}
                  onSelectSize={size => setValue('shirt_size', size, { shouldValidate: true })}
                  sizeGroups={settings?.size_groups ?? null}
                />
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
            <Card className="border-[#CEDC00]/40 bg-[#E5F2F0]">
              <CardContent className="p-4">
                <h3 className="font-semibold text-[#00352F] mb-3">{t('order', 'thisItem')}</h3>
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
            disabled={isAdding || (showCatalogPicker && !selectedCatalogItem)}
            className="w-full text-white h-12 text-base font-semibold"
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
