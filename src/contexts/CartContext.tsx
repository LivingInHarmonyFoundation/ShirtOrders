/**
 * @file CartContext.tsx
 * @description React context that owns the customer's shopping cart for the
 * order flow. Provides item state, CRUD mutators, drawer open/close, and
 * derived totals to any descendant via useCart().
 *
 * Key invariants:
 * - Cart is persisted to localStorage under the key `lih_cart`.
 * - A `hydrated` guard prevents writing to localStorage before the stored
 *   value has been read, eliminating SSR/client mismatch.
 * - Item IDs are generated with crypto.randomUUID() when available, with a
 *   Date.now + Math.random fallback for older browsers.
 * - addItem merges duplicate entries (same catalog_item_id + shirt_size) by
 *   incrementing quantity instead of pushing a new row.
 */
'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { CartItem } from '@/types'

// ─── Storage Keys ─────────────────────────────────────────────

const STORAGE_KEY = 'lih_cart'
const CHECKOUT_INFO_KEY = 'lih_checkout_info'

// Use sessionStorage so each browser tab has an independent cart.
// Falls back to null during SSR when window is not available.
const storage = typeof window !== 'undefined' ? window.sessionStorage : null

// ─── Types ────────────────────────────────────────────────────

export interface SavedCheckoutInfo {
  full_name?: string
  email?: string
  phone?: string
  institution_type?: string
  school_name?: string
  grade?: string
  classroom?: string
  organization_name?: string
  department_office?: string
  company_name?: string
  company_department?: string
  delivery_street?: string
  delivery_street2?: string
  delivery_city?: string
  delivery_state?: string
  delivery_zip?: string
  notes?: string
}

interface CartContextType {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'id'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  totalItems: number
  totalAmount: number
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  savedCheckoutInfo: SavedCheckoutInfo | null
  saveCheckoutInfo: (info: SavedCheckoutInfo) => void
}

const CartContext = createContext<CartContextType | null>(null)

// ─── Provider ─────────────────────────────────────────────────

/**
 * CartProvider — mounts the cart context. Must wrap any subtree that calls
 * useCart(). Handles localStorage hydration and persistence automatically.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [savedCheckoutInfo, setSavedCheckoutInfo] = useState<SavedCheckoutInfo | null>(null)

  // ─── SessionStorage Hydration ──────────────────────────────
  useEffect(() => {
    try {
      const stored = storage?.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setItems(parsed)
      }
    } catch {
      // ignore malformed storage
    }
    try {
      const storedInfo = storage?.getItem(CHECKOUT_INFO_KEY)
      if (storedInfo) setSavedCheckoutInfo(JSON.parse(storedInfo))
    } catch {
      // ignore malformed storage
    }
    setHydrated(true)
  }, [])

  // ─── SessionStorage Persistence ────────────────────────────
  // Persist to sessionStorage whenever items change (after hydration).
  // sessionStorage is tab-scoped, so concurrent users on different devices
  // or tabs cannot see each other's carts.
  useEffect(() => {
    if (!hydrated) return
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // ignore storage errors
    }
  }, [items, hydrated])

  // ─── Cart Mutators ─────────────────────────────────────────

  /**
   * addItem — adds a new item to the cart. If an item with the same
   * catalog_item_id and shirt_size already exists, its quantity is
   * incremented instead of inserting a duplicate row.
   */
  const addItem = useCallback((item: Omit<CartItem, 'id'>) => {
    setItems(prev => {
      const existing = prev.find(
        i => i.catalog_item_id === item.catalog_item_id && i.shirt_size === item.shirt_size
      )
      if (existing) {
        return prev.map(i =>
          i.id === existing.id
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        )
      }
      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      return [...prev, { ...item, id }]
    })
  }, [])

  /** removeItem — removes the cart item with the given id entirely. */
  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  /**
   * updateQuantity — sets the quantity of the item with the given id.
   * If quantity is 0 or below, the item is removed from the cart entirely.
   */
  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.id !== id))
    } else {
      setItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i))
    }
  }, [])

  const saveCheckoutInfo = useCallback((info: SavedCheckoutInfo) => {
    setSavedCheckoutInfo(info)
    try { storage?.setItem(CHECKOUT_INFO_KEY, JSON.stringify(info)) } catch {}
  }, [])

  /** clearCart — empties the entire cart and clears saved checkout info. */
  const clearCart = useCallback(() => {
    setItems([])
    setSavedCheckoutInfo(null)
    try { storage?.removeItem(CHECKOUT_INFO_KEY) } catch {}
  }, [])

  // ─── Drawer State ──────────────────────────────────────────

  /** openCart — opens the CartDrawer slide-over panel. */
  const openCart = useCallback(() => setIsOpen(true), [])
  /** closeCart — closes the CartDrawer slide-over panel. */
  const closeCart = useCallback(() => setIsOpen(false), [])

  // ─── Derived Totals ────────────────────────────────────────

  /** totalItems — sum of quantities across all cart items. */
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  /** totalAmount — sum of (quantity × unit_price) across all cart items. */
  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      totalAmount,
      isOpen,
      openCart,
      closeCart,
      savedCheckoutInfo,
      saveCheckoutInfo,
    }}>
      {children}
    </CartContext.Provider>
  )
}

// ─── Consumer Hook ─────────────────────────────────────────────

/**
 * useCart — returns the cart state and all mutators from CartContext.
 * Must be called within a CartProvider; throws if used outside one.
 */
export function useCart(): CartContextType {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}
