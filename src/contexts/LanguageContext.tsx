'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { translations, type Lang } from '@/lib/i18n'

interface LanguageContextType {
  lang: Lang
  setLang: (l: Lang) => void
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const stored = localStorage.getItem('lih_lang')
    if (stored === 'en' || stored === 'es') setLangState(stored)
  }, [])

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

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}

type Section = keyof typeof translations['en']

export function useT() {
  const { lang } = useLanguage()
  return function t(section: Section, key: string): string {
    return (translations[lang][section] as Record<string, string>)[key]
      ?? (translations['en'][section] as Record<string, string>)[key]
      ?? key
  }
}
