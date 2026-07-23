/**
 * @file LanguageContext.tsx
 * @description React context that manages the active UI language (English or
 * Spanish) and exposes the `useT(section, key)` translation hook to the tree.
 *
 * Key invariants:
 * - Selected language is persisted to localStorage under the key `lih_lang`.
 * - Initial render defaults to 'es'; the stored preference is applied in a
 *   useEffect, so the first render is always Spanish (avoids SSR mismatch).
 * - useT(section, key) falls back to the English value if the key is missing
 *   in the active language, then returns the raw key string if missing in
 *   both languages.
 */
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { translations, type Lang } from '@/lib/i18n'

// ─── Context Type ─────────────────────────────────────────────

/**
 * LanguageContextType — the shape of the language context value.
 * setLang also persists the new value to localStorage.
 */
interface LanguageContextType {
  lang: Lang
  setLang: (l: Lang) => void
}

const LanguageContext = createContext<LanguageContextType | null>(null)

// ─── Provider ─────────────────────────────────────────────────

/**
 * LanguageProvider — mounts the language context. Must wrap any subtree that
 * calls useLanguage() or useT(). Reads the stored preference from localStorage
 * on mount and writes it back whenever the user switches language.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('es')

  useEffect(() => {
    const stored = localStorage.getItem('lih_lang')
    if (stored === 'en' || stored === 'es') setLangState(stored)
  }, [])

  // Keep the document's lang attribute in sync so screen readers announce the
  // page in the correct language (WCAG 3.1.1). The root layout renders lang="en"
  // for SSR; this updates it once the stored/selected locale is known.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('lih_lang', l)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

// ─── Consumer Hooks ───────────────────────────────────────────

/**
 * useLanguage — returns { lang, setLang } from LanguageContext.
 * Must be called within a LanguageProvider; throws otherwise.
 */
export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}

/** Section — the set of valid top-level keys in the translation dictionary. */
type Section = keyof typeof translations['en']

/**
 * useT — returns a `t(section, key)` lookup function bound to the active
 * language. Resolution order: active language → English fallback → raw key.
 *
 * Example:
 *   const t = useT()
 *   t('cart', 'checkout')  // → "Checkout →" (en) or "Pagar →" (es)
 */
export function useT() {
  const { lang } = useLanguage()
  return function t(section: Section, key: string): string {
    return (translations[lang][section] as Record<string, string>)[key]
      ?? (translations['en'][section] as Record<string, string>)[key]
      ?? key
  }
}
