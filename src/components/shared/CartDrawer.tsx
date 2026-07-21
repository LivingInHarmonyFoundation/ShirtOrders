'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Minus, Plus, Trash2, X, ShoppingBag, Megaphone, ArrowRight } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { useT } from '@/contexts/LanguageContext'
import { formatCurrency } from '@/lib/utils'
import type { CartItem, Campaign } from '@/types'

interface CheckoutPayload {
  full_name: string
  email: string
  phone?: string
  institution_type: string
  school_name?: string
  grade?: string
  classroom?: string
  organization_name?: string
  department_office?: string
  region?: string
  company_name?: string
  company_department?: string
  delivery_address?: string
  delivery_city?: string
  delivery_state?: string
  delivery_zip?: string
  notes?: string
  school_link_id?: string
  company_link_id?: string
  campaign_id?: string
}

interface CartDrawerProps {
  checkoutPayload: CheckoutPayload | null
  onCheckoutValidate?: () => Promise<boolean>
}

function CartItemRow({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = useCart()
  const t = useT()

  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div
        className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden border border-gray-100"
        style={{ backgroundColor: '#E5F2F0' }}
      >
        {item.catalog_item_image ? (
          <div className="relative w-full h-full">
            <Image src={item.catalog_item_image} alt={item.catalog_item_name} fill className="object-cover" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" style={{ color: '#00352F' }} />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{item.catalog_item_name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{t('cart', 'size')}: <span className="font-medium text-gray-700">{item.shirt_size}</span></p>
        <p className="text-xs text-gray-500">
          {formatCurrency(item.unit_price)} × {item.quantity} ={' '}
          <span className="font-semibold text-gray-800">{formatCurrency(item.unit_price * item.quantity)}</span>
        </p>
      </div>

      <div className="flex flex-col items-end justify-between flex-shrink-0">
        <button
          onClick={() => removeItem(item.id)}
          className="text-gray-300 hover:text-red-600 transition-colors w-9 h-9 -mr-2 -mt-1.5 flex items-center justify-center"
          aria-label="Remove item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1 mt-1">
          <button
            onClick={() => updateQuantity(item.id, item.quantity - 1)}
            className="w-9 h-9 rounded-md border border-gray-200 flex items-center justify-center hover:border-[#00352F] hover:bg-[#E5F2F0] transition-colors"
            aria-label="Decrease quantity"
          >
            <Minus className="w-3.5 h-3.5 text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-900 w-7 text-center">{item.quantity}</span>
          <button
            onClick={() => updateQuantity(item.id, item.quantity + 1)}
            className="w-9 h-9 rounded-md border border-gray-200 flex items-center justify-center hover:border-[#00352F] hover:bg-[#E5F2F0] transition-colors"
            aria-label="Increase quantity"
          >
            <Plus className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * getCampaignOrderHref — returns the order URL for a cross-sell campaign.
 * When the user arrived via a school or company link, passes the institution
 * IDs as query params so the campaign order page stays locked to that context.
 */
function getCampaignOrderHref(slug: string, payload: CheckoutPayload | null): string {
  const base = `/campaign/${slug}/order`
  if (!payload) return base
  const params = new URLSearchParams()
  if (payload.school_link_id) {
    params.set('school_link_id', payload.school_link_id)
    if (payload.school_name) params.set('school_name', payload.school_name)
  } else if (payload.company_link_id) {
    params.set('company_link_id', payload.company_link_id)
    if (payload.company_name) params.set('company_name', payload.company_name)
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export default function CartDrawer({ checkoutPayload, onCheckoutValidate }: CartDrawerProps) {
  const { items, totalItems, totalAmount, isOpen, closeCart, clearCart } = useCart()
  const router = useRouter()
  const t = useT()
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [otherCampaigns, setOtherCampaigns] = useState<Campaign[]>([])
  const drawerRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) closeCart() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, closeCart])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Fetch other active campaigns whenever the drawer opens
  useEffect(() => {
    if (!isOpen) return
    fetch('/api/campaigns/active')
      .then(r => r.json())
      .then(({ campaigns }: { campaigns: Campaign[] }) => {
        if (!campaigns) return
        const currentId = checkoutPayload?.campaign_id
        setOtherCampaigns(campaigns.filter(c => c.slug && c.id !== currentId))
      })
      .catch(() => {})
  }, [isOpen, checkoutPayload?.campaign_id])

  const handleCheckout = async () => {
    if (items.length === 0) return

    if (onCheckoutValidate) {
      const valid = await onCheckoutValidate()
      if (!valid) {
        toast.error(t('cart', 'fillInfoBeforeCheckout'))
        closeCart()
        return
      }
    }

    if (!checkoutPayload) {
      toast.error(t('cart', 'fillInfoFirst2'))
      closeCart()
      return
    }

    setIsCheckingOut(true)
    try {
      const payload = {
        ...checkoutPayload,
        items: items.map(item => ({
          catalog_item_id: item.catalog_item_id,
          catalog_item_name: item.catalog_item_name,
          shirt_size: item.shirt_size,
          quantity: item.quantity,
        })),
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error || t('cart', 'failedToPlace'))
        return
      }

      clearCart()
      closeCart()
      router.push(`/order/checkout?order_id=${json.order.id}`)
    } catch {
      toast.error(t('errors', 'somethingWentWrong'))
    } finally {
      setIsCheckingOut(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          backgroundColor: 'rgba(0,0,0,0.4)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col w-full max-w-sm shadow-2xl transition-transform duration-300 ease-in-out"
        style={{
          backgroundColor: '#ffffff',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
        role="dialog"
        aria-label="Shopping cart"
        aria-modal="true"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ backgroundColor: '#00352F' }}
        >
          <div className="flex items-center gap-3">
            <svg width="22" height="22" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 2C11.34 2 10 3.34 10 5C10 5.55 10.45 6 11 6C11.55 6 12 5.55 12 5C12 4.45 12.45 4 13 4C13.55 4 14 4.45 14 5V7.18" stroke="#CEDC00" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M2 13L13 7.5L24 13" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 13L5 12V22H21V12L24 13" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="rgba(255,255,255,0.15)" />
              <path d="M10.5 12L13 15L15.5 12" stroke="#CEDC00" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <h2 className="font-heading font-bold text-white text-base leading-none">{t('cart', 'title')}</h2>
              <p className="text-white/60 text-xs mt-0.5">
                {totalItems === 0
                  ? t('cart', 'noItems')
                  : `${totalItems} ${totalItems !== 1 ? t('cart', 'items') : t('cart', 'item')}`}
              </p>
            </div>
          </div>
          <button
            onClick={closeCart}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
            aria-label="Close cart"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center pb-8">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
                style={{ backgroundColor: '#E5F2F0' }}
              >
                <svg width="36" height="36" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 2C11.34 2 10 3.34 10 5C10 5.55 10.45 6 11 6C11.55 6 12 5.55 12 5C12 4.45 12.45 4 13 4C13.55 4 14 4.45 14 5V7.18" stroke="#00352F" strokeWidth="1.6" strokeLinecap="round" />
                  <path d="M2 13L13 7.5L24 13" stroke="#00352F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 13L5 12V22H21V12L24 13" stroke="#00352F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="#E5F2F0" />
                  <path d="M10.5 12L13 15L15.5 12" stroke="#00352F" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="font-heading font-semibold text-gray-700 text-base">{t('cart', 'empty')}</p>
              <p className="text-sm text-gray-400 mt-1.5 max-w-[200px] leading-relaxed">
                {t('cart', 'emptySub')}
              </p>
            </div>
          ) : (
            <>
              {/* Cart items */}
              <div>
                {items.map(item => (
                  <CartItemRow key={item.id} item={item} />
                ))}
              </div>

              {/* Cross-sell: other active campaigns */}
              {otherCampaigns.length > 0 && (
                <div className="mt-5 pt-4 border-t border-dashed border-gray-200">
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-3"
                    style={{ color: '#00352F' }}
                  >
                    {t('cart', 'alsoOrderFrom')}
                  </p>
                  <div className="space-y-2">
                    {otherCampaigns.map(campaign => (
                      <Link
                        key={campaign.id}
                        href={getCampaignOrderHref(campaign.slug!, checkoutPayload ?? null)}
                        onClick={closeCart}
                        className="flex items-center gap-3 p-3 rounded-xl border-2 transition-all group"
                        style={{ borderColor: 'rgba(206,220,0,0.4)', backgroundColor: '#FAFDF0' }}
                      >
                        {/* Badge / icon */}
                        <div
                          className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden border border-gray-100 flex items-center justify-center"
                          style={{ backgroundColor: '#E5F2F0' }}
                        >
                          {campaign.badge_url ? (
                            <Image
                              src={campaign.badge_url}
                              alt={campaign.name}
                              width={40}
                              height={40}
                              className="object-cover w-full h-full"
                            />
                          ) : campaign.banner_url ? (
                            <Image
                              src={campaign.banner_url}
                              alt={campaign.name}
                              width={40}
                              height={40}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <Megaphone className="w-5 h-5" style={{ color: '#00352F' }} />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                            {campaign.name}
                          </p>
                          {campaign.description && (
                            <p className="text-xs text-gray-500 truncate mt-0.5 leading-tight">
                              {campaign.description}
                            </p>
                          )}
                        </div>

                        {/* Arrow */}
                        <ArrowRight
                          className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                          style={{ color: '#CEDC00' }}
                        />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div
            className="flex-shrink-0 border-t px-5 pt-4 pb-5 space-y-3"
            style={{ borderTopColor: 'rgba(0,0,0,0.06)' }}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700 text-sm">{t('cart', 'total')}</span>
              <span className="font-bold text-xl" style={{ color: '#00352F' }}>
                {formatCurrency(totalAmount)}
              </span>
            </div>

            {!checkoutPayload && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                {t('cart', 'fillInfoFirst')}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={closeCart}
                className="py-2.5 px-4 rounded-xl border-2 text-sm font-semibold transition-all hover:bg-gray-50"
                style={{ borderColor: '#00352F', color: '#00352F' }}
              >
                {t('cart', 'keepShopping')}
              </button>
              <button
                onClick={handleCheckout}
                disabled={isCheckingOut || !checkoutPayload}
                className="py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                style={{ backgroundColor: '#00352F' }}
              >
                {isCheckingOut ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t('cart', 'processing')}</>
                ) : (
                  <>{t('cart', 'checkout')}</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
