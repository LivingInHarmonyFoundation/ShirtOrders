/**
 * @file CartDrawer.tsx
 * @description Slide-in cart drawer for the public order flow. Displays all CartContext
 * items with quantity controls and a checkout button. On checkout, the component POST's
 * a combined payload (checkoutPayload + cart items) to /api/orders, then redirects to
 * the checkout page with the returned order_id.
 *
 * Requires checkoutPayload to be non-null before checkout is allowed — this is the
 * customer's contact/institution fields filled in on the order form. An optional
 * onCheckoutValidate callback can trigger form validation before proceeding.
 *
 * UX: Escape key closes the drawer; body scroll is locked while the drawer is open.
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Minus, Plus, Trash2, X, ShoppingBag } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { useT } from '@/contexts/LanguageContext'
import { formatCurrency } from '@/lib/utils'
import type { CartItem } from '@/types'

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
  company_name?: string
  company_department?: string
  delivery_address?: string
  notes?: string
  school_link_id?: string
  company_link_id?: string
  campaign_id?: string
}

interface CartDrawerProps {
  checkoutPayload: CheckoutPayload | null
  onCheckoutValidate?: () => Promise<boolean>
}

/**
 * CartItemRow — renders a single cart item with thumbnail, size/price info,
 * and +/- quantity controls backed by CartContext.updateQuantity / removeItem.
 */
function CartItemRow({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = useCart()
  const t = useT()

  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      {/* Image */}
      <div
        className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden border border-gray-100"
        style={{ backgroundColor: '#E5F2F0' }}
      >
        {item.catalog_item_image ? (
          <div className="relative w-full h-full">
            <Image
              src={item.catalog_item_image}
              alt={item.catalog_item_name}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" style={{ color: '#00352F' }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{item.catalog_item_name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{t('cart', 'size')}: <span className="font-medium text-gray-700">{item.shirt_size}</span></p>
        <p className="text-xs text-gray-500">
          {formatCurrency(item.unit_price)} × {item.quantity} ={' '}
          <span className="font-semibold text-gray-800">{formatCurrency(item.unit_price * item.quantity)}</span>
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-end justify-between flex-shrink-0">
        <button
          onClick={() => removeItem(item.id)}
          className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
          aria-label="Remove item"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-1 mt-1">
          <button
            onClick={() => updateQuantity(item.id, item.quantity - 1)}
            className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center hover:border-[#00352F] hover:bg-[#E5F2F0] transition-colors"
            aria-label="Decrease quantity"
          >
            <Minus className="w-3 h-3 text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-900 w-6 text-center">{item.quantity}</span>
          <button
            onClick={() => updateQuantity(item.id, item.quantity + 1)}
            className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center hover:border-[#00352F] hover:bg-[#E5F2F0] transition-colors"
            aria-label="Increase quantity"
          >
            <Plus className="w-3 h-3 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * CartDrawer — animated slide-in panel showing current cart items and checkout CTA.
 * checkoutPayload must be non-null (customer info complete) for checkout to proceed.
 * onCheckoutValidate, if provided, is awaited before the POST; returning false
 * closes the drawer and shows an error toast prompting the user to fill their info.
 */
export default function CartDrawer({ checkoutPayload, onCheckoutValidate }: CartDrawerProps) {
  const { items, totalItems, totalAmount, isOpen, closeCart, clearCart } = useCart()
  const router = useRouter()
  const t = useT()
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) closeCart()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, closeCart])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const handleCheckout = async () => {
    if (items.length === 0) return

    // Validate the form if a validator is provided
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
            {/* Cart hanger icon in header */}
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
            <div>
              {items.map(item => (
                <CartItemRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div
            className="flex-shrink-0 border-t px-5 pt-4 pb-5 space-y-3"
            style={{ borderTopColor: 'rgba(0,0,0,0.06)' }}
          >
            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700 text-sm">{t('cart', 'total')}</span>
              <span className="font-bold text-xl" style={{ color: '#00352F' }}>
                {formatCurrency(totalAmount)}
              </span>
            </div>

            {/* Info when no payload yet */}
            {!checkoutPayload && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                {t('cart', 'fillInfoFirst')}
              </p>
            )}

            {/* CTA buttons */}
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
